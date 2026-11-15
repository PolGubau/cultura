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
