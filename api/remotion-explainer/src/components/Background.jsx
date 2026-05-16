import React from "react";
import {AbsoluteFill} from "remotion";

export const Background = ({accentColor, secondaryColor, backgroundColor}) => {
  return (
    <AbsoluteFill
      style={{
        background: [
          `radial-gradient(circle at 18% 18%, ${accentColor}33 0%, transparent 30%)`,
          `radial-gradient(circle at 82% 24%, ${secondaryColor}22 0%, transparent 28%)`,
          `linear-gradient(145deg, ${backgroundColor} 0%, #02060d 55%, #091729 100%)`,
        ].join(", "),
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 48,
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 28,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 120,
          right: 100,
          width: 220,
          height: 220,
          borderRadius: "50%",
          border: `2px solid ${secondaryColor}44`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 110,
          left: 86,
          width: 300,
          height: 300,
          borderRadius: 36,
          border: `2px solid ${accentColor}26`,
          transform: "rotate(22deg)",
        }}
      />
    </AbsoluteFill>
  );
};
