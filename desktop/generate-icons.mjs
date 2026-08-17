/**
 * Rasterize desktop/icon.svg into PNG and ICO using Electron's page capture.
 * Run: node node_modules/electron/cli.js generate-icons.mjs
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, nativeImage } from 'electron'

const dir = dirname(fileURLToPath(import.meta.url))
const sizes = [16, 24, 32, 48, 64, 128, 256]

function pngToIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  const entries = []
  let offset = 6 + 16 * images.length
  for (const image of images) {
    const entry = Buffer.alloc(16)
    const side = image.size >= 256 ? 0 : image.size
    entry.writeUInt8(side, 0)
    entry.writeUInt8(side, 1)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(image.png.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    offset += image.png.length
  }
  return Buffer.concat([header, ...entries, ...images.map(image => image.png)])
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 256,
    height: 256,
    useContentSize: true,
    frame: false,
    show: false,
    backgroundColor: '#3964FE',
    webPreferences: { sandbox: true },
  })
  await window.loadFile(join(dir, 'icon.svg'))
  await new Promise(resolve => setTimeout(resolve, 200))
  const captured = await window.webContents.capturePage()
  const source = nativeImage.createFromBuffer(captured.toPNG())
  const images = sizes.map(size => ({
    size,
    png: source.resize({ width: size, height: size, quality: 'best' }).toPNG(),
  }))
  writeFileSync(join(dir, 'icon.png'), images.at(-1).png)
  writeFileSync(join(dir, 'icon.ico'), pngToIco(images))
  app.quit()
}).catch((error) => {
  console.error(error)
  app.exit(1)
})
