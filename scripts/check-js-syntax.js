#!/usr/bin/env node
// Syntax-checks every inline <script> block in index.html with `node --check`.
// Catches breakage like the JS syntax error fixed in commit 56b8dba before it ships.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const target = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(target, 'utf8');

const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const nonJsTypeRe = /type\s*=\s*["']([^"']+)["']/i;

let match;
let checked = 0;
let failed = 0;

while ((match = scriptRe.exec(html)) !== null) {
  const attrs = match[1];
  const body = match[2];

  if (/\bsrc\s*=/.test(attrs)) continue; // external script, nothing to check here

  const typeMatch = attrs.match(nonJsTypeRe);
  if (typeMatch && !/javascript|module|^$/i.test(typeMatch[1])) continue; // e.g. application/ld+json

  if (!body.trim()) continue;

  const startLine = html.slice(0, match.index).split('\n').length;
  const tmpFile = path.join(os.tmpdir(), `check-js-syntax-${process.pid}-${checked}.js`);
  fs.writeFileSync(tmpFile, body);

  try {
    execFileSync(process.execPath, ['--check', tmpFile], { stdio: 'pipe' });
    checked += 1;
  } catch (err) {
    failed += 1;
    console.error(`Syntax error in <script> starting at ${target}:${startLine}`);
    console.error(err.stderr ? err.stderr.toString() : err.message);
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

if (checked === 0 && failed === 0) {
  console.log(`No inline <script> blocks found in ${target}.`);
} else {
  console.log(`Checked ${checked + failed} inline <script> block(s), ${failed} failed.`);
}

process.exit(failed > 0 ? 1 : 0);
