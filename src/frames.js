// Turns a per-child session plan (src/randomization.js) into actual EFP
// frame objects.
//
// Frame-kind choices, confirmed against the live Lookit Ember Frameplayer
// docs (lookit.readthedocs.io/projects/frameplayer) before writing this:
//
// - exp-lookit-images-audio: test trials AND the blank inter-trial
//   interval (empty images array). Per your decision, images only, no
//   trial audio, duration driven by durationSeconds. Positioning uses
//   images[].left/width/top/height (percentages), NOT the position:
//   'left'/'right' preset - those presets don't reproduce MATLAB's actual
//   spacing (see TRIAL_IMAGE_* constants in config.js, derived from
//   Experiment_Simsom_LWL.m's ImageSize/eccentricity).
//
// - exp-lookit-calibration: doubles as the attention-getter. Its whole
//   documented purpose is "video of the child looking to known locations
//   at known times" - exactly the validation reference iCatcher+/human
//   coding needs, and exactly what you confirmed (AG-as-validation-frame,
//   no separate calibration frame). calibrationPositions is set to
//   [side, 'center'] rather than the default 4-position sweep: one
//   known-side segment (the reference) + one recentering segment before
//   the next trial's images appear, at calibrationLength=3000ms each -
//   2 segments x 3s = 6s total, in the same ballpark as MATLAB's ~6-7s AG.
//   calibrationImageAnimation ('spin'/'bounce') is EFP's built-in
//   replacement for MATLAB's rotate/scale motions; 'orbit' has no
//   equivalent and is dropped (see config.js).
//
// - group + commonFrameProperties: bundles each trial's optional AG + ISI
//   + test-image into one frame. This is the same pattern your own
//   reference protocol uses (test-trial-one..eight), not something
//   invented here.
//
// Recording is per-frame (doRecording on each sub-frame), not a
// session-level start/stop bracket - per your go-ahead, this also means an
// early Ctrl+X/F1 (or Escape) exit only risks the one trial in progress;
// every already-finished trial has already uploaded its own clip.
//
// Stimuli are hosted at their real MATLAB-mirroring layout
// (stimuli/Simsom_LWL/{AG_stimuli,BodyParts,Toys}/...), not a flat img/
// folder, so every image/audio `src` below is a full absolute URL built
// from STIMULI_BASE_URL + the real subfolder - this sidesteps EFP's
// baseDir + img//mp3/ auto-subfolder convention entirely rather than
// depending on unverified behavior for a layout it doesn't match anyway.

const {
  TRIAL_IMAGE_SECONDS,
  AG_CALIBRATION_LENGTH_MS,
  STIMULI_BASE_URL,
  BACKGROUND_COLOR,
  TRIAL_IMAGE_WIDTH_PERCENT,
  TRIAL_IMAGE_HEIGHT_PERCENT,
  TRIAL_IMAGE_TOP_PERCENT,
  TRIAL_IMAGE_LEFT_MARGIN_PERCENT,
  TRIAL_IMAGE_RIGHT_LEFT_PERCENT,
} = require('./config');

function oppositeSide(side) {
  return side === 'left' ? 'right' : 'left';
}

function stimulusUrl(subfolder, filename) {
  return `${STIMULI_BASE_URL}${subfolder}/${filename}`;
}

function buildAttentionGetterFrame(attentionGetter) {
  const soundUrl = stimulusUrl('AG_stimuli', `${attentionGetter.sound}.mp3`);

  return {
    kind: 'exp-lookit-calibration',
    calibrationImage: stimulusUrl('AG_stimuli', `${attentionGetter.shape}.png`),
    calibrationImageAnimation: attentionGetter.animation,
    // Array form, one entry per calibrationPositions slot - plays once at
    // the side, once again after moving to center. Mirrors MATLAB's AG
    // event sequence (sound -> action -> action -> move -> sound -> action
    // -> action): a sound at the side, then another after recentering.
    calibrationAudio: [soundUrl, soundUrl],
    calibrationPositions: [attentionGetter.side, 'center'],
    calibrationLength: AG_CALIBRATION_LENGTH_MS,
    backgroundColor: BACKGROUND_COLOR,
    doRecording: true,
  };
}

function buildIsiFrame(isiSeconds) {
  return {
    images: [],
    durationSeconds: isiSeconds,
    autoProceed: true,
    doRecording: false,
  };
}

function buildTrialImageFrame(trial) {
  const sideOfB = oppositeSide(trial.sideOfA);
  // Same left offset for both slots - whichever side each image is on
  // determines which offset it gets, not a separate "left slot"/"right
  // slot" pair of constants.
  const leftOffsetBySide = { left: TRIAL_IMAGE_LEFT_MARGIN_PERCENT, right: TRIAL_IMAGE_RIGHT_LEFT_PERCENT };

  return {
    id: `trial-${trial.pairID}`,
    images: [
      {
        id: 'imageA',
        src: stimulusUrl(trial.category, trial.imageA),
        left: leftOffsetBySide[trial.sideOfA],
        width: TRIAL_IMAGE_WIDTH_PERCENT,
        top: TRIAL_IMAGE_TOP_PERCENT,
        height: TRIAL_IMAGE_HEIGHT_PERCENT,
      },
      {
        id: 'imageB',
        src: stimulusUrl(trial.category, trial.imageB),
        left: leftOffsetBySide[sideOfB],
        width: TRIAL_IMAGE_WIDTH_PERCENT,
        top: TRIAL_IMAGE_TOP_PERCENT,
        height: TRIAL_IMAGE_HEIGHT_PERCENT,
      },
    ],
    durationSeconds: TRIAL_IMAGE_SECONDS,
    autoProceed: true,
    choiceAllowed: false,
    doRecording: true,
    // pairID/sideOfA are carried in the frame id and image ids so they're
    // recoverable from exported session data without a side channel.
  };
}

function buildTrialGroup(trial, index) {
  const frameList = [];

  if (trial.attentionGetter) {
    frameList.push(buildAttentionGetterFrame(trial.attentionGetter));
  }

  frameList.push(buildIsiFrame(trial.isiSeconds));
  frameList.push(buildTrialImageFrame(trial));

  return {
    id: `trial-group-${index}-${trial.pairID}`,
    frame: {
      kind: 'group',
      frameList,
      // No baseDir/audioTypes here - every src above is already a full
      // absolute URL, so there's nothing for a relative-path convention
      // to resolve.
      commonFrameProperties: {
        kind: 'exp-lookit-images-audio',
        backgroundColor: BACKGROUND_COLOR,
        autoProceed: true,
        showProgressBar: false,
        showCursor: false,
      },
    },
  };
}

// Returns { frames, sequence } fragments for the trial portion only - the
// caller (protocol.js) merges these into the full study frames/sequence
// alongside the intro/consent/outro frames.
function buildTrialFrames(plan) {
  const frames = {};
  const sequence = [];

  plan.forEach((trial, index) => {
    const { id, frame } = buildTrialGroup(trial, index);
    frames[id] = frame;
    sequence.push(id);
  });

  return { frames, sequence };
}

module.exports = {
  buildAttentionGetterFrame,
  buildIsiFrame,
  buildTrialImageFrame,
  buildTrialGroup,
  buildTrialFrames,
};
