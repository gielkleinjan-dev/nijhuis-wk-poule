import { ImageResponse } from "next/og";

// Open Graph image — wat verschijnt als preview-card wanneer iemand de
// link deelt in WhatsApp, Teams, mail of social media. Wordt door Next
// automatisch gelinkt via <meta property="og:image"> en
// <meta name="twitter:image">.

export const alt = "WK Poule Nijhuis — voorspel het WK 2026";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
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
          fontFamily: "system-ui, sans-serif",
          color: "#fff",
          background:
            "radial-gradient(ellipse 60% 50% at 22% 18%, rgba(255,255,255,0.18) 0%, transparent 60%), linear-gradient(135deg, #d0343e 0%, #c2303a 50%, #a8252e 100%)",
          position: "relative",
        }}
      >
        {/* Premium accent-streep onderaan, parallel aan de hero in de app */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "6px",
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 25%, #e8b730 75%, transparent 100%)",
          }}
        />

        {/* Pulse-dot badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: "rgba(255,255,255,0.15)",
            border: "2px solid rgba(255,255,255,0.3)",
            borderRadius: "9999px",
            padding: "8px 20px",
            fontSize: "22px",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: "32px",
            alignSelf: "flex-start",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "9999px",
              background: "#e8b730",
            }}
          />
          WK 2026 · 11 juni – 19 juli
        </div>

        {/* Hoofdtitel */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: "104px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.0,
            marginBottom: "32px",
          }}
        >
          <div>De Nijhuis Bouw</div>
          <div style={{ color: "#e8b730" }}>WK Poule</div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: "30px",
            fontWeight: 500,
            color: "rgba(255,255,255,0.9)",
            maxWidth: "850px",
            lineHeight: 1.3,
          }}
        >
          Voorspel alle 104 wedstrijden. Volg je stand live tijdens het toernooi.
        </div>

        {/* Stats-rij onderin */}
        <div
          style={{
            display: "flex",
            gap: "40px",
            marginTop: "40px",
            fontSize: "26px",
            fontWeight: 700,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
            <span style={{ color: "#e8b730", fontSize: "44px" }}>48</span>
            <span>landen</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
            <span style={{ color: "#e8b730", fontSize: "44px" }}>104</span>
            <span>wedstrijden</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
            <span style={{ color: "#e8b730", fontSize: "44px" }}>1</span>
            <span>winnaar</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
