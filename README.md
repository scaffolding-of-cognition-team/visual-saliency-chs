# visual-salience-chs

Lookit Ember Frameplayer (EFP) protocol generator for a two-alternative
preferential-looking study measuring visual salience: which of two images
children look at more, and whether that preference is stable across
children. Adapted from the Simsom LWL MATLAB paradigm
(`soc_menu_private/Scripts/{Experiment,GenerateTrials}_Simsom_LWL.m`), with
the spoken label removed — there is no target and no lure, just `pairID`,
`imageA`, `imageB`, `sideOfA`.

## File structure

```
protocol.js               generateProtocol(child, pastSessions) — the entry point
src/
  config.js                tunable constants (trial count, timings, AG assets, baseDir)
  pairs.js                 the fixed 120-pair inventory, derived programmatically
  randomization.js         seeded per-child trial-set + AG-schedule generation
  frames.js                turns a session plan into EFP frame objects
  text.js                  all participant-facing copy (TODO placeholders)
stimuli/
  img/                      flattened trial images + AG shape images (see below)
  mp3/                      AG sound clips (see below)
test/
  randomization.test.js    node test/randomization.test.js — no framework/deps
scripts/
  build.js                  node scripts/build.js — flattens src/*.js + protocol.js
dist/
  protocol.generated.js     ← THIS is the file to paste into the Lookit builder
```

Run `node test/randomization.test.js` after any change to `src/randomization.js`
or `src/pairs.js`. Run `node scripts/build.js` before deploying — it
concatenates `src/*.js` + `protocol.js` into one dependency-free script
(stripping the `require`/`module.exports` lines that only exist for local
Node testing), because Lookit loads a single script and expects a bare
`generateProtocol(child, pastSessions)` function with no module system —
the same shape `placepath-behavioral/scripts/experiment.js` uses.

## Design summary (see prior conversation for the full derivation)

- **120 pairs**: within-category only (BodyParts, Toys; 6 tokens each), all
  15 unordered token pairs per category × 4 familiarity combos (FF, UU, and
  the two mixed F/U assignments) = 120. This is the *same* inventory the
  MATLAB script produces (240 raw target/lure slots ÷ 2, since dropping the
  label collapses each ordered target/lure pair onto one unordered image
  pair) — just derived directly as unordered pairs instead.
- **Per-child seeding**: `generateProtocol` only ever sees this child's
  `(child, pastSessions)` — no global participant counter exists, so there's
  no rotation/pointer to maintain. A PRNG seeded from `child.id`
  (mulberry32/xmur3, in `randomization.js`) takes its place: deterministic
  per child, independent across children, no shared state. Verified in
  `test/randomization.test.js`.
- **30 of 120 per child**: seeded full permutation of all 120 pairs, first
  30 taken. Gives uniform per-pair inclusion (p=0.25), uniform position, and
  random adjacency (no two pairs are fixed neighbors across children) — the
  property MATLAB gets from shuffling within its own 240-trial macro-blocks.
  At 200 children: ~50 observations/pair, SD≈6.1 (binomial, p=0.25, n=200).
- **Side assignment**: independent Bernoulli(0.5) per trial, matching
  MATLAB's actual (unbalanced) behavior exactly — MATLAB does not balance
  L/R at any scale, so neither do we.
- **Attention-getters**: scheduled by the same probability-by-gap table as
  `GenerateTrials_Simsom_LWL.m` (`config.js`'s `AG_PROBABILITY_BY_GAP`),
  computed once at generation time in the same seeded RNG stream rather than
  via a runtime `selectNextFrame` closure — behaviorally identical, since
  MATLAB's only source of AG randomness (with no live experimenter online)
  is the same probability-table draws, just made once up front instead of
  turn-by-turn.
- **AG = validation reference, no separate calibration frame**: each AG is
  one `exp-lookit-calibration` frame (a real EFP frame kind whose whole
  documented purpose is "video of the child looking to known locations at
  known times") showing one of 5 self-hosted shapes at a random known side,
  then recentering (`calibrationPositions: [side, 'center']`). This gives
  iCatcher+ and the human coder a known-gaze-direction reference for free,
  with zero extra stimuli or frames — mirroring how MATLAB's own AG starts
  on a random known side (`is_AG_right`) and logs it. MATLAB's third motion,
  `orbit`, has no equivalent in `calibrationImageAnimation` (`spin`/`bounce`
  only) and is dropped.
- **Recording**: per-frame (`doRecording` on each sub-frame), not a
  session-level start/stop bracket — matches the majority of documented
  Lookit studies (including the reference protocol you supplied) and means
  an early exit only risks the one trial in progress.
- **Early exit / pause**: no custom exit key. Escape brings up Lookit's
  built-in Continue/Exit box, worded the same way as
  `placepath-behavioral`'s own instructions (see `text.js`'s
  `ESCAPE_PAUSE_EXIT_*` blocks) rather than separately introducing Ctrl+X/F1
  to parents.
- **Coding plan**: one human coder does a full frame-by-frame pass on all
  ~6,000 trials (200 children × 30) (ideally) in parallel with iCatcher+ on all
  trials; any trial/session where they disagree beyond threshold (TBD what this exact threshold is) gets a full
  second human pass.

## What has to happen outside this repo

1. **Host `stimuli/img/*.png` and `stimuli/mp3/*.mp3` at a public baseDir.**
   EFP's `expand-assets` convention resolves bare filenames as
   `<baseDir>img/<name>` for images and `<baseDir>mp3/<name>.<ext>` for
   audio (mirroring how `placepath-behavioral` hosts its own `mp4/`/`img/`
   via raw GitHub URLs). Set the real URL in `config.js`'s
   `STIMULI_BASE_DIR` (currently a `TODO` placeholder).
2. **Populate `stimuli/img/`**: the 24 trial images (`F_`/`U_` × 6 BodyParts
   tokens + 6 Toys tokens, copied from
   `soc_menu_private/stimuli/Simsom_LWL/{BodyParts,Toys}/`) plus the 5 AG
   shape PNGs (`orb.png`, `ring.png`, `star.png`, `flower.png`, `heart.png`,
   from `soc_menu_private/stimuli/Simsom_LWL/AG_stimuli/`) — all in one flat
   folder, self-hosted per your go-ahead. No filename collisions (all 12
   tokens are unique across categories).
3. **Populate `stimuli/mp3/`**: the 5 AG sound clips (`giggle.mp3`,
   `bell.mp3`, `powerup.mp3`, `squeak.mp3`, `xylophone.mp3`, from the same
   `AG_stimuli/` folder).
4. **TODO verify in Lookit preview**: the exact `img/`/`mp3/` auto-append
   behavior for `exp-lookit-images-audio` and `exp-lookit-calibration`
   specifically (confirmed for `exp-lookit-preferential-looking` in the
   docs; inferred, not confirmed, for the frame kinds we're actually using).
   If images/audio don't load, this is the first thing to check — the fix
   is a one-line prefix change in `frames.js`.
5. **Write the real copy.** Everything in `src/text.js` is a `TODO`
   placeholder — consent purpose/procedures/payment/risk/debrief, all
   instruction blocks. One exception: the Escape pause/exit explanation is
   real, adapted from `placepath-behavioral`.
6. **Produce the study intro video.** `text.js`'s `STUDY_INTRO_VIDEO` has an
   empty `src` slot waiting for it — per your plan, include the
   Escape/Continue-or-Exit example in it, mirroring
   `placepath-behavioral`'s `instructions-3`.
7. **Create the actual study on the CHS/Lookit builder**, paste
   `dist/protocol.generated.js` in as the external protocol generator, and
   go through Lookit's own study-review flow (IRB text, compensation, age
   range, recruitment) — none of that lives in this repo.
8. **Manually preview the full flow at least once** before launch,
   specifically:
   - Confirm images/audio actually resolve (item 4 above).
   - Confirm each trial's video clip uploads independently (per-frame
     recording, item above) — spot-check a few clips land in the
     researcher dashboard.
9. **Set up the coding pipeline**: run iCatcher+ on all trials, get one
   human coder doing full frame-by-frame coding on all trials, and decide
   the exact IRR disagreement threshold that triggers a second human pass
   (not specified here — a coding-team decision, not a protocol-generator
   one).

## Open items / things I couldn't verify from code alone

- The `img/`/`mp3/` baseDir-subfolder auto-append convention (item 4 above)
  is inferred from one frame kind's docs (`exp-lookit-preferential-looking`)
  and the shared `expand-assets` mixin name, not confirmed for
  `exp-lookit-images-audio`/`exp-lookit-calibration` directly.
- `calibrationImageAnimation: 'spin'|'bounce'` is EFP's actual supported set
  (confirmed from docs) — there's no motion option matching MATLAB's
  `orbit`, so AG variety is shape × sound × {spin, bounce}, not shape ×
  sound × {orbit, rotate, scale}.
