import React from "react";
import {Composition} from "remotion";
import {ProjectExplainer} from "./ProjectExplainer";
import {getTotalDuration} from "./lib/durations";
import {defaultExplainerProps, projectExplainerSchema} from "./schema";

const calculateMetadata = ({props}) => {
  return {
    durationInFrames: getTotalDuration(props),
  };
};

export const RemotionRoot = () => {
  return (
    <Composition
      id="ProjectExplainer"
      component={ProjectExplainer}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={300}
      defaultProps={defaultExplainerProps}
      schema={projectExplainerSchema}
      calculateMetadata={calculateMetadata}
    />
  );
};
