import { test } from "node:test"
import assert from "node:assert/strict"
import { access } from "node:fs/promises"
import manifest from "../app/manifest.ts"
import { createInstallController } from "../src/features/culture/ui/install-controller.ts"

function promptEvent(outcome: "accepted" | "dismissed", fail = false) {
  const event = new Event("beforeinstallprompt", { cancelable: true })
  let calls = 0
  return {
    event: Object.assign(event, { prompt: () => {
      calls++
      return fail ? Promise.reject(new Error("unavailable")) : Promise.resolve({ outcome })
    } }),
    calls: () => calls,
  }
}

test("captures and consumes the browser install prompt once", async () => {
  const target = new EventTarget()
  const controller = createInstallController(target, () => {})
  const prompt = promptEvent("accepted")
  target.dispatchEvent(prompt.event)
  assert.equal(prompt.event.defaultPrevented, true)
  const result = controller.install()
  assert.equal(prompt.calls(), 1, "prompt is called synchronously from the click")
  assert.equal(await result, "accepted")
  assert.equal(await controller.install(), "unavailable")
  controller.dispose()
})

test("dismissed, unavailable and failed prompts allow manual instructions", async () => {
  const target = new EventTarget()
  const controller = createInstallController(target, () => {})
  assert.equal(await controller.install(), "unavailable")
  target.dispatchEvent(promptEvent("dismissed").event)
  assert.equal(await controller.install(), "dismissed")
  target.dispatchEvent(promptEvent("accepted", true).event)
  assert.equal(await controller.install(), "unavailable")
  controller.dispose()
})

test("installation clears the prompt and disposal removes listeners", async () => {
  const target = new EventTarget()
  let installed = 0
  const controller = createInstallController(target, () => installed++)
  target.dispatchEvent(promptEvent("accepted").event)
  target.dispatchEvent(new Event("appinstalled"))
  assert.equal(installed, 1)
  assert.equal(await controller.install(), "unavailable")
  controller.dispose()
  const next = promptEvent("accepted")
  target.dispatchEvent(next.event)
  target.dispatchEvent(new Event("appinstalled"))
  assert.equal(next.event.defaultPrevented, false)
  assert.equal(installed, 1)
  assert.equal(await controller.install(), "unavailable")
})

test("the installable agenda starts at the public app and has required icons", async () => {
  const app = manifest()
  assert.equal(app.start_url, "/")
  assert.equal(app.scope, "/")
  assert.equal(app.display, "standalone")
  for (const size of ["192x192", "512x512"]) {
    const icon = app.icons?.find((item) => item.sizes === size && item.type === "image/png")
    assert.ok(icon)
    await access(new URL(`../public${icon.src}`, import.meta.url))
  }
})
