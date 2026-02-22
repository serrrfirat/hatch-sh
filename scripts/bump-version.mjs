#!/usr/bin/env node

/**
 * Bump version across all desktop app manifests.
 * Usage: node scripts/bump-version.mjs 0.2.0
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const DESKTOP = join(root, 'apps', 'desktop');

const FILES = {
  packageJson: join(DESKTOP, 'package.json'),
  tauriConf: join(DESKTOP, 'src-tauri', 'tauri.conf.json'),
  cargoToml: join(DESKTOP, 'src-tauri', 'Cargo.toml'),
};

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/bump-version.mjs <version>');
  console.error('Example: node scripts/bump-version.mjs 0.2.0');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid semver: "${version}". Expected format: X.Y.Z`);
  process.exit(1);
}

// --- package.json ---
const pkg = JSON.parse(readFileSync(FILES.packageJson, 'utf-8'));
const oldPkgVersion = pkg.version;
pkg.version = version;
writeFileSync(FILES.packageJson, JSON.stringify(pkg, null, 2) + '\n');

// --- tauri.conf.json ---
const tauri = JSON.parse(readFileSync(FILES.tauriConf, 'utf-8'));
const oldTauriVersion = tauri.version;
tauri.version = version;
writeFileSync(FILES.tauriConf, JSON.stringify(tauri, null, 2) + '\n');

// --- Cargo.toml ---
const cargo = readFileSync(FILES.cargoToml, 'utf-8');
const cargoVersionRe = /^(version\s*=\s*")([^"]+)(")/m;
const cargoMatch = cargo.match(cargoVersionRe);
const oldCargoVersion = cargoMatch ? cargoMatch[2] : '???';
const newCargo = cargo.replace(cargoVersionRe, `$1${version}$3`);
writeFileSync(FILES.cargoToml, newCargo);

console.log('Version bumped:\n');
console.log(`  package.json:   ${oldPkgVersion} -> ${version}`);
console.log(`  tauri.conf.json: ${oldTauriVersion} -> ${version}`);
console.log(`  Cargo.toml:     ${oldCargoVersion} -> ${version}`);
console.log('\nNext steps:');
console.log(`  git add -A && git commit -m "chore: bump version to ${version}"`);
console.log(`  git tag v${version}`);
console.log(`  git push && git push --tags`);
