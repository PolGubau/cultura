export type InstallResult = "unavailable" | "accepted" | "dismissed"

interface InstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>
}

// The browser's prompt is single-use and must be invoked directly from a click.
export function createInstallController(target: EventTarget, onInstalled: () => void) {
  let prompt: InstallPromptEvent | null = null
  const capture = (event: Event) => {
    event.preventDefault()
    prompt = event as InstallPromptEvent
  }
  const installed = () => {
    prompt = null
    onInstalled()
  }
  target.addEventListener("beforeinstallprompt", capture)
  target.addEventListener("appinstalled", installed)

  return {
    async install(): Promise<InstallResult> {
      const current = prompt
      prompt = null
      if (!current) return "unavailable"
      try {
        return (await current.prompt()).outcome
      } catch {
        return "unavailable"
      }
    },
    dispose() {
      target.removeEventListener("beforeinstallprompt", capture)
      target.removeEventListener("appinstalled", installed)
      prompt = null
    },
  }
}