import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Mataró Cultura · La cultura de la ciutat, tot l’any"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: "#9f1239",
        color: "white",
      }}
    >
      <div style={{ fontSize: 30, marginBottom: 36 }}>AGENDA CULTURAL</div>
      <div style={{ fontSize: 94, fontWeight: 700 }}>Mataró · Cultura</div>
      <div style={{ fontSize: 38, marginTop: 36 }}>
        La cultura de la ciutat, tot l’any.
      </div>
    </div>,
    { ...size }
  )
}
