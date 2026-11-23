# Credits & licenses

## Exercise photos
- **Source:** [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), which restructured [wrkout/exercises.json](https://github.com/wrkout/exercises.json).
- **License:** both repositories are released under **The Unlicense** (public domain dedication). Verified from each repo's `LICENSE.md` on 2026-11-23.
- **What we use:** the two photos (start and end position) for 71 exercises, resized to ≤ 480 px and converted to WebP by `scripts/build-media.mjs`, stored in `public/exercise-media/` (no hotlinking). Each exercise's `media.credit` records the source; `media.datasetId` names the original entry.
- The dataset's text instructions are **not** used. All exercise text (purpose, setup, steps, cues, mistakes, safety) was written for Rep.

## Animated stick figures
Five exercises without a good licensed photo (bird dog, suitcase carry, Bulgarian split squat, negative pull-up, kneeling plank) use original SVG stick figures drawn in code (`src/components/StickFigure.tsx`).

## Fonts
Rep uses the device's system font (San Francisco on iPhone and Mac), so no font files are bundled.

## Icons
App icons and UI icons were drawn for Rep (`scripts/build-icons.mjs`, `src/components/Icons.tsx`).

## Videos
"Watch a video" opens a YouTube search (`<exercise> proper form`) in a new tab. No videos are embedded or redistributed.
