import {zColor} from "@remotion/zod-types";
import {z} from "zod";

const statSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  detail: z.string().min(1),
});

const featureSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
});

const captionCueSchema = z.object({
  fromMs: z.number().nonnegative(),
  toMs: z.number().positive(),
  text: z.string().min(1),
});

const sceneDurationsSchema = z.object({
  intro: z.number().int().positive(),
  problemSolution: z.number().int().positive(),
  features: z.number().int().positive(),
  metrics: z.number().int().nonnegative(),
  outro: z.number().int().positive(),
});

const voiceoverSchema = z.object({
  enabled: z.boolean(),
  src: z.string().min(1),
  volume: z.number().positive().max(1.5).default(1),
  fadeInFrames: z.number().int().nonnegative().default(12),
  fadeOutFrames: z.number().int().nonnegative().default(18),
});

const captionsSchema = z.object({
  enabled: z.boolean(),
  cues: z.array(captionCueSchema),
});

const lowerThirdSchema = z.object({
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
  route: z.string().min(1).optional(),
});

const previewSchema = z.object({
  src: z.string().min(1),
  title: z.string().min(1),
  route: z.string().min(1),
  detail: z.string().min(1),
});

const lowerThirdsSchema = z
  .object({
    title: lowerThirdSchema.optional(),
    problemSolution: lowerThirdSchema.optional(),
    features: lowerThirdSchema.optional(),
    metrics: lowerThirdSchema.optional(),
    outro: lowerThirdSchema.optional(),
  })
  .partial();

const previewsSchema = z
  .object({
    title: z.array(previewSchema).optional(),
    features: z.array(previewSchema).optional(),
    metrics: z.array(previewSchema).optional(),
    outro: z.array(previewSchema).optional(),
  })
  .partial();

export const projectExplainerSchema = z.object({
  brandName: z.string().min(1),
  projectName: z.string().min(1),
  audience: z.string().min(1),
  oneLiner: z.string().min(1),
  problemPoints: z.array(z.string().min(1)).min(2).max(4),
  solutionPoints: z.array(z.string().min(1)).min(2).max(4),
  features: z.array(featureSchema).min(2).max(6),
  metrics: z.array(statSchema).max(4),
  ctaTitle: z.string().min(1),
  ctaBody: z.string().min(1),
  website: z.string().min(1),
  accentColor: zColor(),
  secondaryColor: zColor(),
  backgroundColor: zColor(),
  sceneDurations: sceneDurationsSchema.optional(),
  voiceover: voiceoverSchema.optional(),
  captions: captionsSchema.optional(),
  lowerThirds: lowerThirdsSchema.optional(),
  previews: previewsSchema.optional(),
});

export const defaultExplainerProps = {
  brandName: "FreightIQ",
  projectName: "Driver Profitability Dashboard",
  audience: "Ops leaders and fleet managers",
  oneLiner:
    "A clear explainer that shows where margin disappears, which drivers are thriving, and what to fix first.",
  problemPoints: [
    "Margin analysis lived across spreadsheets, exports, and tribal knowledge.",
    "Dispatch and finance were looking at different versions of the truth.",
    "It was hard to explain why one lane or driver was dragging the whole week.",
  ],
  solutionPoints: [
    "We centralized labor, fuel, insurance, and equipment costs into one dashboard.",
    "We turned complex CPM math into visuals that operators can act on quickly.",
    "We made recurring review conversations faster, calmer, and more evidence-based.",
  ],
  features: [
    {
      title: "Unified cost picture",
      detail: "Bring labor, fuel, rentals, insurance, and maintenance into a single operating view.",
    },
    {
      title: "Driver detail",
      detail: "See payroll, gallons, miles, and blended CPM in one place.",
    },
    {
      title: "Per-load economics",
      detail: "Model each load with simple assumptions before it becomes a margin leak.",
    },
    {
      title: "Update checklist",
      detail: "Create a repeatable weekly and monthly workflow so the data stays trustworthy.",
    },
  ],
  metrics: [
    {
      label: "Review time",
      value: "-70%",
      detail: "Fewer spreadsheet handoffs before leadership review.",
    },
    {
      label: "Decision speed",
      value: "Same day",
      detail: "Operators can spot the issue and act without waiting on ad hoc analysis.",
    },
    {
      label: "Team alignment",
      value: "1 source",
      detail: "Finance and ops discuss the same numbers, not competing exports.",
    },
  ],
  ctaTitle: "Turn your internal tool into a clear story",
  ctaBody:
    "Use this template to explain what the project is, who it helps, and why it matters in under two minutes.",
  website: "freightiq.local/explainers",
  accentColor: "#ff7a18",
  secondaryColor: "#77f2d3",
  backgroundColor: "#07111f",
  voiceover: {
    enabled: false,
    src: "audio/project-explainer-voiceover.mp3",
    volume: 1,
    fadeInFrames: 12,
    fadeOutFrames: 18,
  },
  captions: {
    enabled: false,
    cues: [],
  },
  lowerThirds: {},
  previews: {},
};
