import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const docsPath = path.join(rootDir, "docs", "vol-dashboard-codex-voiceover-script.md");
const propsPath = path.join(rootDir, "src", "data", "vol-dashboard-codex.json");
const outputPath = path.join(rootDir, "public", "audio", "vol-dashboard-codex-voiceover.mp3");

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
const DEFAULT_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const DEFAULT_OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";

const extractScriptText = async () => {
  const markdown = await fs.readFile(docsPath, "utf8");
  const match = markdown.match(/## Full read\s+([\s\S]+)/);

  if (!match) {
    throw new Error("Could not find the 'Full read' section in the voiceover script.");
  }

  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");
};

const writeUpdatedProps = async () => {
  const raw = await fs.readFile(propsPath, "utf8");
  const props = JSON.parse(raw);

  props.voiceover = {
    ...props.voiceover,
    enabled: true,
    src: "audio/vol-dashboard-codex-voiceover.mp3",
  };

  await fs.writeFile(propsPath, `${JSON.stringify(props, null, 2)}\n`, "utf8");
};

const main = async () => {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is required.");
  }

  const text = await extractScriptText();
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}`);
  url.searchParams.set("output_format", DEFAULT_OUTPUT_FORMAT);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: DEFAULT_MODEL_ID,
      voice_settings: {
        stability: 0.42,
        similarity_boost: 0.72,
        style: 0.28,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs request failed (${response.status}): ${errorText}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(outputPath), {recursive: true});
  await fs.writeFile(outputPath, audioBuffer);
  await writeUpdatedProps();

  console.log(`Saved voiceover to ${outputPath}`);
  console.log(`Voice ID: ${DEFAULT_VOICE_ID}`);
  console.log(`Model: ${DEFAULT_MODEL_ID}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
