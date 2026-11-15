/* No HTML injection: all event content is rendered through textContent. */
;(async () => {
  const status = document.getElementById("status")
  const list = document.getElementById("events")
  const periods = document.getElementById("period")
  const favoritesButton = document.getElementById("favorites")
  let favoritesOnly = location.pathname === "/favorits"
  let preferences = { favorites: [], locale: "ca" }
  try {
    preferences = {
      ...preferences,
      ...JSON.parse(
        localStorage.getItem("mataro-culture:preferences:v1") || "{}"
      ),
    }
  } catch {
    /* read-only fallback */
  }
  const catalogs = []
  function element(tag, text, parent) {
    const node = document.createElement(tag)
    node.textContent = text
    parent.append(node)
    return node
  }
  function render() {
    const data = catalogs[Number(periods.value)]
    list.replaceChildren()
    favoritesButton.setAttribute("aria-pressed", String(favoritesOnly))
    if (!data) {
      status.textContent =
        "Encara no hi ha cap agenda guardada. Obre l’agenda amb connexió una primera vegada."
      return
    }
    const linkedId = location.pathname.startsWith("/actes/")
      ? location.pathname.split("/")[2]
      : null
    let events = data.events
    if (favoritesOnly)
      events = events.filter(
        (event) =>
          Array.isArray(preferences.favorites) &&
          preferences.favorites.includes(event.id)
      )
    if (linkedId) events = events.filter((event) => event.id === linkedId)
    status.textContent = `${events.length} actes. Còpia del ${new Date(data.fetchedAt).toLocaleString("ca")}. El mapa i les imatges no estan disponibles offline.`
    for (const event of events) {
      const text =
        event.translations[preferences.locale] || event.translations.ca
      const article = element("article", "", list)
      element("h2", text.title, article)
      if (event.status === "cancelled")
        element("strong", `Cancel·lat: ${event.cancellation_reason}`, article)
      const format = (date) =>
        new Date(date).toLocaleString("ca", { timeZone: data.city.timezone })
      element(
        "p",
        `${format(event.starts_at)} — ${format(event.ends_at)}`,
        article
      )
      const place = data.places.find((item) => item.id === event.place_id)
      if (place) element("p", `${place.name} · ${place.address}`, article)
      element("p", text.summary, article)
      const detail = element("details", "", article)
      element("summary", "Més informació", detail)
      element(
        "pre",
        [
          text.description,
          event.schedule_notes,
          event.accessibility,
          event.price,
        ]
          .filter(Boolean)
          .join("\n\n"),
        detail
      )
    }
    if (!events.length)
      element("p", "No hi ha actes guardats per a aquesta selecció.", list)
  }
  try {
    const cache = await caches.open("culture-v1-data")
    for (const request of await cache.keys()) {
      const response = await cache.match(request)
      const result = await response.json()
      if (result.data) catalogs.push(result.data)
    }
    catalogs.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))
    const linkedId = location.pathname.startsWith("/actes/")
      ? location.pathname.split("/")[2]
      : null
    if (linkedId)
      catalogs.sort(
        (a, b) =>
          Number(b.events.some((event) => event.id === linkedId)) -
          Number(a.events.some((event) => event.id === linkedId))
      )
    catalogs.forEach((data, index) => {
      const option = element("option", `${data.from} — ${data.to}`, periods)
      option.value = String(index)
    })
    periods.addEventListener("change", render)
    favoritesButton.addEventListener("click", () => {
      favoritesOnly = !favoritesOnly
      render()
    })
    render()
  } catch {
    status.textContent =
      "No es poden llegir les dades guardades. Comprova la connexió per tornar a l’agenda."
  }
})()
