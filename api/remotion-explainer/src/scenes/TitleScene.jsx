import React from "react";
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion";
import {DashboardPreviewCard} from "../components/DashboardPreviewCard";
import {fadeUpStyle, popInStyle} from "../lib/animations";
import {SceneFrame} from "../components/SceneFrame";

export const TitleScene = (props) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const heroPreview = props.previews?.title?.[0];
  const titleStats =
    props.metrics?.length > 0
      ? props.metrics.slice(0, 3).map(({label, value}) => ({label, value}))
      : [
          {label: "Problems", value: String(props.problemPoints.length)},
          {label: "Features", value: String(props.features.length)},
          {label: "Metrics", value: String(props.metrics.length)},
        ];

  return (
    <SceneFrame eyebrow="Project Explainer" lowerThird={props.lowerThirds?.title} {...props}>
      <AbsoluteFill>
        <div style={{display: "grid", gridTemplateColumns: heroPreview ? "1.05fr 0.95fr" : "1fr", gap: 22}}>
          <div>
            <div
              style={{
                ...fadeUpStyle({frame, fps, delay: 0}),
                display: "inline-flex",
                padding: "9px 16px",
                borderRadius: 999,
                backgroundColor: `${props.secondaryColor}20`,
                border: `1px solid ${props.secondaryColor}55`,
                fontSize: 20,
                letterSpacing: 1,
                color: props.secondaryColor,
                marginBottom: 22,
              }}
            >
              {props.audience}
            </div>
            <div
              style={{
                ...fadeUpStyle({frame, fps, delay: 8}),
                fontSize: 82,
                lineHeight: 0.95,
                fontWeight: 800,
                maxWidth: 700,
              }}
            >
              {props.projectName}
            </div>
            <div
              style={{
                ...fadeUpStyle({frame, fps, delay: 16}),
                fontSize: 28,
                lineHeight: 1.28,
                color: "rgba(255,255,255,0.82)",
                maxWidth: 680,
                marginTop: 22,
              }}
            >
              {props.oneLiner}
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 22,
              }}
            >
              {titleStats.map((item, index) => (
                <div
                  key={item.label}
                  style={{
                    ...popInStyle({frame, fps, delay: 18 + index * 4}),
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 28,
                      lineHeight: 0.95,
                      fontWeight: 800,
                    }}
                  >
                    {item.value}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {heroPreview ? (
            <div style={{display: "flex", alignItems: "flex-start", justifyContent: "flex-end"}}>
              <div style={{width: 520}}>
                <DashboardPreviewCard
                  preview={heroPreview}
                  frame={frame}
                  fps={fps}
                  delay={14}
                  imageHeight={276}
                />
              </div>
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
