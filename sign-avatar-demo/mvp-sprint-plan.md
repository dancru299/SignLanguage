# MVP Sprint Plan

## MVP Decision

The MVP is not a full sign-language translation product yet. It is a learnable web prototype that proves this loop:

1. The learner selects a small VSL lesson.
2. The 3D avatar demonstrates the sign.
3. The learner turns on the webcam and imitates the sign.
4. MediaPipe extracts hand landmarks.
5. The app gives a live score and basic correction feedback.

## Locked MVP Scope

- Default user surface: Learner mode.
- Creator surface: Pose Lab, kept behind the mode switch.
- First practice batch: `A`, `B`, `C`, `1`, `Xin chào`.
- Full dataset target: 29 Vietnamese letters, 10 digits, 5 core phrases.
- Minimum pass score: 85%.
- Camera processing target: 15-20fps, currently capped around 18fps.
- Dataset state: engineering seed/draft until reviewed against real VSL references.

## Sprint 1: Product Shape

Status: implemented.

- Learner mode is the default screen.
- Pose Lab remains available for authoring.
- Dataset manifest exists at `src/data/vsl/manifest.js`.
- First practice batch is limited to 5 lessons.
- Learner HUD shows score, hand feedback, dataset version, render FPS, and AI FPS.

Acceptance:

- Opening the app lands in Learner mode.
- Learner can switch lesson among the 5 MVP lessons.
- Pose Lab is still reachable.
- Production build passes.

## Sprint 2: Dataset Authoring

Status: next.

- Use Pose Lab to author real pose JSON for `chu_a`, `chu_b`, `chu_c`, `so_1`, `xin_chao`.
- Store reviewed pose JSON under `src/data/vsl/poses/`.
- Mark each sign from `draft_seed` to `verified_mvp` only after visual review.
- Replace generated seed poses with reviewed pose files when available.

Acceptance:

- Each of the 5 MVP lessons plays from authored JSON, not generated seed curls.
- Each pose contains wrist targets and pole targets.
- Avatar transition remains stable with no obvious elbow flipping.

## Sprint 3: Scoring Calibration

Status: next.

- Capture webcam samples for the 5 MVP signs.
- Tune scoring targets for finger curl, palm normal, and fingertip distances.
- Add hold-to-pass logic so a score must stay above threshold for roughly 900ms.
- Keep mirrored handedness acceptance for left/right users.

Acceptance:

- Score does not jump wildly frame-to-frame.
- User receives one clear correction hint at a time.
- A correctly held sign advances or marks complete.

## Sprint 4: Deployment Trial

Status: next.

- Deploy static web app to HTTPS.
- Verify camera permission on desktop Chrome and at least one mobile browser.
- Record render FPS and AI FPS from the Learner HUD.

Acceptance:

- App loads over HTTPS.
- Camera starts without browser security blockers.
- Avatar + camera remain usable on a mid-range device.

