import "server-only"
import { unstable_cache } from "next/cache"
import { gzip, gunzip } from "node:zlib"
import { promisify } from "node:util"
import { CITY_ID } from "./config"
import { coalesce } from "./coalesce"

export const PUBLIC_CACHE_TAG = `culture-public:${CITY_ID}`
export const PUBLIC_HTTP_CACHE =
  "public, max-age=0, s-maxage=15, stale-while-revalidate=15"
const compress = promisify(gzip)
const decompress = promisify(gunzip)

/** Anonymous data only. Failures must throw so they cannot replace a good snapshot. */
export function cachePublicJson<T>(
  name: string,
  load: (key: string) => Promise<T>
) {
  const cached = unstable_cache(
    coalesce(async (key: string) => {
      // Next's data cache has a per-entry size limit. Offline catalogs include
      // descriptions in three languages; store compressed JSON, not duplicated prose.
      const data = await compress(JSON.stringify(await load(key)), { level: 1 })
      return data.toString("base64")
    }),
    [name, CITY_ID, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "unconfigured"],
    { revalidate: 30, tags: [PUBLIC_CACHE_TAG] }
  )
  return coalesce(async (key: string): Promise<T> => {
    const data = await decompress(Buffer.from(await cached(key), "base64"))
    return JSON.parse(data.toString("utf8")) as T
  })
}
