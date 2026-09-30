# ConcertMatch — Unser Abend

A 30-second German brand film. Six fully animated scenes, an original stereo score, and separate widescreen / vertical compositions.

## Delivery
- Landscape: 1920 × 1080, 60 fps, H.264 + AAC.
- Portrait: 1080 × 1920, 60 fps, H.264 + AAC.
- Each film is exactly 30 seconds.

## Edit and render
Node 22+, npm, FFmpeg and Chrome are required.

```powershell
npm run check
npm run check:portrait
npm run render
npm run render:portrait
npx hyperframes@0.8.98 preview --background
```

Edit layout / copy in index.html and portrait/index.html. Motion is shared: edit motion.js then run npm run sync to embed the timeline in both compositions. No external fonts, music or media are fetched at render time. CLI version is pinned. Scripts/make-score.mjs recreates the original 120 BPM score; FFmpeg loudnorm masters it to -16 LUFS / -1 dBTP as assets/score-master.wav.

See DESIGN.md, SCRIPT.md and STORYBOARD.md for creative direction, and assets/CREDITS.md for media sources and licenses.

The artist-selection panel is a designed illustration of the product. It makes no claim about any artist's tour schedule, recommendation score, or endorsement.
