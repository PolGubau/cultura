/** Share only in-flight work, never persist data or failures in process memory. */
export function coalesce<T>(load: (key: string) => Promise<T>) {
  const pending = new Map<string, Promise<T>>()
  return (key: string): Promise<T> => {
    const existing = pending.get(key)
    if (existing) return existing
    const request = Promise.resolve()
      .then(() => load(key))
      .finally(() => {
        pending.delete(key)
      })
    pending.set(key, request)
    return request
  }
}
