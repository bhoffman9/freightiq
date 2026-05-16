Drop your recorded narration file here and keep the filename:

`vol-dashboard-codex-voiceover.mp3`

Or generate it with ElevenLabs:

`$env:ELEVENLABS_API_KEY='your_key_here'; npm run voiceover:vol-dashboard`

Then open:

`src/data/vol-dashboard-codex.json`

and set:

`"voiceover": { "enabled": true, ... }`

The composition already knows to load the file from:

`public/audio/vol-dashboard-codex-voiceover.mp3`
