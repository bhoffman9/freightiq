import React from "react";
import {useCurrentFrame, useVideoConfig} from "remotion";
import {DashboardPreviewCard} from "../components/DashboardPreviewCard";
import {fadeUpStyle, popInStyle} from "../lib/animations";
import {SceneFrame} from "../components/SceneFrame";

export const FeatureGridScene = (props) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const featurePreviews = props.previews?.features ?? [];

  return (
    <SceneFrame eyebrow="What The Product Does" lowerThird={props.lowerThirds?.features} {...props}>
      <div
        style={{
          ...fadeUpStyle({frame, fps}),
          fontSize: 58,
          lineHeight: 0.98,
          fontWeight: 800,
          maxWidth: 780,
          marginBottom: 22,
        }}
      >
        Three views. One tight workflow.
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 0.9fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div style={{display: "grid", gap: 14}}>
          {props.features.map((feature, index) => (
            <div
              key={feature.title}
              style={{
                ...popInStyle({frame, fps, delay: 8 + index * 5}),
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 24,
                padding: "20px 22px",
                minHeight: 118,
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: index % 2 === 0 ? props.accentColor : props.secondaryColor,
                  marginBottom: 12,
                  fontWeight: 700,
                }}
              >
                0{index + 1}
              </div>
              <div
                style={{
                  fontSize: 28,
                  lineHeight: 1.04,
                  fontWeight: 800,
                  marginBottom: 8,
                  maxWidth: 380,
                }}
              >
                {feature.title}
              </div>
              <div
                style={{
                  ...fadeUpStyle({frame, fps, delay: 12 + index * 5}),
                  fontSize: 18,
                  lineHeight: 1.28,
                  color: "rgba(255,255,255,0.74)",
                  maxWidth: 420,
                }}
              >
                {feature.detail}
              </div>
            </div>
          ))}
        </div>
        <div style={{display: "grid", gap: 14}}>
          {featurePreviews.slice(0, 2).map((preview, index) => (
            <DashboardPreviewCard
              key={`${preview.route}-${preview.title}`}
              preview={preview}
              frame={frame}
              fps={fps}
              delay={14 + index * 6}
              compact
              imageHeight={174}
            />
          ))}
        </div>
      </div>
    </SceneFrame>
  );
};
