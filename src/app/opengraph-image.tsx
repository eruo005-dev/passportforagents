import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "PassportForAgents — the verified-agent badge & trust API for the open MCP ecosystem";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social preview card (og:image + twitter:image), generated at the edge. */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", fontSize: 36, color: "#a1a1aa" }}>
          passport<span style={{ color: "#fafafa" }}>foragents</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            maxWidth: 980,
          }}
        >
          Is this agent who it claims to be — and is it any good?
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 28,
            color: "#a1a1aa",
          }}
        >
          domain control + Ed25519 = identity · open MIT spec · trust API
        </div>
      </div>
    ),
    size,
  );
}
