import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const studioDir = path.join(repoRoot, 'rhwp-studio');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

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
