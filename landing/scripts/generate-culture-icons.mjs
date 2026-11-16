import { createRequire } from "node:module"
import { mkdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

// sharp is already provided by Next.js; do not add a second image dependency.
const require = createRequire(import.meta.resolve("next/package.json"))
const sharp = require("sharp")
const source = new URL("../public/culture-icon.svg", import.meta.url)
const destination = new URL("../public/culture-icons/", import.meta.url)
await mkdir(destination, { recursive: true })
const svg = await readFile(source)
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(name, destination)))
}
console.log("Generated three Mataró Cultura app icons.")

// Keep installed Android branding identical to the PWA without a second source SVG.
const native = new URL("../../app/assets/", import.meta.url)
await sharp(svg).resize(1024, 1024).png().toFile(fileURLToPath(new URL("culture-icon.png", native)))
const mark = Buffer.from(svg.toString().replace(/<rect[^>]*\/>/, ''))
await sharp(mark).resize(432, 432).extend({ top: 108, bottom: 108, left: 108, right: 108, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(fileURLToPath(new URL("culture-adaptive.png", native)))
await sharp(mark).resize(432, 432).png().toFile(fileURLToPath(new URL("culture-monochrome.png", native)))
console.log("Generated matching native icons.")
