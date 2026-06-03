import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const distDir = resolve(process.cwd(), 'extension/dist');

test('extension build output exists', () => {
  assert.ok(existsSync(distDir), 'extension/dist/ should exist (run `npm run build:extension` first)');
});

test('extension build contains a valid manifest', () => {
  const manifestPath = resolve(distDir, 'manifest.json');
  assert.ok(existsSync(manifestPath), 'extension/dist/manifest.json should exist');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.manifest_version, 3, 'should be a Manifest V3 extension');
  assert.ok(manifest.name, 'manifest should have a name');
});
