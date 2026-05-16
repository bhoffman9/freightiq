import React from "react";
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion";
import {Background} from "./Background";
import {LowerThird} from "./LowerThird";

export const SceneFrame = ({
  eyebrow,
  brandName,
  accentColor,
  secondaryColor,
  backgroundColor,
  lowerThird,
  children,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill>
      <Background
        accentColor={accentColor}
        secondaryColor={secondaryColor}
        backgroundColor={backgroundColor}
      />
      <AbsoluteFill
        style={{
          padding: "78px 86px",
          color: "white",
          fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 36,
          }}
        >
          <div
            style={{
              fontSize: 22,
              letterSpacing: 5,
              textTransform: "uppercase",
              color: accentColor,
              fontWeight: 700,
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              fontSize: 20,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.72)",
              fontWeight: 700,
            }}
          >
            {brandName}
          </div>
        </div>
        <div style={{flex: 1, display: "flex", flexDirection: "column"}}>{children}</div>
        <LowerThird lowerThird={lowerThird} accentColor={accentColor} frame={frame} fps={fps} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
