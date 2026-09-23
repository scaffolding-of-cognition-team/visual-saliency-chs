// Tunable constants, gathered in one place so they're easy to find and
// change without hunting through frame-building logic.
//
// Declared as top-level consts (not just object-literal properties) so
// scripts/build.js's flattening still works: it strips the
// require()/module.exports lines and concatenates files, relying on each
// file's own top-level bindings surviving into the flattened script.

// How many trials each child sees. The inventory is 120 (pairs.js: 30
// ordered target-lure pairings x 4 familiarity variants), so a child sees
// half of it, as two of MATLAB's counterbalancing blocks: all 30 pairings
// twice, once per half of the session (chooseSessionTrials in
// randomization.js). Changing this breaks that - a smaller value takes a
// prefix, which eats into block 2 and drops the second instance of some
// pairings.
const NUM_TRIALS = 60;

// Matches GenerateTrials_Simsom_LWL.m's ImageTime exactly.
const TRIAL_IMAGE_SECONDS = 6;

// Every image trial plays a spoken label - "Look at the ball!" - naming
// one of the two images. This is the target/lure manipulation: the
// inventory doubles from 60 to 120 because either token can be named.
//
// TIMING. The clips in LABEL_AUDIO_SUBFOLDER are PRE-PADDED WITH SILENCE
// by scripts/make_label_assets.py so that the NOUN begins exactly
// LABEL_NOUN_ONSET_SECONDS after the clip starts. Since
// exp-lookit-images-audio starts its audio and shows its images in the
// same synchronous block (startTrial -> playAudio, showImages), that is
// also the offset from image onset, which is what looking-while-listening
// analysis time-locks to. On the current recordings the noun starts
// 0.778-0.796s into the source clip (it is NOT uniform across tokens -
// that spread is each noun's own leading silence), so the pad is ~2.21s,
// the carrier begins around 2.21s, and the padded clip finishes by ~3.9s
// - comfortably inside the 6s trial, leaving a full 3s post-naming
// window.
//
// Changing this constant alone does NOTHING: the delay lives in the audio
// files. Re-run scripts/make_label_assets.py, which reads its own copy of
// the value (TARGET_NOUN_ONSET) and reports the achieved onset per clip.
// Note MATLAB placed the label at +0.5s; 3s is a deliberate change, to
// buy a clean pre-naming baseline.
const LABEL_AUDIO_SUBFOLDER = 'Label_audio';
const LABEL_NOUN_ONSET_SECONDS = 3;

// Matches Experiment_Simsom_LWL.m's Parameters.ISI = [1, 2] (uniform
// random blank-screen gap between trials).
const ISI_SECONDS_RANGE = [1, 2];

// Attention-getter probability by "trials since last AG", 1-indexed to
// match Parameters.AG.probability in GenerateTrials_Simsom_LWL.m. Gap of
// 1-2 trials since the last AG: never fires again immediately. Gap of 6+:
// guaranteed.
const AG_PROBABILITY_BY_GAP = [0, 0, 0.25, 0.5, 0.75, 1];

// Attention-getter factorial, matching Parameters.AG.* in the MATLAB
// config exactly: 5 shapes x 5 sounds x 3 motions x 2 sides = 150 distinct
// attention getters. Note the levels below are sampled from shuffled bags,
// not IID as MATLAB's datasample does - see makeBagSampler in
// randomization.js for why, and what that does and does not change. 'orbit' is back - it was dropped when the AG was an
// exp-lookit-calibration frame, whose calibrationImageAnimation only
// supports 'spin' | 'bounce' | '', but the AG is now pre-rendered video so
// all three MATLAB motions are available.
const AG_SHAPES = ['orb', 'ring', 'star', 'flower', 'heart'];
const AG_SOUNDS = ['giggle', 'bell', 'powerup', 'squeak', 'xylophone'];
const AG_MOTIONS = ['orbit', 'rotate', 'scale'];

// Each attention-getter is one exp-lookit-video frame playing a
// pre-rendered clip (scripts/make_ag_assets.py) that reproduces MATLAB's
// AG_event_sequence = [1 2 2 3 1 2 2]:
//
//   0.00-0.50  sound plays, shape held at the stimulus position
//   0.50-1.50  motion epoch 1        (at the side)
//   1.50-2.50  motion epoch 2        (at the side)
//   2.50-3.50  sigmoid slide to screen centre
//   3.50-4.00  sound plays again, shape held at centre
//   4.00-5.00  motion epoch 3        (at centre)
//   5.00-6.00  motion epoch 4        (at centre)
//   6.00-6.25  Parameters.AG.Post_wait, blank background
//
// The side segment is still the known-gaze-direction validation reference
// for iCatcher+/human coding (see README) - it now lasts 2.5s at a known
// eccentricity rather than 3s, and is followed by a known trajectory
// rather than a hard cut.
const AG_VIDEO_SECONDS = 6.25;

// Shape/motion/side live in the video filename; the sound is a separate
// audio track so it stays an independent factor (baking audio into the
// video would need 150 clips instead of 30 + 5). Both under this folder.
const AG_VIDEO_SUBFOLDER = 'AG_videos';

// How long exp-lookit-stop-recording will wait for the whole-session video
// to finish uploading before giving up and moving on. EFP's own default is
// 300s; kept explicit here because with session-level recording this single
// upload carries the entire trial block (see frames.js's RECORDING note).
const SESSION_MAX_UPLOAD_SECONDS = 300;

// Traced from Setup_Display.m: Window.gray = 50 (0-255 scale) is the
// background used everywhere in this MATLAB codebase (Window.bcolor =
// Window.gray). RGB(50,50,50).
const BACKGROUND_COLOR = 'rgb(50, 50, 50)';

// Image width and screen-edge margin, given directly (measured from the
// real MATLAB rendering) rather than derived from visual-degree constants:
// each image is ~38% of total screen width, and the margin between the
// screen's outer edge and the image's outer edge is 7/445 of screen width.
//
// Stimuli are square (confirmed 800x800px). `width`/`height` here are
// percentages of two DIFFERENT axes (story-area width vs. height), which
// are not equal for a typical landscape viewport - setting height% equal
// to width% under-sizes the image if the frame preserves aspect ratio
// (contain-fits to whichever box dimension is smaller in absolute
// pixels, which is height on a wide viewport). Height is set generously
// large so it's never the binding dimension - width alone should
// determine the rendered size.
const TRIAL_IMAGE_WIDTH_PERCENT = 38;
const TRIAL_IMAGE_HEIGHT_PERCENT = 95;
const TRIAL_IMAGE_TOP_PERCENT = (100 - TRIAL_IMAGE_HEIGHT_PERCENT) / 2;
const TRIAL_IMAGE_MARGIN_PERCENT = (7 / 445) * 100;
const TRIAL_IMAGE_LEFT_MARGIN_PERCENT = TRIAL_IMAGE_MARGIN_PERCENT;
const TRIAL_IMAGE_RIGHT_LEFT_PERCENT = 100 - TRIAL_IMAGE_MARGIN_PERCENT - TRIAL_IMAGE_WIDTH_PERCENT;

// Real hosting layout: github.com/scaffolding-of-cognition-team/visual-saliency-chs,
// stimuli kept directly under stimuli/{AG_stimuli,Audio,Toys}/ (flattened -
// no intermediate Simsom_LWL/ folder), not flattened into an
// img/ folder either. frames.js builds full absolute raw-GitHub URLs from
// this root rather than relying on baseDir + EFP's img/mp3 auto-subfolder
// convention, since that convention doesn't match this layout anyway (no
// bare img/ or mp3/ folder exists) - using full URLs sidesteps the
// ambiguity entirely instead of fighting it.
//
// NOTE: the GitHub repo is named "visual-saliency-chs" (not
// "visual-salience-chs", the local folder name) - confirm that's the
// intended spelling before this goes live.
const STIMULI_BASE_URL = 'https://github.com/scaffolding-of-cognition-team/visual-saliency-chs/raw/main/stimuli/';

// Subfolder under STIMULI_BASE_URL holding the trial images. Used to be
// per-pair (pair.category was 'BodyParts' or 'Toys'); with body parts
// dropped there is one folder for every trial image. The folder itself is
// still named "Toys" on disk and in the hosted repo - renaming it would
// break the live URLs, so only this pointer would need to change.
const TRIAL_IMAGE_SUBFOLDER = 'Toys';

// Setup-instructions screenshots, self-hosted from this repo's img/ folder
// (see src/text.js) instead of pulling from the separate
// placepath-behavioral repo, so this study doesn't depend on another repo's
// contents staying put.
const IMG_BASE_URL = 'https://github.com/scaffolding-of-cognition-team/visual-saliency-chs/raw/main/img/';

module.exports = {
  NUM_TRIALS,
  TRIAL_IMAGE_SECONDS,
  LABEL_AUDIO_SUBFOLDER,
  LABEL_NOUN_ONSET_SECONDS,
  ISI_SECONDS_RANGE,
  AG_PROBABILITY_BY_GAP,
  AG_SHAPES,
  AG_SOUNDS,
  AG_MOTIONS,
  AG_VIDEO_SECONDS,
  AG_VIDEO_SUBFOLDER,
  SESSION_MAX_UPLOAD_SECONDS,
  STIMULI_BASE_URL,
  TRIAL_IMAGE_SUBFOLDER,
  IMG_BASE_URL,
  BACKGROUND_COLOR,
  TRIAL_IMAGE_WIDTH_PERCENT,
  TRIAL_IMAGE_HEIGHT_PERCENT,
  TRIAL_IMAGE_TOP_PERCENT,
  TRIAL_IMAGE_LEFT_MARGIN_PERCENT,
  TRIAL_IMAGE_RIGHT_LEFT_PERCENT,
};
