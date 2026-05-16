import React from "react";
import {Html5Audio, interpolate, staticFile} from "remotion";

export const NarrationAudio = ({voiceover, totalDurationInFrames}) => {
  if (!voiceover?.enabled || !voiceover.src) {
    return null;
  }

  const fadeInFrames = voiceover.fadeInFrames ?? 12;
  const fadeOutFrames = voiceover.fadeOutFrames ?? 18;
  const baseVolume = voiceover.volume ?? 1;

  return (
    <Html5Audio
      name="Voiceover"
      src={staticFile(voiceover.src)}
      volume={(frame) => {
        const fadeIn = interpolate(frame, [0, fadeInFrames], [0, baseVolume], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const fadeOut = interpolate(
          frame,
          [Math.max(0, totalDurationInFrames - fadeOutFrames), totalDurationInFrames],
          [baseVolume, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        );

        return Math.min(fadeIn, fadeOut);
      }}
    />
  );
};
