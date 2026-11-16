import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { setTimeout as delay } from "node:timers/promises"

const cwd = fileURLToPath(new URL("../../", import.meta.url))
const next = fileURLToPath(
  new URL("../../node_modules/next/dist/bin/next", import.meta.url)
)

export function localOrigin(value = "http://127.0.0.1:3107") {
  const origin = new URL(value)
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname))
  assert.equal(origin.protocol, "http:")
  assert.equal(origin.username, "")
  assert.equal(origin.password, "")
  assert.equal(origin.pathname, "/")
  assert.equal(origin.search, "")
  return origin
}

// Never echo child output: a misconfigured upstream could include sensitive data.
export async function buildLocal(env) {
  const child = spawn(process.execPath, [next, "build"], {
    cwd,
    env,
    stdio: "ignore",
  })
  await new Promise((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Local fixture build failed."))
    )
  })
}

export async function startLocal(origin, env = process.env) {
  const child = spawn(
    process.execPath,
    [
      next,
      "start",
      "--hostname",
      origin.hostname,
      "--port",
      origin.port || "80",
    ],
    {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    }
  )
  let ready = false
  let failed = false
  child.on("error", () => {
    failed = true
  })
  child.stdout.on("data", (chunk) => {
    if (chunk.toString().includes("Ready")) ready = true
  })
  child.stderr.resume()
  const stop = () => child.kill()
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (failed || child.exitCode !== null)
        throw new Error("Local server failed to start.")
      if (ready) return stop
      await delay(100)
    }
    throw new Error("Local server startup timed out.")
  } catch (error) {
    stop()
    throw error
  }
}
