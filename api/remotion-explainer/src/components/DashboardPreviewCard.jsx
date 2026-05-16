import React from "react";
import {Img, interpolate, staticFile} from "remotion";
import {popInStyle} from "../lib/animations";

export const DashboardPreviewCard = ({
  preview,
  frame,
  fps,
  delay = 0,
  compact = false,
  imageHeight = 220,
}) => {
  if (!preview) {
    return null;
  }

  const floatY = Math.sin((frame + delay * 3) / 18) * 4;
  const shadowOpacity = interpolate(frame, [0, 24], [0.16, 0.28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        ...popInStyle({frame, fps, delay}),
        borderRadius: compact ? 22 : 28,
        backgroundColor: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: `0 24px 60px rgba(0, 0, 0, ${shadowOpacity})`,
        overflow: "hidden",
      }}
    >
      <div style={{transform: `translateY(${floatY}px)`}}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: compact ? "12px 14px 10px" : "14px 16px 12px",
          }}
        >
          <div style={{display: "flex", gap: 8, alignItems: "center"}}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: "#ff7a66",
                display: "inline-block",
              }}
            />
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: "#f5c04f",
                display: "inline-block",
              }}
            />
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: "#54d587",
                display: "inline-block",
              }}
            />
          </div>
          <div
            style={{
              fontSize: compact ? 12 : 13,
              fontWeight: 700,
              color: "rgba(255,255,255,0.56)",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Dashboard Preview
          </div>
        </div>
        <div
          style={{
            margin: compact ? "0 12px" : "0 14px",
            borderRadius: compact ? 18 : 22,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.09)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
          }}
        >
          <Img
            src={staticFile(preview.src)}
            style={{
              width: "100%",
              height: imageHeight,
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
        <div style={{padding: compact ? "12px 14px 14px" : "14px 18px 18px"}}>
          <div
            style={{
              display: "inline-flex",
              padding: compact ? "6px 10px" : "7px 12px",
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "rgba(255,255,255,0.68)",
              fontSize: compact ? 11 : 12,
              fontWeight: 700,
              letterSpacing: 1.4,
              marginBottom: compact ? 8 : 10,
            }}
          >
            {preview.route}
          </div>
          <div
            style={{
              fontSize: compact ? 20 : 30,
              lineHeight: 1.05,
              fontWeight: 800,
              marginBottom: compact ? 8 : 10,
            }}
          >
            {preview.title}
          </div>
          <div
            style={{
              fontSize: compact ? 16 : 20,
              lineHeight: 1.35,
              color: "rgba(255,255,255,0.72)",
            }}
          >
            {preview.detail}
          </div>
        </div>
      </div>
    </div>
  );
};
