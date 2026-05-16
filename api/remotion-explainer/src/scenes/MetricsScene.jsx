import React from "react";
import {useCurrentFrame, useVideoConfig} from "remotion";
import {DashboardPreviewCard} from "../components/DashboardPreviewCard";
import {fadeUpStyle, popInStyle} from "../lib/animations";
import {SceneFrame} from "../components/SceneFrame";

export const MetricsScene = (props) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const metricPreviews = props.previews?.metrics ?? [];

  return (
    <SceneFrame eyebrow="Why It Matters" lowerThird={props.lowerThirds?.metrics} {...props}>
      <div
        style={{
          ...fadeUpStyle({frame, fps}),
          fontSize: 56,
          lineHeight: 0.98,
          fontWeight: 800,
          maxWidth: 620,
          marginBottom: 20,
        }}
      >
        Finish on proof.
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: props.metrics.length > 2 ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
          gap: 16,
        }}
      >
        {props.metrics.map((metric, index) => (
          <div
            key={metric.label}
            style={{
              ...popInStyle({frame, fps, delay: 8 + index * 5}),
              background: `linear-gradient(145deg, rgba(255,255,255,0.08), ${
                index % 2 === 0 ? `${props.accentColor}20` : `${props.secondaryColor}18`
              })`,
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 24,
              padding: "22px 22px",
              minHeight: 186,
            }}
          >
            <div
              style={{
                fontSize: 14,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.62)",
                marginBottom: 10,
              }}
            >
              {metric.label}
            </div>
            <div
              style={{
                fontSize: 48,
                lineHeight: 0.95,
                fontWeight: 800,
                marginBottom: 10,
              }}
            >
              {metric.value}
            </div>
            <div
              style={{
                ...fadeUpStyle({frame, fps, delay: 14 + index * 5}),
                fontSize: 17,
                lineHeight: 1.24,
                color: "rgba(255,255,255,0.78)",
              }}
            >
              {metric.detail}
            </div>
          </div>
        ))}
      </div>
      {metricPreviews.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            marginTop: 18,
          }}
        >
          {metricPreviews.slice(0, 1).map((preview, index) => (
            <DashboardPreviewCard
              key={`${preview.route}-${preview.title}`}
              preview={preview}
              frame={frame}
              fps={fps}
              delay={20 + index * 5}
              compact
              imageHeight={154}
            />
          ))}
        </div>
      ) : null}
    </SceneFrame>
  );
};
