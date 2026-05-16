import React from "react";
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from "remotion";
import {fadeUpStyle} from "../lib/animations";

const getLinesWithWordIndexes = (text) => {
  let wordIndex = 0;

  return text.split("\n").map((line) => {
    return line.split(" ").filter(Boolean).map((word) => {
      const payload = {word, index: wordIndex};
      wordIndex += 1;
      return payload;
    });
  });
};

const CaptionCue = ({text, accentColor, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lines = getLinesWithWordIndexes(text);
  const totalWords = lines.flat().length;
  const activeWordIndex =
    totalWords > 0
      ? Math.min(
          totalWords - 1,
          Math.floor((frame / Math.max(1, durationInFrames - 1)) * totalWords),
        )
      : -1;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 176,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          ...fadeUpStyle({frame, fps, delay: 0, distance: 18, durationInFrames: 12}),
          maxWidth: 980,
          padding: "16px 22px",
          borderRadius: 26,
          background:
            "linear-gradient(180deg, rgba(5, 10, 18, 0.8), rgba(5, 10, 18, 0.62))",
          border: `1px solid ${accentColor}44`,
          color: "white",
          fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
          fontSize: 32,
          lineHeight: 1.28,
          fontWeight: 700,
          textAlign: "center",
          boxShadow: "0 16px 42px rgba(0, 0, 0, 0.3)",
        }}
      >
        {lines.map((line, lineIndex) => (
          <div
            key={`${text}-line-${lineIndex}`}
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "0 10px",
            }}
          >
            {line.map(({word, index}) => {
              const isActive = index === activeWordIndex;
              const isPast = index < activeWordIndex;

              return (
                <span
                  key={`${text}-${index}-${word}`}
                  style={{
                    display: "inline-block",
                    padding: isActive ? "2px 8px 4px" : "2px 0 4px",
                    borderRadius: 12,
                    color: isActive
                      ? accentColor
                      : isPast
                        ? "rgba(255,255,255,0.96)"
                        : "rgba(255,255,255,0.62)",
                    backgroundColor: isActive ? `${accentColor}20` : "transparent",
                    boxShadow: isActive ? `0 0 0 1px ${accentColor}44 inset` : "none",
                    transform: isActive ? "translateY(-1px) scale(1.02)" : "translateY(0) scale(1)",
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const CaptionOverlay = ({captions, accentColor, fps}) => {
  if (!captions?.enabled || !captions.cues?.length) {
    return null;
  }

  return (
    <AbsoluteFill>
      {captions.cues.map((cue) => {
        const from = Math.round((cue.fromMs / 1000) * fps);
        const durationInFrames = Math.max(
          1,
          Math.round(((cue.toMs - cue.fromMs) / 1000) * fps),
        );

        return (
          <Sequence key={`${cue.fromMs}-${cue.toMs}-${cue.text}`} from={from} durationInFrames={durationInFrames}>
            <CaptionCue text={cue.text} accentColor={accentColor} durationInFrames={durationInFrames} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
