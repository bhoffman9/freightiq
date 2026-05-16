import {interpolate, spring} from "remotion";

export const springProgress = ({
  frame,
  fps,
  delay = 0,
  durationInFrames = 28,
  damping = 200,
}) => {
  return spring({
    fps,
    frame: frame - delay,
    durationInFrames,
    config: {
      damping,
      stiffness: 120,
      mass: 0.9,
    },
  });
};

export const fadeUpStyle = ({
  frame,
  fps,
  delay = 0,
  distance = 36,
  durationInFrames = 28,
}) => {
  const progress = springProgress({frame, fps, delay, durationInFrames});

  return {
    opacity: interpolate(progress, [0, 1], [0, 1]),
    transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`,
  };
};

export const popInStyle = ({frame, fps, delay = 0}) => {
  const progress = springProgress({
    frame,
    fps,
    delay,
    durationInFrames: 32,
    damping: 160,
  });

  return {
    opacity: interpolate(progress, [0, 1], [0, 1]),
    transform: `scale(${interpolate(progress, [0, 1], [0.92, 1])})`,
  };
};
