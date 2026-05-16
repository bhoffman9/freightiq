import React from "react";
import {fadeUpStyle} from "../lib/animations";

export const LowerThird = ({lowerThird, accentColor, frame, fps}) => {
  if (!lowerThird) {
    return null;
  }

  return (
    <div
      style={{
        ...fadeUpStyle({frame, fps, delay: 10, distance: 24, durationInFrames: 20}),
        display: "flex",
        alignItems: "stretch",
        gap: 18,
        marginTop: 26,
        padding: "18px 20px",
        borderRadius: 26,
        backgroundColor: "rgba(5, 10, 18, 0.55)",
        border: `1px solid ${accentColor}40`,
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.22)",
      }}
    >
      <div
        style={{
          width: 5,
          borderRadius: 999,
          background: `linear-gradient(180deg, ${accentColor}, rgba(255,255,255,0.24))`,
          flexShrink: 0,
        }}
      />
      <div style={{flex: 1, display: "flex", flexDirection: "column", gap: 8}}>
        <div
          style={{
            fontSize: 14,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: accentColor,
            fontWeight: 700,
          }}
        >
          {lowerThird.eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{fontSize: 28, lineHeight: 1.05, fontWeight: 800}}>
            {lowerThird.title}
          </div>
          {lowerThird.route ? (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                backgroundColor: `${accentColor}18`,
                border: `1px solid ${accentColor}38`,
                fontSize: 16,
                color: accentColor,
                fontWeight: 700,
              }}
            >
              {lowerThird.route}
            </div>
          ) : null}
        </div>
        <div
          style={{
            fontSize: 19,
            lineHeight: 1.35,
            color: "rgba(255,255,255,0.72)",
            maxWidth: 860,
          }}
        >
          {lowerThird.detail}
        </div>
      </div>
    </div>
  );
};
