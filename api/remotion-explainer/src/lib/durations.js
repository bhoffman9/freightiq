export const INTRO_DURATION = 105;
export const OUTRO_DURATION = 90;

export const getSceneDurations = (props) => {
  if (props.sceneDurations) {
    return props.sceneDurations;
  }

  const problemDuration = 90 + props.problemPoints.length * 12;
  const featureDuration = 105 + props.features.length * 14;
  const metricDuration = props.metrics.length > 0 ? 90 + props.metrics.length * 10 : 0;

  return {
    intro: INTRO_DURATION,
    problemSolution: problemDuration,
    features: featureDuration,
    metrics: metricDuration,
    outro: OUTRO_DURATION,
  };
};

export const getTotalDuration = (props) => {
  const durations = getSceneDurations(props);
  return Object.values(durations).reduce((sum, duration) => sum + duration, 0);
};
