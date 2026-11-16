export function registerCultureServiceWorker() {
  if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {})
  }
}