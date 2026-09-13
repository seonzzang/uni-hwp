import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const studioDir = path.join(repoRoot, 'apps', 'studio');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// Tauri's config lives in `src-tauri`, while the frontend lives in
// `apps/studio`. Keep the path anchored to this script's real repository
// layout and fail with an actionable error if a caller invokes the script
// from an old/relocated extension layout.
const studioPackage = path.join(studioDir, 'package.json');
if (!existsSync(studioPackage)) {
  console.error(`Frontend package not found at ${studioPackage}`);
  console.error('Expected Uni-HWP layout: <repo>/src-tauri and <repo>/apps/studio');
  process.exit(1);
}

const result = spawnSync(npmBin, ['--prefix', studioDir, 'run', 'build'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error);
  process.exit(typeof result.status === 'number' ? result.status : 1);
}

process.exit(result.status ?? 0);
