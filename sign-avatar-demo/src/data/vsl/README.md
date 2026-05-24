# VSL MVP Dataset

This folder is the source of truth for the MVP dataset.

## MVP Scope

- First practice batch: `chu_a`, `chu_b`, `chu_c`, `so_1`, `xin_chao`.
- Full MVP target: 29 Vietnamese letters, 10 digits, 5 basic phrases.
- Current pose status: seed/draft data for engineering validation, not expert-verified VSL.

## Authoring Workflow

1. Open Pose Lab.
2. Select or create the target token name.
3. Adjust finger bones, wrist IK, face/non-manual controls.
4. Capture wrist target.
5. Export pose JSON v3.
6. Move the exported pose into this dataset once reviewed.

## Acceptance Gate

A sign can move from `draft_seed` to `verified_mvp` only after:

- The avatar pose is visually reviewed against a VSL reference.
- Wrist target and pole target are present.
- Camera scoring target is calibrated with at least 3 real webcam samples.
- Learner mode can play and score the sign without console errors.

