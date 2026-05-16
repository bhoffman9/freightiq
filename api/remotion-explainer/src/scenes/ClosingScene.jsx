import React from "react";
import {useCurrentFrame, useVideoConfig} from "remotion";
import {fadeUpStyle, popInStyle} from "../lib/animations";
import {SceneFrame} from "../components/SceneFrame";

export const ClosingScene = (props) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <SceneFrame eyebrow="Call To Action" lowerThird={props.lowerThirds?.outro} {...props}>
      <div style={{display: "flex", gap: 30, flex: 1, alignItems: "flex-end"}}>
        <div style={{flex: 1}}>
          <div
            style={{
              ...fadeUpStyle({frame, fps}),
              fontSize: 72,
              lineHeight: 0.95,
              fontWeight: 800,
              maxWidth: 780,
            }}
          >
            {props.ctaTitle}
          </div>
          <div
            style={{
              ...fadeUpStyle({frame, fps, delay: 10}),
              fontSize: 27,
              lineHeight: 1.28,
              color: "rgba(255,255,255,0.84)",
              maxWidth: 700,
              marginTop: 22,
            }}
          >
            {props.ctaBody}
          </div>
        </div>
        <div
          style={{
            ...popInStyle({frame, fps, delay: 18}),
            width: 360,
            backgroundColor: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 28,
            padding: "24px 26px",
            alignSelf: "stretch",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 18,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: props.secondaryColor,
            }}
          >
            Next step
          </div>
          <div style={{fontSize: 40, lineHeight: 1.04, fontWeight: 800}}>
            Share the story with stakeholders.
          </div>
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 18,
              backgroundColor: `${props.accentColor}18`,
              border: `1px solid ${props.accentColor}44`,
              fontSize: 21,
              color: props.accentColor,
            }}
          >
            {props.website}
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};
