import React from "react";
import {useCurrentFrame, useVideoConfig} from "remotion";
import {fadeUpStyle, popInStyle} from "../lib/animations";
import {SceneFrame} from "../components/SceneFrame";

const ListCard = ({title, items, frame, fps, delay, accentColor}) => {
  return (
    <div
      style={{
        ...popInStyle({frame, fps, delay}),
        flex: 1,
        backgroundColor: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 30,
        padding: "26px 28px",
      }}
    >
      <div
        style={{
          fontSize: 18,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: accentColor,
          marginBottom: 18,
          fontWeight: 700,
        }}
      >
        {title}
      </div>
      <div style={{display: "flex", flexDirection: "column", gap: 14}}>
        {items.map((item, index) => (
          <div
            key={item}
            style={{
              ...fadeUpStyle({frame, fps, delay: delay + 6 + index * 4}),
              display: "flex",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                marginTop: 10,
                borderRadius: "50%",
                backgroundColor: accentColor,
                flexShrink: 0,
              }}
            />
            <div style={{fontSize: 24, lineHeight: 1.24, color: "rgba(255,255,255,0.88)"}}>
              {item}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ProblemSolutionScene = (props) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <SceneFrame eyebrow="From Friction To Clarity" lowerThird={props.lowerThirds?.problemSolution} {...props}>
      <div style={{marginTop: 24}}>
        <div
          style={{
            ...fadeUpStyle({frame, fps}),
            fontSize: 64,
            lineHeight: 0.98,
            fontWeight: 800,
            maxWidth: 860,
            marginBottom: 28,
          }}
        >
          Show the drift. Then show the fix.
        </div>
        <div style={{display: "flex", gap: 20, flex: 1}}>
          <ListCard
            title="Before"
            items={props.problemPoints}
            frame={frame}
            fps={fps}
            delay={6}
            accentColor={props.accentColor}
          />
          <ListCard
            title="After"
            items={props.solutionPoints}
            frame={frame}
            fps={fps}
            delay={12}
            accentColor={props.secondaryColor}
          />
        </div>
      </div>
    </SceneFrame>
  );
};
