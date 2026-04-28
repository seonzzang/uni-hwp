import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const srcDir = resolve(rootDir, 'src');
const wasmDir = resolve(rootDir, '..', 'pkg');
const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf-8'));
const isGithubPages = process.env.GITHUB_PAGES === 'true';
const githubPagesBase = process.env.GITHUB_PAGES_BASE || '/uni-hwp/';

export default defineConfig({
  base: isGithubPages ? githubPagesBase : '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${srcDir}/` },
      { find: /^@wasm\//, replacement: `${wasmDir}/` },
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 7700,
    allowedHosts: true,
    fs: {
      allow: ['..'],
    },
  },
});
