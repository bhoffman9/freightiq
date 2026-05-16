import React from "react";
import {Series, useVideoConfig} from "remotion";
import {CaptionOverlay} from "./components/CaptionOverlay";
import {NarrationAudio} from "./components/NarrationAudio";
import {getSceneDurations, getTotalDuration} from "./lib/durations";
import {ClosingScene} from "./scenes/ClosingScene";
import {FeatureGridScene} from "./scenes/FeatureGridScene";
import {MetricsScene} from "./scenes/MetricsScene";
import {ProblemSolutionScene} from "./scenes/ProblemSolutionScene";
import {TitleScene} from "./scenes/TitleScene";

export const ProjectExplainer = (props) => {
  const {fps} = useVideoConfig();
  const durations = getSceneDurations(props);
  const totalDurationInFrames = getTotalDuration(props);

  return (
    <>
      <NarrationAudio voiceover={props.voiceover} totalDurationInFrames={totalDurationInFrames} />
      <Series>
        <Series.Sequence durationInFrames={durations.intro}>
          <TitleScene {...props} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={durations.problemSolution}>
          <ProblemSolutionScene {...props} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={durations.features}>
          <FeatureGridScene {...props} />
        </Series.Sequence>
        {durations.metrics > 0 ? (
          <Series.Sequence durationInFrames={durations.metrics}>
            <MetricsScene {...props} />
          </Series.Sequence>
        ) : null}
        <Series.Sequence durationInFrames={durations.outro}>
          <ClosingScene {...props} />
        </Series.Sequence>
      </Series>
      <CaptionOverlay captions={props.captions} accentColor={props.accentColor} fps={fps} />
    </>
  );
};
