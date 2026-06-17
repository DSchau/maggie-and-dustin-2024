import React from "react";

// Brand tokens mirrored from src/styles/global.css
const COLORS = {
  bg: "#fafaf9",
  text: "#1c1917",
  muted: "#78716c",
  accent: "#d97706",
  border: "#e7e5e4",
};

// Scale the title down as it gets longer so it always fits nicely.
function titleSize(title: string) {
  const len = title.length;
  if (len <= 18) return 88;
  if (len <= 32) return 74;
  if (len <= 52) return 60;
  if (len <= 80) return 48;
  return 40;
}

function clamp(text: string, max: number) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function Og({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const sub = clamp(subtitle ?? "", 140);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: COLORS.bg,
        position: "relative",
      }}
    >
      {/* Accent bar across the top */}
      <div
        style={{
          display: "flex",
          width: "100%",
          height: 14,
          backgroundColor: COLORS.accent,
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "72px 80px",
          justifyContent: "space-between",
        }}
      >
        {/* Brand eyebrow */}
        <div
          style={{
            display: "flex",
            fontFamily: "Inter",
            fontWeight: 600,
            fontSize: 26,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: COLORS.accent,
          }}
        >
          maggie &amp; dustin
        </div>

        {/* Title + subtitle */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Lora",
              fontWeight: 600,
              fontSize: titleSize(title),
              lineHeight: 1.1,
              color: COLORS.text,
            }}
          >
            {title}
          </div>
          {sub ? (
            <div
              style={{
                display: "flex",
                fontFamily: "Inter",
                fontWeight: 400,
                fontSize: 30,
                lineHeight: 1.4,
                color: COLORS.muted,
                marginTop: 24,
              }}
            >
              {sub}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${COLORS.border}`,
            paddingTop: 24,
            fontFamily: "Inter",
            fontWeight: 400,
            fontSize: 24,
            color: COLORS.muted,
          }}
        >
          <div style={{ display: "flex" }}>maggieanddustin.com</div>
          <div style={{ display: "flex" }}>San Francisco, CA</div>
        </div>
      </div>
    </div>
  );
}
