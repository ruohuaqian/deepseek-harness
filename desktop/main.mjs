import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, Menu, shell } from 'electron'

const desktopDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = dirname(desktopDir)
const iconPath = join(desktopDir, existsSync(join(desktopDir, 'icon.ico')) ? 'icon.ico' : 'icon.svg')
const readyUrl = /dsh web: (http:\/\/[^\s]+)/
const startTimeoutMs = 120_000

/** @type {import('node:child_process').ChildProcess | undefined} */
let host
/** @type {BrowserWindow | undefined} */
let windowRef

/**
 * Build `dsh web` argv, defaulting to an OS-assigned port when the caller
 * did not pass `--port`.
 * @param {string[]} argv
 * @returns {string[]}
 */
function webArgv(argv) {
  const rest = argv.filter(value => value !== '--')
  const hasPort = rest.some(value => value === '--port' || value.startsWith('--port='))
  return hasPort ? ['web', ...rest] : ['web', '--port', '0', ...rest]
}

/**
 * Pick the first printed local Web URL from host stdout.
 * @param {string} text
 * @returns {string | undefined}
 */
function parseReadyUrl(text) {
  return readyUrl.exec(text)?.[1]
}

/**
 * Node executable for `dsh web`. Electron's `process.execPath` is
 * `electron.exe`; the Win32 folder-dialog worker must be a Node child
 * with an IPC channel (`packages/host/directory-picker-native`).
 * @returns an absolute Node.js path
 */
function nodeExecPath() {
  const configured = process.env.DSH_NODE_EXEC_PATH
  if (typeof configured === 'string' && configured !== '') return configured
  if (process.versions.electron === undefined) return process.execPath
  const npmNode = process.env.npm_node_execpath
  if (typeof npmNode === 'string' && npmNode !== '') return npmNode
  throw new Error('The desktop window could not find a Node.js executable to start dsh web. Launch it with `pnpm desktop` from the repository.')
}

function dshCommand() {
  const execPath = nodeExecPath()
  const built = join(repoRoot, 'apps/cli/lib/bin.js')
  if (existsSync(built)) {
    return { execPath, args: [built] }
  }
  return {
    execPath,
    args: ['--import', 'tsx/esm', join(repoRoot, 'apps/cli/src/bin.ts')],
  }
}

function stopHost() {
  if (host === undefined || host.killed || host.exitCode !== null) return
  if (process.platform === 'win32' && host.pid !== undefined) {
    spawn('taskkill', ['/pid', String(host.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    return
  }
  host.kill('SIGTERM')
}

function startHost(argv) {
  const dist = join(repoRoot, 'apps/web/dist/index.html')
  if (!existsSync(dist)) {
    throw new Error('The desktop window needs a built Web UI. From the repository root run: pnpm install && pnpm run build && pnpm desktop')
  }
  const command = dshCommand()
  const child = spawn(command.execPath, [...command.args, ...webArgv(argv)], {
    cwd: process.env.DSH_DESKTOP_CWD ?? process.cwd(),
    env: {
      ...process.env,
      DSH_NODE_EXEC_PATH: command.execPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  host = child
  child.stderr?.on('data', chunk => process.stderr.write(chunk))
  return new Promise((resolve, reject) => {
    let stdout = ''
    const timer = setTimeout(() => {
      stopHost()
      reject(new Error(`dsh web did not print a ready URL within ${String(startTimeoutMs / 1000)}s`))
    }, startTimeoutMs)
    const fail = (error) => {
      clearTimeout(timer)
      reject(error)
    }
    child.stdout?.on('data', (chunk) => {
      process.stdout.write(chunk)
      stdout += chunk.toString('utf8')
      const url = parseReadyUrl(stdout)
      if (url !== undefined) {
        clearTimeout(timer)
        resolve(url)
      }
    })
    child.once('error', fail)
    child.once('exit', (code, signal) => {
      if (parseReadyUrl(stdout) !== undefined) return
      fail(new Error(`dsh web exited before becoming ready (code ${String(code)}, signal ${String(signal)})`))
    })
  })
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'DeepSeek Harness',
    icon: iconPath,
    autoHideMenuBar: true,
    backgroundColor: '#0f1115',
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  windowRef = window
  Menu.setApplicationMenu(null)
  void window.loadFile(join(desktopDir, 'splash.html'))
  if (process.env.DSH_DESKTOP_DEVTOOLS === '1') window.webContents.openDevTools({ mode: 'detach' })
  return window
}

function attachNavigationGuard(window, url) {
  const origin = new URL(url).origin
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith(origin)) return { action: 'allow' }
    void shell.openExternal(target)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, target) => {
    if (target.startsWith(origin) || target.startsWith('file:')) return
    event.preventDefault()
    void shell.openExternal(target)
  })
}

app.setName('DeepSeek Harness')
if (process.platform === 'win32') app.setAppUserModelId('ai.deepseek.dsh.desktop')

const locked = app.requestSingleInstanceLock()
if (!locked) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (windowRef === undefined) return
    if (windowRef.isMinimized()) windowRef.restore()
    windowRef.focus()
  })
  app.whenReady().then(async () => {
    const window = createWindow()
    const url = await startHost(process.argv.slice(2))
    attachNavigationGuard(window, url)
    await window.loadURL(url)
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    stopHost()
    app.exit(1)
  })
}

app.on('window-all-closed', () => {
  stopHost()
  app.quit()
})

app.on('before-quit', () => {
  stopHost()
})
