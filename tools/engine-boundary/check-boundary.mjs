#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const sourceRoot = path.join(repoRoot, 'apps', 'studio', 'src');
const allowedFiles = new Set([
  ...filesUnder(path.join(sourceRoot, 'engine-boundary')),
  ...filesUnder(path.join(sourceRoot, 'core')).filter((file) =>
    path.basename(file).startsWith('wasm-bridge')),
]);
const forbidden = [
  /from\s+['"][^'"]*rhwp[^'"]*['"]/i,
  /import\s*\([^)]*rhwp[^)]*\)/i,
  /require\s*\([^)]*rhwp[^)]*\)/i,
  /from\s+['"]@wasm\//i,
];

function filesUnder(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesUnder(fullPath));
    else if (/\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name)) result.push(fullPath);
  }
  return result;
}

const violations = [];
for (const file of filesUnder(sourceRoot)) {
  if (allowedFiles.has(file)) continue;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (forbidden.some((pattern) => pattern.test(line))) {
      violations.push(`${path.relative(repoRoot, file)}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error('Engine boundary violation: direct engine imports must stay inside the adapter.');
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Engine boundary check passed.');
}
