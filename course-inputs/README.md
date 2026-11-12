# Private course inputs

Place the approved working materials for the current course here before authoring:

- `storyboard/` — approved course storyboard and copy source.
- `moodboard/` — approved visual direction, palette and composition references.
- `references/` — supporting brief, supplied icons, image references or other private source material.

Everything in those three folders is ignored by Git except the tracked `.gitkeep` placeholders. Do not commit client materials from this location and do not expect them in a clone. This folder is outside `public/`, so its files are not included in the Astro build or SCORM ZIP.

When an approved image, video, download or other learner-facing production asset is ready, place the production copy under `public/assets/` with a descriptive filename and use it from the course data. Only assets that are needed by the published course belong there.
