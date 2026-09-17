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
// RECORDING: one session-level recorder spanning the whole trial block
// (exp-lookit-start-recording before trial 1, exp-lookit-stop-recording
// after trial 60), NOT the per-frame doRecording bracket this file used
// to have. That change is what makes the stimulus timing exact, and the
// reason is in the frameplayer's own source:
//
// - At frame start, exp-lookit-images-audio's startTrialIfReady() gates on
//   `(recordingStarted || !recordingNeeded) && image_loaded_count >= nImages`,
//   and only then does startTrial() arm the durationSeconds timer. With
//   per-frame doRecording:true, "stimuli are not displayed and audio is not
//   started until recording begins" (their docs), so every trial paid a
//   webcam spin-up before its images appeared - and because the preceding
//   ISI frame had already rendered a blank gray screen, that spin-up was
//   visually indistinguishable from the ISI. That is why the ISI looked
//   longer than the 1-2s it was actually set to.
// - At frame end, the video-record mixin's willDestroyElement calls
//   stopRecorder() and waits on a promise that "resolves when upload is
//   complete" before the frame advances. showWaitForUploadMessage:false
//   (which we had set, to keep a "please wait" card away from the child)
//   suppresses the cover overlay but NOT the wait - so the two trial
//   images stayed on screen for 6s PLUS a variable, network-dependent
//   stop/upload tail. That is why trials were not exactly 6 seconds.
//
// With doRecording:false on every frame below, the only remaining gate is
// image_loaded_count, so trial images display for exactly
// TRIAL_IMAGE_SECONDS and the ISI lasts exactly its drawn duration.
//
// Tradeoff, stated plainly: a hard crash or tab-close mid-block now risks
// the whole block's video rather than just the trial in progress. A
// graceful Escape -> Exit still runs to the stop-recording frame and
// uploads. Reverting is a small, local change - see README.
//
// Stimuli are hosted at their real MATLAB-mirroring layout
// (stimuli/{AG_stimuli,Toys}/...), not a flat img/ folder, so every
// image/audio `src` below is a full absolute URL built
// from STIMULI_BASE_URL + the real subfolder - this sidesteps EFP's
// baseDir + img//mp3/ auto-subfolder convention entirely rather than
// depending on unverified behavior for a layout it doesn't match anyway.

const {
  TRIAL_IMAGE_SECONDS,
  AG_CALIBRATION_LENGTH_MS,
  SESSION_MAX_UPLOAD_SECONDS,
  STIMULI_BASE_URL,
  TRIAL_IMAGE_SUBFOLDER,
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
    id: 'attention-getter',
    kind: 'exp-lookit-calibration',
    calibrationImage: stimulusUrl('AG_stimuli', `${attentionGetter.shape}.png`),
    calibrationImageAnimation: attentionGetter.animation,
    // Single value (per Lookit's own docs examples), not one entry per
    // calibrationPositions slot - it plays at every position segment,
    // same sound each time (side, then again after recentering).
    calibrationAudio: [{ src: soundUrl, type: 'audio/mp3' }],
    calibrationPositions: [attentionGetter.side, 'center'],
    calibrationLength: AG_CALIBRATION_LENGTH_MS,
    backgroundColor: BACKGROUND_COLOR,
    // false: the session recorder installed by the start-recording frame
    // is already running. See the RECORDING note at the top of this file.
    doRecording: false,
  };
}

// Brackets the trial block with one session-level recorder. Both frames
// show a spinning attention-getter shape while the webcam connects /
// uploads, so the child has something to look at instead of a blank
// screen - these are the only two frames in the block whose duration is
// network-dependent, and they sit outside every measured trial.
function buildStartRecordingFrame() {
  return {
    id: 'start-session-recording',
    kind: 'exp-lookit-start-recording',
    image: stimulusUrl('AG_stimuli', 'star.png'),
    imageAnimation: 'spin',
    backgroundColor: BACKGROUND_COLOR,
    displayFullscreen: true,
    waitForVideoMessage: '',
  };
}

function buildStopRecordingFrame() {
  return {
    id: 'stop-session-recording',
    kind: 'exp-lookit-stop-recording',
    image: stimulusUrl('AG_stimuli', 'star.png'),
    imageAnimation: 'spin',
    backgroundColor: BACKGROUND_COLOR,
    displayFullscreen: true,
    sessionMaxUploadSeconds: SESSION_MAX_UPLOAD_SECONDS,
    // The child is done by this point, so an upload progress bar is
    // useful to the parent rather than a distraction.
    showProgressBar: true,
    waitForUploadMessage: 'Uploading your video, please do not close this window...',
  };
}

function buildIsiFrame(isiSeconds) {
  return {
    id: 'isi',
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
        src: stimulusUrl(TRIAL_IMAGE_SUBFOLDER, trial.imageA),
        left: leftOffsetBySide[trial.sideOfA],
        width: TRIAL_IMAGE_WIDTH_PERCENT,
        top: TRIAL_IMAGE_TOP_PERCENT,
        height: TRIAL_IMAGE_HEIGHT_PERCENT,
      },
      {
        id: 'imageB',
        src: stimulusUrl(TRIAL_IMAGE_SUBFOLDER, trial.imageB),
        left: leftOffsetBySide[sideOfB],
        width: TRIAL_IMAGE_WIDTH_PERCENT,
        top: TRIAL_IMAGE_TOP_PERCENT,
        height: TRIAL_IMAGE_HEIGHT_PERCENT,
      },
    ],
    durationSeconds: TRIAL_IMAGE_SECONDS,
    autoProceed: true,
    choiceAllowed: false,
    // false: the session recorder is already running, so nothing gates
    // the images except their own load, and durationSeconds is therefore
    // the exact on-screen time. See the RECORDING note at the top.
    doRecording: false,
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
        // pageColor (the actual image-display area, distinct from the
        // outer backgroundColor margin) defaults to white if unset - that
        // default is what was showing through as the white trial
        // background.
        pageColor: BACKGROUND_COLOR,
        autoProceed: true,
        showProgressBar: false,
        showCursor: false,
      },
    },
  };
}

// Returns { frames, sequence } fragments for the trial portion only - the
// caller (protocol.js) merges these into the full study frames/sequence
// alongside the intro/consent/outro frames. The fragment is bracketed by
// the session-recording start/stop frames, so the recorder covers every
// trial and nothing else.
function buildTrialFrames(plan) {
  const startFrame = buildStartRecordingFrame();
  const stopFrame = buildStopRecordingFrame();

  const frames = { [startFrame.id]: startFrame };
  const sequence = [startFrame.id];

  plan.forEach((trial, index) => {
    const { id, frame } = buildTrialGroup(trial, index);
    frames[id] = frame;
    sequence.push(id);
  });

  frames[stopFrame.id] = stopFrame;
  sequence.push(stopFrame.id);

  return { frames, sequence };
}

module.exports = {
  buildAttentionGetterFrame,
  buildStartRecordingFrame,
  buildStopRecordingFrame,
  buildIsiFrame,
  buildTrialImageFrame,
  buildTrialGroup,
  buildTrialFrames,
};
