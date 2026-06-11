// Bundles every test/*.test.ts to out-test/ as CommonJS, then runs them with
// Node's built-in test runner. Keeps the toolchain to esbuild + node — no extra
// test framework or ts-node dependency.
const esbuild = require('esbuild');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_DIR = path.join(__dirname, 'test');
const OUT_DIR = path.join(__dirname, 'out-test');

async function main() {
  const entryPoints = fs
    .readdirSync(TEST_DIR)
    .filter((f) => f.endsWith('.test.ts'))
    .map((f) => path.join(TEST_DIR, f));

  if (entryPoints.length === 0) {
    console.error('No test files found in test/.');
    process.exit(1);
  }

  await esbuild.build({
    entryPoints,
    outdir: OUT_DIR,
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    sourcemap: true,
    // vscode is never imported by the pure-logic tests, but mark it external so
    // a stray import would fail loudly at runtime rather than at bundle time.
    external: ['vscode'],
  });

  const result = spawnSync(process.execPath, ['--test', OUT_DIR], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
