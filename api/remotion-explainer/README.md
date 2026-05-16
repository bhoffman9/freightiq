# Remotion Explainer Starter

A minimal Remotion starter for turning project details into polished explainer videos.

## What is included

- One `ProjectExplainer` composition
- Reusable scenes for intro, problem/solution, features, metrics, and CTA
- Zod schema validation for props
- Dynamic duration based on how much content you pass in
- A sample JSON props file to clone per project
- Optional voiceover support through `public/audio/*.mp3`
- Burned-in caption support driven by timed cue data

## Install

```bash
npm install
```

## Preview in Remotion Studio

```bash
npm run dev
```

## Render the sample video

```bash
npm run render
```

## Render the `vol-dashboard-codex` test case

```bash
npm run render:vol-dashboard
```

## How to customize

1. Edit [src/data/sample-props.json](./src/data/sample-props.json).
2. Replace copy, metrics, and feature bullets with your project details.
3. Render again.

There is also a repo-grounded example at [src/data/vol-dashboard-codex.json](./src/data/vol-dashboard-codex.json).

## Voiceover and captions

The `vol-dashboard-codex` example now includes:

- A polished narration script at [docs/vol-dashboard-codex-voiceover-script.md](./docs/vol-dashboard-codex-voiceover-script.md)
- Timed captions baked into [src/data/vol-dashboard-codex.json](./src/data/vol-dashboard-codex.json)
- An optional voiceover hook that looks for `public/audio/vol-dashboard-codex-voiceover.mp3`
- Scene-specific lower thirds and dashboard preview metadata in the same JSON file
- Premium preview assets in [public/dashboard-previews](./public/dashboard-previews)

To turn narration on:

1. Put your recorded file at `public/audio/vol-dashboard-codex-voiceover.mp3`
2. In `src/data/vol-dashboard-codex.json`, switch `"voiceover.enabled"` from `false` to `true`
3. Render again with `npm run render:vol-dashboard`

## Suggested workflow for real projects

1. Duplicate `sample-props.json` into a new project-specific JSON file.
2. Drop in your actual problem statement, outcomes, and CTA.
3. Add voiceover and captions next once the motion language feels right.
4. Create alternate compositions only after the base template is proving reusable.

## Project structure

```text
src/
  components/
  data/
  lib/
  scenes/
  index.jsx
  ProjectExplainer.jsx
  Root.jsx
  schema.js
```
