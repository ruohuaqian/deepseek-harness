/**
 * Ensure the unpublished desktop Electron shell has its local install, then
 * start it. Electron stays out of the repository workspace so CI and npm
 * publication never download it.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const desktopDir = join(repoRoot, 'desktop')
const electronCli = join(desktopDir, 'node_modules', 'electron', 'cli.js')

if (!existsSync(join(repoRoot, 'apps/web/dist/index.html'))) {
  process.stderr.write('The desktop window needs a built Web UI. From the repository root run:\n  pnpm install\n  pnpm run build\n  pnpm desktop\n')
  process.exit(1)
}

if (!existsSync(electronCli)) {
  process.stdout.write('Installing the local Electron shell into desktop/ (first run only)…\n')
  const install = spawnSync('npm', ['install'], {
    cwd: desktopDir,
    stdio: 'inherit',
    shell: true,
  })
  if (install.status !== 0) {
    process.stderr.write('desktop: npm install failed; Electron was not downloaded.\n')
    process.exit(install.status === null ? 1 : install.status)
  }
}

const child = spawn(process.execPath, [electronCli, desktopDir, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DSH_DESKTOP_CWD: process.cwd(),
    // The Win32 folder-dialog worker is spawn(process.execPath, worker). If
    // dsh web inherits Electron as execPath, that child exits before IPC.
    DSH_NODE_EXEC_PATH: process.execPath,
  },
  stdio: 'inherit',
})
child.on('exit', (code, signal) => {
  if (signal !== null) process.exit(1)
  process.exit(code ?? 0)
})
