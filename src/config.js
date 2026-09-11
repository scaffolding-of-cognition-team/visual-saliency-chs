// Tunable constants, gathered in one place so they're easy to find and
// change without hunting through frame-building logic.
//
// Declared as top-level consts (not just object-literal properties) so
// scripts/build.js's flattening still works: it strips the
// require()/module.exports lines and concatenates files, relying on each
// file's own top-level bindings surviving into the flattened script.

// How many of the 120 pairs each child sees. Coverage arithmetic (200
// children x 30 trials, p=0.25 inclusion/pair) lives in the README.
const NUM_TRIALS = 30;

// Matches GenerateTrials_Simsom_LWL.m's ImageTime exactly (the MATLAB
// window included a spoken label at +0.5s; we've dropped the label but
// kept the full window, per go-ahead).
const TRIAL_IMAGE_SECONDS = 6;

// Matches Experiment_Simsom_LWL.m's Parameters.ISI = [1, 2] (uniform
// random blank-screen gap between trials).
const ISI_SECONDS_RANGE = [1, 2];

// Attention-getter probability by "trials since last AG", 1-indexed to
// match Parameters.AG.probability in GenerateTrials_Simsom_LWL.m. Gap of
// 1-2 trials since the last AG: never fires again immediately. Gap of 6+:
// guaranteed.
const AG_PROBABILITY_BY_GAP = [0, 0, 0.25, 0.5, 0.75, 1];

// Self-hosted attention-getter assets (same 5 shapes/5 sounds as
// AG_stimuli/ in the MATLAB stimuli dir). MATLAB's third motion, 'orbit',
// has no equivalent in exp-lookit-calibration's calibrationImageAnimation
// (which only supports 'spin' | 'bounce' | '') and is dropped.
const AG_SHAPES = ['orb', 'ring', 'star', 'flower', 'heart'];
const AG_SOUNDS = ['giggle', 'bell', 'powerup', 'squeak', 'xylophone'];
const AG_ANIMATIONS = ['spin', 'bounce'];

// Each attention-getter is one exp-lookit-calibration frame that shows the
// shape at a known random side, then recenters - this doubles as the
// known-gaze-direction validation reference for iCatcher+/human coding
// (see README), so no separate calibration frame is needed.
const AG_CALIBRATION_LENGTH_MS = 3000;

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
// stimuli kept directly under stimuli/{AG_stimuli,Audio,BodyParts,Toys}/
// (flattened - no intermediate Simsom_LWL/ folder), not flattened into an
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

// Setup-instructions screenshots, self-hosted from this repo's img/ folder
// (see src/text.js) instead of pulling from the separate
// placepath-behavioral repo, so this study doesn't depend on another repo's
// contents staying put.
const IMG_BASE_URL = 'https://github.com/scaffolding-of-cognition-team/visual-saliency-chs/raw/main/img/';

module.exports = {
  NUM_TRIALS,
  TRIAL_IMAGE_SECONDS,
  ISI_SECONDS_RANGE,
  AG_PROBABILITY_BY_GAP,
  AG_SHAPES,
  AG_SOUNDS,
  AG_ANIMATIONS,
  AG_CALIBRATION_LENGTH_MS,
  STIMULI_BASE_URL,
  IMG_BASE_URL,
  BACKGROUND_COLOR,
  TRIAL_IMAGE_WIDTH_PERCENT,
  TRIAL_IMAGE_HEIGHT_PERCENT,
  TRIAL_IMAGE_TOP_PERCENT,
  TRIAL_IMAGE_LEFT_MARGIN_PERCENT,
  TRIAL_IMAGE_RIGHT_LEFT_PERCENT,
};
