import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "MFM Sport";
  const category = searchParams.get("category") || "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "60px",
          background: "linear-gradient(135deg, #0E0E10 0%, #1A1A1D 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand */}
        <div
          style={{
            position: "absolute",
            top: "40px",
            left: "60px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "32px", fontWeight: 700, color: "#D92332" }}>
            MFM
          </span>
          <span style={{ fontSize: "32px", fontWeight: 700, color: "#F5F5F5" }}>
            Sport
          </span>
        </div>

        {/* Category badge */}
        {category && (
          <div
            style={{
              display: "flex",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                background: "#D92332",
                color: "white",
                padding: "6px 16px",
                borderRadius: "6px",
                fontSize: "20px",
                fontWeight: 600,
              }}
            >
              {category}
            </span>
          </div>
        )}

        {/* Title */}
        <div
          style={{
            fontSize: "52px",
            fontWeight: 700,
            color: "#F5F5F5",
            lineHeight: 1.2,
            display: "flex",
            maxWidth: "900px",
          }}
        >
          {title.length > 100 ? title.slice(0, 97) + "..." : title}
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "#D92332",
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
