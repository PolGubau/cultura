import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const git = (args, cwd = root) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim()

test("both projects and their shared source belong to one repository", () => {
  const top = git(["rev-parse", "--show-toplevel"])
  for (const app of ["app", "landing"]) {
    assert.equal(git(["rev-parse", "--show-toplevel"], resolve(root, app)), top)
  }
  const files = readdirSync(resolve(root, "shared/culture")).filter((name) => name.endsWith(".ts"))
  assert.ok(files.length > 0)
  const tracked = new Set(git(["ls-files", "shared/culture"]).split("\n"))
  for (const file of files) assert.ok(tracked.has(`shared/culture/${file}`), `${file} is not tracked`)
  const entries = git(["ls-files", "--stage", "app", "landing"]).split("\n")
  assert.ok(entries.length > 2)
  assert.ok(entries.every((entry) => !entry.startsWith("160000 ")), "applications must not be gitlinks")
})

test("local secrets and original Git backups are ignored", () => {
  for (const path of [".legacy-git/app.git/config", "app/.env.production", "app/google-play-key.json", "landing/.env.local"]) {
    const result = spawnSync("git", ["check-ignore", "--no-index", "-q", path], { cwd: root })
    assert.equal(result.status, 0, `${path} must be ignored`)
  }
  const template = spawnSync("git", ["check-ignore", "--no-index", "-q", "app/.env.example"], { cwd: root })
  assert.equal(template.status, 1, "the example configuration must remain available")
})