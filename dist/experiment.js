function generateProtocol(child, pastSessions) {

// How many trials each child sees. The inventory is 120 (pairs.js: 30
// ordered target-lure pairings x 4 familiarity variants), so a child sees
// half of it

const NUM_TRIALS = 60;

// Matches GenerateTrials_Simsom_LWL.m's ImageTime exactly.
const TRIAL_IMAGE_SECONDS = 6;


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

const AG_VIDEO_SECONDS = 6.25;

const AG_VIDEO_SUBFOLDER = 'AG_videos';

// How long exp-lookit-stop-recording will wait for the whole-session video
// to finish uploading before giving up and moving on.
const SESSION_MAX_UPLOAD_SECONDS = 300;

// Traced from Setup_Display.m: Window.gray = 50 (0-255 scale) is the
// background used everywhere in this MATLAB codebase (Window.bcolor =
// Window.gray). RGB(50,50,50).
const BACKGROUND_COLOR = 'rgb(50, 50, 50)';


const TRIAL_IMAGE_WIDTH_PERCENT = 38;
const TRIAL_IMAGE_HEIGHT_PERCENT = 95;
const TRIAL_IMAGE_TOP_PERCENT = (100 - TRIAL_IMAGE_HEIGHT_PERCENT) / 2;
const TRIAL_IMAGE_MARGIN_PERCENT = (7 / 445) * 100;
const TRIAL_IMAGE_LEFT_MARGIN_PERCENT = TRIAL_IMAGE_MARGIN_PERCENT;
const TRIAL_IMAGE_RIGHT_LEFT_PERCENT = 100 - TRIAL_IMAGE_MARGIN_PERCENT - TRIAL_IMAGE_WIDTH_PERCENT;

const STIMULI_BASE_URL = 'https://github.com/scaffolding-of-cognition-team/visual-saliency-chs/raw/main/stimuli/';

// Subfolder under STIMULI_BASE_URL holding the trial images.
const TRIAL_IMAGE_SUBFOLDER = 'Toys';

const IMG_BASE_URL = 'https://github.com/scaffolding-of-cognition-team/visual-saliency-chs/raw/main/img/';

// ---- src/pairs.js ----
// Fixed inventory of the 120 unique trial types, derived from the same
// within-category factorial as GenerateTrials_Simsom_LWL.m, restricted to
// the objects category (the body-part category has been dropped from this
// study entirely):
//
//   6 object tokens, all unordered token pairs (6 choose 2 = 15),
//   x4 familiarity combinations per token pair (FF, UU, and the two mixed
//     F/U assignments, which are genuinely different images) = 60 image
//     pairs ("cells"),
//   x2 target assignments (either token can be the one named) = 120.
//

const TOKENS = ['car', 'ball', 'blocks', 'keys', 'fridge', 'drawer'];

const FAMILIARITIES = ['F', 'U'];

function imageFilename(familiarity, token) {
  return `${familiarity}_${token}.png`;
}

// Three nested ids, each used by a different consumer:
//
//   tokenPairID  "ball-blocks"              - the 15 token pairings.
//                                             the unordered view; see
//                                             orderedPairID below for the
//                                             one the sequence is built on.
//   cellID       "ball-blocks-FU"           - the 60 distinct SCREENS.
//                                             Every child sees each one
//                                             exactly once.
//   pairID       "ball-blocks-FU-target-ball" - the 120 trial types, and
//                                             what gets spliced into the
//                                             Lookit frame id.
//
// Tokens are sorted alphabetically within a pair so ids are stable
// regardless of trial-time side assignment: imageA is always the
// alphabetically-lower token, imageB the higher, and which SIDE each one
// lands on is decided per trial by randomization.js (sideOfA).
//
// Dash-only (no underscores): pairID gets spliced directly into Lookit
// frame ids (frames.js), and Lookit frame ids may only contain letters,
// numbers, and dashes - an underscore anywhere in one produces a silent
// console-only validation error with no on-screen message. This is also
// why the target is encoded as "-target-ball" rather than a "_" or ":"
// separator.
function getAllPairs() {
  const pairs = [];
  const sortedTokens = [...TOKENS].sort();

  for (let i = 0; i < sortedTokens.length; i++) {
    for (let j = i + 1; j < sortedTokens.length; j++) {
      const tokenLow = sortedTokens[i];
      const tokenHigh = sortedTokens[j];
      const tokenPairID = `${tokenLow}-${tokenHigh}`;

      for (const famLow of FAMILIARITIES) {
        for (const famHigh of FAMILIARITIES) {
          const cellID = `${tokenPairID}-${famLow}${famHigh}`;

          // Both target assignments for this screen, low-token first so
          // emission order is deterministic given the seed rather than
          // dependent on iteration order.
          for (const targetToken of [tokenLow, tokenHigh]) {
            const targetIsLow = targetToken === tokenLow;
            pairs.push({
              pairID: `${cellID}-target-${targetToken}`,
              cellID,
              tokenPairID,
              // "FF" / "FU" / "UF" / "UU" - familiarity of the LOW token
              // then the HIGH token. Screen-level view; the sequence
              // builder uses targetLureFamiliarity instead.
              familiarityCombo: `${famLow}${famHigh}`,
              // The MATLAB parameterization: the 30 ordered (target,
              // lure) token pairings, each with 4 (targetFam, lureFam)
              // counterbalance variants. Same 120 trial types as the
              // screen-based view above, re-indexed - a trial type is
              // (target token, target familiarity, lure token, lure
              // familiarity) either way, and 6x2x5x2 = 15x4x2 = 120.
              // GenerateTrials_Simsom_LWL.m builds Stimuli.Pairs on
              // exactly this grouping, so the counterbalancing in
              // randomization.js works on it directly.
              orderedPairID: `${targetToken}-to-${targetIsLow ? tokenHigh : tokenLow}`,
              targetLureFamiliarity: targetIsLow ? `${famLow}${famHigh}` : `${famHigh}${famLow}`,
              // Familiarity of the NAMED image and of the distractor.
              // These, not famLow/famHigh, are what the analysis cares
              // about, and what chooseSessionTrials balances.
              targetFamiliarity: targetIsLow ? famLow : famHigh,
              lureFamiliarity: targetIsLow ? famHigh : famLow,
              imageA: imageFilename(famLow, tokenLow),
              imageB: imageFilename(famHigh, tokenHigh),
              targetToken,
              lureToken: targetToken === tokenLow ? tokenHigh : tokenLow,
              // Which of the two image slots is the named one. Recorded
              // so the analysis does not have to re-derive it from the
              // filename, and so frames.js can tag the image ids.
              targetImage: targetToken === tokenLow ? 'imageA' : 'imageB',
            });
          }
        }
      }
    }
  }

  return pairs;
}

// ---- src/randomization.js ----
// Seeded trial-set generation. every pair appears once, in a
// seeded per-child random order. Side assignment mirrors MATLAB exactly:
// IID Bernoulli(0.5) per trial, no forced split.


// Small deterministic PRNG (mulberry32, seeded via xmur3 string hashing).
// Plain public-domain utility pattern - no Math.random() anywhere in this
// file, so a given childId always produces the same session.
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed) {
  let state = seed;
  return function () {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seedString) {
  const seedFn = xmur3(String(seedString));
  return mulberry32(seedFn());
}

function shuffle(array, rng) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickOne(list, rng) {
  return list[Math.floor(rng() * list.length)];
}


const flipSide = (side) => (side === 'left' ? 'right' : 'left');

// Shuffled-bag ("deck") sampler: deal a shuffled copy of `items` one at a
// time, reshuffle once the bag is empty. Sampling WITHOUT replacement
// within each bag is what stops the clumping that plain IID draws produce.

function makeBagSampler(items, rng, options = {}) {
  const avoidImmediateRepeat = options.avoidImmediateRepeat !== false;
  let bag = [];
  let last = null;

  return function draw() {
    if (bag.length === 0) {
      bag = shuffle(items, rng);
      if (avoidImmediateRepeat && items.length > 1 && bag[0] === last) {
        const swapWith = 1 + Math.floor(rng() * (bag.length - 1));
        [bag[0], bag[swapWith]] = [bag[swapWith], bag[0]];
      }
    }
    last = bag.shift();
    return last;
  };
}

// One sampler per factor, so shape / sound / motion / side each cycle
// independently - the factorial (5 x 5 x 3 x 2 = 150 combinations) is
// preserved, and two AGs sharing a shape will still differ in sound and
// motion.
//
// Draw ORDER is unchanged from the MATLAB original (is_AG_right =
// randi([0,1]), then datasample over shapes, sounds, motions); the draw
// COUNT is not, since a reshuffle consumes extra rng values. That only
// affects sessionRng, which nothing else depends on - childRng, and so
// every image trial, is untouched (see the two-stream note below).
function makeAttentionGetterSampler(rng) {
  const drawSide = makeBagSampler(['left', 'right'], rng, { avoidImmediateRepeat: false });
  const drawShape = makeBagSampler(AG_SHAPES, rng);
  const drawSound = makeBagSampler(AG_SOUNDS, rng);
  const drawMotion = makeBagSampler(AG_MOTIONS, rng);

  return function buildAttentionGetter() {
    return {
      side: drawSide(),
      shape: drawShape(),
      sound: drawSound(),
      motion: drawMotion(),
    };
  };
}

// Builds the child's 60-trial sequence out of the 120-type inventory,
// following GenerateTrials_Simsom_LWL.m's counterbalancing structure.


//  1. Each pairing takes a COMPLEMENTARY pair of variants, either
//
//         {target F + lure F,  target U + lure U}     ("matched")
//         {target F + lure U,  target U + lure F}     ("mixed")
//
//     so it contributes one familiar and one unfamiliar target, and one
//     familiar and one unfamiliar lure. Only 2 of the 6 possible
//     2-subsets do this; uniform-over-6 left familiar-target trials
//     swinging 19-40 out of 60.
//
//  2. The two directions of a token pair take OPPOSITE groups - if
//     ball->blocks is matched, blocks->ball is mixed. Letting them choose
//     independently (the literal MATLAB reading) keeps target familiarity
//     balanced but lets the four target x lure familiarity CELLS swing
//     from 5 to 25 out of 60, because a pairing contributes 2 cells from
//     one diagonal and the split across 30 pairings is then binomial.
//     Opposing them makes every token pair contribute exactly one trial
//     to each cell: 15/15/15/15, every child.
//
function chooseSessionTrials(allPairs, rng) {
  // tokenPairID -> orderedPairID -> targetLureFamiliarity -> pair
  const byTokenPair = new Map();
  for (const pair of allPairs) {
    if (!byTokenPair.has(pair.tokenPairID)) {
      byTokenPair.set(pair.tokenPairID, new Map());
    }
    const directions = byTokenPair.get(pair.tokenPairID);
    if (!directions.has(pair.orderedPairID)) {
      directions.set(pair.orderedPairID, new Map());
    }
    directions.get(pair.orderedPairID).set(pair.targetLureFamiliarity, pair);
  }

  const MATCHED = ['FF', 'UU'];
  const MIXED = ['FU', 'UF'];

  // Sorted so iteration order is the seed's business, not the Map's.
  const tokenPairIDs = [...byTokenPair.keys()].sort();
  const blocks = [[], []];

  for (const tokenPairID of tokenPairIDs) {
    const directions = byTokenPair.get(tokenPairID);
    const directionIDs = [...directions.keys()].sort();
    if (directionIDs.length !== 2) {
      throw new Error(`Token pair ${tokenPairID} has ${directionIDs.length} directions, expected 2`);
    }

    // One coin flip decides which direction is matched; the other is
    // mixed. Constraint 2 above.
    const matchedFirst = rng() < 0.5;
    const groups = matchedFirst ? [MATCHED, MIXED] : [MIXED, MATCHED];

    directionIDs.forEach((directionID, index) => {
      const variants = directions.get(directionID);
      if (variants.size !== 4) {
        throw new Error(`Pairing ${directionID} has ${variants.size} variants, expected 4`);
      }
      const group = groups[index];
      // A further flip per direction so that which of the group's two
      // variants lands in block 1 is not fixed by 'FF' < 'UU' - otherwise
      // every child's first half would hold every familiar-target trial.
      const flip = rng() < 0.5;
      blocks[0].push(variants.get(group[flip ? 1 : 0]));
      blocks[1].push(variants.get(group[flip ? 0 : 1]));
    });
  }

  // Shuffle within each block, then concatenate. Deliberately NOT a
  // global shuffle of all 60: the block structure is what guarantees a
  // pairing's two trials fall in different halves of the session. (They
  // can still be adjacent ACROSS the seam - last of block 1, first of
  // block 2 - which is true of MATLAB's blocks too.)
  return [...shuffle(blocks[0], rng), ...shuffle(blocks[1], rng)];
}

// Returns an ordered array of trial-unit plans:
//   { pairID, imageA, imageB, sideOfA, attentionGetter, isiSeconds }
// Exactly one of attentionGetter / isiSeconds is non-null per trial: an AG
// replaces the ISI (MATLAB's Post_wait covers that gap instead).
// TWO INDEPENDENT RNG STREAMS, and the split is deliberate:
//
//   childRng   - pair order, side assignment, ISI durations. Seeded from
//                the child's identity, so the image trials are IDENTICAL
//                every time this runs for that child. A reload therefore
//                does NOT reshuffle them and complete 60-pair coverage
//                survives.
//   sessionRng - whether an AG fires on each trial, and each AG's
//                shape/motion/sound/side. Seeded from fresh per-session
//                entropy, so attention getters vary run to run.
//
// They must be separate streams, not one: the number of draws an AG
// consumes varies (0 when it doesn't fire, 5 when it does), so a single
// stream would let the AG schedule shift every downstream image draw - the
// exact coupling this split exists to break. Each stream's consumption is
// now independent of the other's.
function generateSessionPlan(seeds, allPairs, options = {}) {
  const numTrials = options.numTrials || NUM_TRIALS;
  const isiRange = options.isiRange || ISI_SECONDS_RANGE;

  // A bare string is accepted so a single seed still reproduces a whole
  // session (used for replaying a session by hand, and by the checks).
  const { childSeed, sessionSeed } =
    typeof seeds === 'string' ? { childSeed: seeds, sessionSeed: seeds } : seeds;

  if (allPairs.length < numTrials) {
    throw new Error(`Only ${allPairs.length} pairs available, need ${numTrials}`);
  }
  if (!childSeed || !sessionSeed) {
    throw new Error('generateSessionPlan needs both childSeed and sessionSeed');
  }

  const childRng = createRng(childSeed);
  const sessionRng = createRng(sessionSeed);
  const buildAttentionGetter = makeAttentionGetterSampler(sessionRng);
  // Balanced within child: see the targetSide note in the trial loop.
  const drawTargetSide = makeBagSampler(['left', 'right'], childRng, { avoidImmediateRepeat: false });

  // Already ordered (two shuffled blocks), so no global shuffle here -
  // see chooseSessionTrials. Drawn from childRng, so a reload reproduces
  // the same trials for the same child.
  //
  // chooseSessionTrials returns exactly 60. The slice is kept so a
  // smaller numTrials (e.g. for a pilot) still works, but note it then
  // takes a prefix, which eats into block 2 and breaks the "every pairing
  // twice" guarantee.
  const chosenPairs = chooseSessionTrials(allPairs, childRng).slice(0, numTrials);

  let trialsSinceLastAG = 0;
  const plan = [];

  for (let i = 0; i < numTrials; i++) {
    const pair = chosenPairs[i];
    const isFirstTrial = i === 0;

    trialsSinceLastAG += 1;
    const gapIndex = Math.min(trialsSinceLastAG, AG_PROBABILITY_BY_GAP.length) - 1;
    const agProbability = AG_PROBABILITY_BY_GAP[gapIndex];

    // isFirstTrial short-circuits before drawing - mirrors
    // Experiment_Simsom_LWL.m always forcing an AG on the very first trial
    // (Data.AG_session_counter starts empty), rather than rolling for it.
    const showAG = isFirstTrial || sessionRng() < agProbability;

    let attentionGetter = null;
    if (showAG) {
      attentionGetter = buildAttentionGetter();
      trialsSinceLastAG = 0;
    }

    // TARGET side is what gets balanced, and sideOfA is derived from it

    // The 2-item shuffled bag deals exactly 30 left and 30 right per 60-trial session
    const targetSide = drawTargetSide();
    const sideOfA = pair.targetImage === 'imageA' ? targetSide : flipSide(targetSide);

    // Continuous uniform draw on [1, 2) seconds, independently per trial -
    // matches Experiment_Simsom_LWL.m's Parameters.ISI = [1, 2].
    const isiDraw =
      Math.round((isiRange[0] + childRng() * (isiRange[1] - isiRange[0])) * 1000) / 1000;
    const isiSeconds = attentionGetter ? null : isiDraw;

    plan.push({
      pairID: pair.pairID,
      cellID: pair.cellID,
      imageA: pair.imageA,
      imageB: pair.imageB,
      targetToken: pair.targetToken,
      lureToken: pair.lureToken,
      targetImage: pair.targetImage,
      familiarityCombo: pair.familiarityCombo,
      targetFamiliarity: pair.targetFamiliarity,
      lureFamiliarity: pair.lureFamiliarity,
      orderedPairID: pair.orderedPairID,
      targetLureFamiliarity: pair.targetLureFamiliarity,
      sideOfA,
      attentionGetter,
      isiSeconds,
    });
  }

  return plan;
}


function oppositeSide(side) {
  return side === 'left' ? 'right' : 'left';
}

function stimulusUrl(subfolder, filename) {
  return `${STIMULI_BASE_URL}${subfolder}/${filename}`;
}

function buildAttentionGetterFrame(attentionGetter) {
  const { shape, motion, side, sound } = attentionGetter;
  const videoUrl = stimulusUrl(AG_VIDEO_SUBFOLDER, `ag-${shape}-${motion}-${side}.mp4`);
  const audioUrl = stimulusUrl(AG_VIDEO_SUBFOLDER, `ag-sound-${sound}.mp3`);

  return {
    // Shape/motion/side/sound are all recoverable from the frame id, the
    // same way pairID is on trial frames.
    id: `attention-getter-${shape}-${motion}-${side}-${sound}`,
    kind: 'exp-lookit-video',
    video: {
      source: [{ src: videoUrl, type: 'video/mp4' }],
      position: 'fill',
      loop: false,
    },
    audio: {
      source: [{ src: audioUrl, type: 'audio/mp3' }],
      loop: false,
    },
    // Advance on the video finishing once (it is exactly AG_VIDEO_SECONDS
    // long, Post_wait included). The audio track is the same length and is
    // deliberately NOT a gate - requireAudioCount 0 - so a slow-loading
    // sound can never hold the trial block up.
    requireVideoCount: 1,
    requireAudioCount: 0,
    autoProceed: true,
    backgroundColor: BACKGROUND_COLOR,
    // false: the session recorder installed by the start-recording frame
    // is already running. See the RECORDING note at the top of this file.
    doRecording: false,
  };
}

function buildStartRecordingFrame() {
  return {
    id: 'start-session-recording',
    kind: 'exp-lookit-start-recording',
    backgroundColor: BACKGROUND_COLOR,
    displayFullscreen: true,
    waitForVideoMessage: 'Getting the study ready, please wait...',
  };
}

function buildStopRecordingFrame() {
  return {
    id: 'stop-session-recording',
    kind: 'exp-lookit-stop-recording',
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
    // The spoken label, naming one of the two images. The silence that
    // places the noun at LABEL_NOUN_ONSET_SECONDS is baked into the file. The
    // frame's own `durationSeconds` still ends the trial at exactly 6s;
    // the clip runs out around 3.8s, so it never gates anything.
    audio: [
      {
        src: stimulusUrl(LABEL_AUDIO_SUBFOLDER, `label-${trial.targetToken}.mp3`),
        type: 'audio/mp3',
      },
    ],
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
    // recoverable from exported session data without a side channel. The
    // pairID now ends in "-target-<token>", so which image was named is
    // recoverable the same way - as is the label URL, which EFP records
    // as `audioPlayed`.
  };
}

function buildTrialGroup(trial, index) {
  const frameList = [];

  // An attention getter REPLACES the ISI rather than preceding it, matching
  // the MATLAB script: its AG block ends with `pause(Post_AG_wait)` (0.25s,
  // baked into the tail of every AG clip) and then the trial starts
  // immediately. Only trials with no AG get the 1-2s blank ISI.
  if (trial.attentionGetter) {
    frameList.push(buildAttentionGetterFrame(trial.attentionGetter));
  } else {
    frameList.push(buildIsiFrame(trial.isiSeconds));
  }

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
        // MUST be set explicitly. The pause-unpause mixin defaults this to
        // true, but exp-lookit-images-audio overrides it back to false as a
        // component default (`pauseWhenExitingFullscreen: false, //
        // pause-unpause mixin`), so every image trial and every ISI frame
        // silently ran on through a fullscreen exit. exp-lookit-video (the
        // attention getters) does NOT override it, so AG frames were
        // already pausing - which is why the behaviour looked intermittent
        // rather than absent.
        //
        // This also fixes the Escape key. exp-player's keydown handler
        // calls exitFullscreen() and then showConfirmationDialog() (the
        // Continue/Exit box in the corner that the study copy describes),
        // but with no pause the trials kept advancing behind that dialog
        // while the parent decided. Now the exit-fullscreen half of that
        // handler pauses the trial too.
        pauseWhenExitingFullscreen: true,

        pauseColor: BACKGROUND_COLOR,
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


const ESCAPE_PAUSE_EXIT_TRANSCRIPT_BLOCK = {
  text:
    'You can pause the study at any time by pressing the space bar. You will see a "Study paused" ' +
    'message; press the space bar again when you are ready to start back up. The study also pauses on its own ' +
    'if you leave full screen or switch to another tab or window, and the message will ask you to return to ' +
    'full screen first. \n\n' +
    'To stop the study early, press the escape key. That pauses the study and brings up a box in the top right ' +
    'hand corner. You can press "Continue" if you think your child would like to keep going, or "Exit" if you ' +
    'or your child wants to stop the study early.',
};

const VIDEO_CONFIG = {
  kind: 'exp-video-config',
  troubleshootingIntro:
    'If you are having trouble getting this experiment set up, please feel free to contact Nicole Sahrling by ' +
    'email at <b>soc-participate@stanford.edu</b>, and I would be happy to help you out!',
};

const VIDEO_CONSENT = {
  kind: 'exp-lookit-video-consent',
  template: 'consent_005',
  PIName: 'Dr. Cameron Ellis, PhD',
  institution: 'Stanford University',
  PIContact: 'Dr. Cameron Ellis at (650) 308-6130',
  purpose:
    'Your child is invited to participate in a research study on infant cognition. The aim of this research is to investigate how infants see, learn, remember, and pay attention. ',
  procedures:
    'With your permission, your child’s face and gaze will be video recorded while they are presented with a ' +
    'variety of stimuli. We are interested in which stimuli your child engages with for longer periods of time. ' +
    'We will ask you (the parent) to turn away from the screen to avoid influencing your child’s responses.',
  risk_statement:
    'The risks associated with this study are minimal. Standard computer displays will be used, involving ' +
    'child-friendly images and videos. If you or your child experience any discomfort, you may end the session ' +
    'with no penalty. The data collected will be stored securely, in compliance with Stanford University ' +
    'standards, minimizing the risk of a confidentiality breach. There are no anticipated risks associated with ' +
    'participating.',
  voluntary_participation: '',
  payment:
    'As a token of appreciation for your child’s participation, we will send you a ' +
    'digital code to a $5 e-gift ' +
    'card. To be eligible, your child must fall within the age range, you will need to submit a valid consent ' +
    'statement, and your child’s face must be visible during the consent process. After you have finished the ' +
    'study, we will message you with a digital code to the e-gift card within a week. We will still send you an ' +
    'e-gift card in the event you and your child cannot finish the study or you choose to withdraw at any time. ' +
    'We cannot and do not guarantee or promise that you and your child will receive any benefits from this study.',
  // Renders as a paragraph at the END of the consent form's "How we use
  // your data" section, right after the template's boilerplate
  // ("...whether siblings tend to respond similarly... family demographic
  // survey data."). consent-template005/template.hbs wraps it in
  // {{#if datause}}, so '' omits the paragraph entirely - which is what
  // this used to be.
  datause: 'With your permission, the recordings will be used for analysis.',
  include_databrary: true,
  additional_video_privacy_statement: '',
  gdpr: false,
  research_rights_statement:
    'If you have read this form and have decided to allow your child to participate in this project, please ' +
    'understand your child’s participation is voluntary and as their parent or legal guardian, you have the ' +
    'right to withdraw consent or discontinue participation at any time without penalty or loss of benefits to ' +
    'which they are otherwise entitled. The alternative is not to participate. You and your child have the right ' +
    'to refuse to answer particular questions. Your child’s face will be video recorded so we can track their eye ' +
    'movements offline for our research. The results of this research study may be presented at scientific or ' +
    'professional meetings or published in scientific journals. Your child’s individual privacy will be ' +
    'maintained in all published and written data resulting from the study. \n\n Identifiers will be removed ' +
    'from identifiable private information and, after such removal, the information could be used for future ' +
    'research studies or distributed to another investigator for future research studies without additional ' +
    'informed consent from you.',
  additional_segments: [
    {
      title: 'How long we will store your data',
      text:
        'Once the study has concluded, our research team at Stanford University will retain the data collected ' +
        'from you for 5 years, after which we will delete and remove any data from our servers. Lookit stores ' +
        'data indefinitely unless you withdraw your recordings at the end of the study.',
    },
  ],
};

const WELCOME_INSTRUCTIONS = {
  kind: 'exp-lookit-text',
  displayFullscreenOverride: true,
  showPreviousButton: false,
  blocks: [
    { emph: true, title: 'Welcome!', text: 'Thank you for taking the time to participate in our study!' },
    {
      text:
        'This study will take at most 15 minutes of your time, including set up and debrief. Your child needs to ' +
        'be present for about 9 minutes.',
    },
    { text: '\n<u>Here are our estimates for how long each part of this study will take, in order:</u>' },
    {
      listblocks: [
        { text: 'Introduction and setup (happening now) <b>[4 minutes]</b> - your child does <i>not</i> need to be present' },
        { text: 'Consent <b>[1 minute]</b> - your child <i>must</i> be present when you record the consent video' },
        { text: 'Experiment <b>[about 8 minutes]</b> - your child <i>must</i> be present' },
        { text: 'Debrief <b>[2 minutes]</b> - your child does <i>not</i> need to be present' },
      ],
    },
    {
      text:
        '\nYou do not need to have your child with you while you set up. Feel free to leave the window before you start the study so that your child is in a good mood and ready to begin.',
    },
  ],
};


const SETUP_INSTRUCTIONS_1 = {
  kind: 'exp-lookit-instructions',
  displayFullscreenOverride: true,
  showPreviousButton: false,
  nextButtonText: 'Next',
  blocks: [
    {
      emph: true,
      title: 'Check audio!',
      text:
        "Let's make sure your computer audio is working. Please turn up the volume on your computer so that it " +
        'is easy to hear sounds while still being at a comfortable level.',
    },
    {
      mediaBlock: {
        text: "You should hear 'Ready to go!'",
        isVideo: false,
        mustPlay: true,
        warningText: 'Please try playing the sample audio. Make sure you can hear the words clearly!',
        sources: [
          { src: 'https://s3.amazonaws.com/lookitcontents/exp-physics-final/audio/ready.mp3', type: 'audio/mp3' },
          { src: 'https://s3.amazonaws.com/lookitcontents/exp-physics-final/audio/ready.ogg', type: 'audio/ogg' },
        ],
      },
    },
  ],
};

const STUDY_INTRO_VIDEO = {
  kind: 'exp-lookit-instruction-video',
  displayFullscreenOverride: true,
  instructionsVideo: [
    {
      src: 'https://github.com/scaffolding-of-cognition-team/visual-saliency-chs/raw/main/instruction%20videos/chs_instructions_v2.m4v',
      type: 'video/mp4',
    },
  ],
  introText:
    '<b><u>At this point, your child does not have to be here</u></b>. Feel free to occupy them for the next ' +
    'few minutes - we will ask you to go get them in about 3 minutes, once the setup is done and just before ' +
    'we record consent. \n\n Please watch this video for an overview of what will happen during the study. ' +
    '\n(You can read the transcript to the right if you prefer.)',

  transcriptTitle: 'Video Transcript',
  transcriptBlocks: [
    {
      text:
        'At the beginning of the experiment, your child will see a video of an exciting rotating shape, like a ' +
        'star or heart. We call this video the attention getter because we use it to get your child’s attention.',
    },
    {
      text:
        'Then we will show your child two images, which we call an “experimental trial.” These images are ' +
        'naturalistic photos of everyday objects, like blocks, cars, or keys. ' +
        'Halfway through each trial, your child will hear a label naming one of the two images, such as ' +
        '"Look at the blocks!" ' +
        'When your child is watching one of these trials, we will measure how long they want to look at each image on the screen.',
    },
    {
      text:
        'The experiment will start by showing a picture of an attention getter, followed by two objects, side by ' +
        'side. Throughout the study, your child will continue to see attention-getters with various colorful shapes and sounds. This is so we can make sure ' +
        'they are looking at the screen throughout the entire experiment. Each experiment trial, that is the ones with the images and the label, lasts about '+
        'six seconds. Next, we’ll show another trial with two images side by side for another six seconds. '
    },
    {
      text:
        'We will repeat 60 of these experiment trials in total, plus the attention getter trials that ' +
        'will be interleaved throughout the study.',
    },
    {
      text:
        'Together, the attention getter video and the experimental trials take about 8 minutes. ' +
        'After about 8 minutes, the study will end and the videos will stop automatically. ' +
        'Please note that both the attention getters and the experiment trials have sound, so please keep your ' +
        'volume up throughout.',
    },
    ESCAPE_PAUSE_EXIT_TRANSCRIPT_BLOCK,
  ],
  warningText: 'Please watch the video or read the summary before proceeding.',
  nextButtonText: 'Next',
  title: 'Study instructions',
  showPreviousButton: false,
  requireWatchOrRead: true,
};


const SETUP_INSTRUCTIONS = {
  kind: 'exp-lookit-instructions',
  displayFullscreenOverride: true,
  blocks: [
    {
      text:
        'If possible, complete the study in a quiet room, away from windows, open doorways, toys, pets, ' +
        'siblings, etc. In other words, we want to minimize interesting things that your child may want to look ' +
        'at that are not our videos. For example, a home office is better than a busy kitchen. However, we ' +
        'understand that a quiet environment is not always possible!\n\n',
      image: {
        alt: 'No distractions',
        src: `${IMG_BASE_URL}distractions.png`,
        title: 'Setting up the video',
      },
    },
    {
      text: '\n\n Please make sure your webcam is centered on the screen (this should be the case for most laptops). \n\n',
      image: {
        alt: 'Center camera',
        src: `${IMG_BASE_URL}centering.png`,
      },
    },
    {
      text:
        '\n\n If you are using two monitors, please turn one of them off. Make sure that the camera you are ' +
        'using is attached to the same screen that your child is looking at. \n\n',
      image: {
        alt: 'Turn off monitor',
        src: `${IMG_BASE_URL}monitors.png`,
      },
    },

    { text: '\n' },
  ],
  nextButtonText: 'Next',
};


const FINAL_SETUP_INSTRUCTIONS = {
  kind: 'exp-lookit-instructions',
  displayFullscreenOverride: true,
  restartAfterPause: true,
  blocks: [
    {
      title: 'Time to get your child set up!',
      listblocks: [
        {
          text:
            "At this point, you can go get your child and set them up in a high chair or on your lap. Keep your child's body oriented towards the screen so they can look at it if they want to.",
        },
        {
          text:
          'Please put the laptop or computer close to your child, but far enough away that they cannot reach ' +
            'forward and touch the keyboard.'
        },
        {
          text:
            "Make sure that your child's eyes are fully visible, and that your eyes are out of frame, if " +
            "possible. This way, we'll be able to focus on where your baby is looking!",
        },
        {

          text:
            'On the next page, we will ask for your consent to take part <b>[1 minute]</b>. You will record a ' +
            "short video of yourself giving consent, and <b>your child's face needs to be visible in that " +
            'recording</b>, so please have them with you before you continue.',
        },
      ],
    },
    { text: '<u>As a reminder:</u>' },
    {
      listblocks: [
        {
          text:
            "<b>Don’t worry if your child isn’t looking at the screen the entire time!</b> There's no need to " +
            "direct your child's attention towards the screen, or interact with them during the study, since " +
            'we want to know what decisions your child makes on their own.',
        },
        {
          text:
            "Please avoid peeking over your child's shoulder to check their gaze, narrating the experiment, or " +
            'pointing at the screen.',
        },
      ],
    },
    {
      title: 'Ready?',
      emph: true,
      text: "If your child is with you and set up, go ahead and press the 'Record consent' button.",
    },
  ],
  nextButtonText: 'Record consent',
};

const WEBCAM_DISPLAY_CHECK = {
  kind: 'exp-lookit-webcam-display',
  nextButtonText: 'Start the experiment!',
  showPreviousButton: false,
  displayFullscreenOverride: true,
  startRecordingAutomatically: false,
  blocks: [
    {
      title: "Last check: Does the video look good? Are your child's eyes visible?",
      listblocks: [
        {
          text:
            'Now that consent is recorded, please move back out of the camera view if you were in it, so that ' +
            "we can see your child's eyes clearly.",
        },
        { text: 'If the view looks good, you can go ahead and start the experiment! It takes about 8 minutes.' },
      ],
    },
  ],
};

// Checklist of the 12 trial images for the item-experience question, plus
// "None of these". Saved values are the image names, e.g. "F_car".
const ITEM_EXPERIENCE_IDS = [];
const ITEM_EXPERIENCE_LABELS = [];
for (const familiarity of FAMILIARITIES) {
  for (const token of TOKENS) {
    const id = `${familiarity}_${token}`;
    ITEM_EXPERIENCE_IDS.push(id);
    ITEM_EXPERIENCE_LABELS.push(
      `<img class="item-experience-img" src="${STIMULI_BASE_URL}${TRIAL_IMAGE_SUBFOLDER}/${id}.png" alt="${token}">`,
    );
  }
}
ITEM_EXPERIENCE_IDS.push('none');
ITEM_EXPERIENCE_LABELS.push('None of these');

const FEEDBACK_SURVEY = {
  kind: 'exp-lookit-survey',
  displayFullscreenOverride: true,
  formSchema: {
    schema: {
      type: 'object',
      title: 'Wrap-up Questions',
      properties: {
        'instructions-feedback': {

          title: 'How clear were the instructions for this study?',
          type: 'string',
          enum: [
            '1 - Not clear at all',
            '2 - Somewhat unclear',
            '3 - Neither clear nor unclear',
            '4 - Somewhat clear',
            '5 - Extremely clear',
          ],
        },
        'video-feedback': {
          title: 'Did you notice any of the following issues with the study while your child was participating?',
          type: 'array',
          items: {
            type: 'string',
            enum: ["The videos buffered or didn't play smoothly", 'The videos took a long time to load'],
          },
          uniqueItems: true,
        },
        'miscellaneous-feedback': {
          title: 'Is there any other feedback that you would like to share about your experience with this study?',
          type: 'string',
        },
        'item-experience': {
          title:
            'Does your child have any of these exact items in their everyday life (for example, the exact same ' +
           'toy car or ball)? Please check all that apply.',
          type: 'array',
          items: { type: 'string', enum: ITEM_EXPERIENCE_IDS },
          uniqueItems: true,
        },
      },
    },
    options: {
      fields: {
        'instructions-feedback': {
          type: 'radio',
          optionLabels: [
            '1 - Not clear at all',
            '2 - Somewhat unclear',
            '3 - Neither clear nor unclear',
            '4 - Somewhat clear',
            '5 - Extremely clear',
          ],
          hideNone: true,
        },
        'video-feedback': {
          type: 'checkbox',
          optionLabels: ["The videos buffered or didn't play smoothly", 'The videos took a long time to load'],
        },
        'item-experience': {
          type: 'checkbox',
          optionLabels: ITEM_EXPERIENCE_LABELS,
        },
      },
    },
  },
  nextButtonText: 'Next',
};

const STUDY_DEBRIEF = {
  kind: 'exp-lookit-exit-survey',
  doUseCamera: false,
  showDatabraryOptions: true,
  includeWithdrawalExample: true,
  debriefing: {
    title: 'Thank you!',
    emph: true,

    blocks: [
      {
        text:
          '<b>At this point, your child has completed the study and does not need to be present.</b> ' +
          'Here is some more information about the study you and your child just participated in. Feel free to skip this part if you want.',
      },
      { text: '\n' },
      {
        text:
          'This was a study on how babies begin to understand early-learned nouns in their first two years of life.' +
          "Your child first viewed an 'attention-getter' (the colorful shapes and sounds) to ensure " +
          'they were focused on the screen before the trials began. Next, we presented two photos of objects ' +
          'side-by-side on the screen, followed by a verbal cue instructing your child to look at one of the ' +
          'objects on screen. All these images are of unfamiliar toys that your child likely has not had ' +
          'real-world experience with.',
      },
      {
        text:
          'Our goal was to measure at what age infants begin to look at the correct image that corresponds ' +
          'with the label, and if differences emerge across development, or when compared to babies who have had real-world ' +
          'experience with some of the objects.',
      },
      {
        text:
          'We anticipated that children who have direct experience with the objects on screen would learn the ' +
          'words faster. Additionally, we were interested in whether infants found some images more ' +
          'interesting than others in this dataset, and whether these preferences are stable across children.',
      },
      {

        text:
          "If you would like to learn more about early word learning, you can check out this TED Talk: " +
          "<a href='https://www.ted.com/talks/deb_roy_the_birth_of_a_word?subtitle=en' target='_blank' rel='noopener'>The Birth of a Word</a>",
      },
      {
        text:
          'We appreciate your participation in our study. As a token of gratitude, you will receive a $5 Tango ' +
          'gift card as compensation within a week.',
      },
    ],
  },
};

// A blank, instantly self-advancing frame that sits LAST in the sequence
// and exists only to route. It is never really "seen": no images, no
// text, 0.1s long, auto-proceeding.
//
// WHY IT EXISTS. exp-player's exitEarly() does
// `send('next', frames.length - 1)`, so a participant who presses Escape
// -> Exit always lands on whatever frame is last, and the study would
// then end - skipping `feedback`, so they would never be asked for the
// address their gift card goes to. Only one frame is ever shown that way
// (ExperimentParser.parse() flattens groups, so a group cannot smuggle in
// a sequence).
//
// selectNextFrame is the lever: exp-frame-base's next() evaluates it (as
// a STRING, via `Function('return ' + ...)`, so it must begin with
// `function`) and passes it expData, letting this frame look at what has
// already been completed and send the participant back for anything they
// missed. expData is keyed `${index}-${frame.id}`, hence the suffix match.
//
//   completer:    feedback -> debrief -> [here] -> done -> END
//   early exiter: [here] -> feedback -> debrief -> [here] -> done -> END
//
// So BOTH paths end on the debrief ("Thank you!"), which is the point of
// ordering it this way. The list ["-feedback", "-study-debrief"] IS that
// order - the router jumps to the
// first entry not yet in expData, so it resumes at the earliest thing the
// participant missed rather than only ever checking one frame. Putting the
// router last rather than giving feedback and debrief a selectNextFrame
// each is what keeps the order identical: with only two frames at the
// end, whichever is last is necessarily first for an early exiter and
// last for a completer, so one path is always reversed.
//
// If expData is unavailable the router ends the study - exactly the
// behaviour without this frame. That guard is load-bearing: without it,
// "nothing recorded" reads as "nothing completed" and the router would
// send a completer back round forever.
//
// With expData present a loop cannot happen, because each backward jump
// is to a frame that then writes its own key, so the next pass through
// finds it done. The one residual case is a frame whose save never lands
// at all - but EFP surfaces save failures itself, and the study is
// already broken at that point.
//
// displayFullscreen:false is REQUIRED. exp-lookit-images-audio hardcodes
// `displayFullscreen: true` as a component default ("force fullscreen for
// all uses of this component"), and this frame runs after the exit survey
// has deliberately left fullscreen (installExitFullscreenOnExitSurvey in
// protocol.js). Without the override it would try to re-enter fullscreen
// on the last screen of the study.
const CLOSING_ROUTER = {
  kind: 'exp-lookit-images-audio',
  images: [],
  durationSeconds: 0.1,
  autoProceed: true,
  doRecording: false,
  displayFullscreen: false,
  showProgressBar: false,
  showCursor: false,
  selectNextFrame:
    'function (frames, frameIndex, frameData, expData) {' +
    '  if (!expData) { return frames.length; }' +
    '  var seen = Object.keys(expData);' +
    '  var done = function (suffix) {' +
    '    return seen.some(function (k) { return k.endsWith(suffix); });' +
    '  };' +
    '  var indexOf = function (suffix) {' +
    '    return frames.findIndex(function (f) { return f.id && f.id.endsWith(suffix); });' +
    '  };' +
    '  var pending = ["-feedback", "-study-debrief"].filter(function (s) { return !done(s); });' +
    '  if (!pending.length) { return frames.length; }' +
    '  var i = indexOf(pending[0]);' +
    '  return i === -1 ? frames.length : i;' +
    '}',
};


function makeSessionSeed() {
  const entropy = [
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2),
  ].join('-');
  return `session-${entropy}`;
}

// Seeds the IMAGE-TRIAL stream (pair order, sides, ISIs), which must be
// stable for a given child so that a reload does not reshuffle the trials
// and complete 60-pair coverage survives.
function getChildSeed(child) {
  if (child) {
    if (child.id) return `child:${child.id}`;
    if (typeof child.get === 'function') {
      const emberId = child.get('id');
      if (emberId) return `child:${emberId}`;

      const givenName = child.get('givenName');
      const birthday = child.get('birthday');
      if (givenName || birthday) {
        // eslint-disable-next-line no-console
        console.warn(
          'generateProtocol: child.id unavailable; seeding image trials from givenName+birthday instead. ' +
          'Stable for this child, but two children sharing both would share a trial order.'
        );
        return `child:${givenName}|${String(birthday)}`;
      }
    }
  }

  const fallback = makeSessionSeed();
  // eslint-disable-next-line no-console
  console.warn(
    'generateProtocol: no stable child identifier found. Image-trial order is random this session ' +
    'and WILL reshuffle if the page reloads (so 60-pair coverage is only guaranteed within one ' +
    'uninterrupted run). Randomisation across children is unaffected. Seed: ' + fallback
  );
  return fallback;
}

// Pauses the study whenever the page stops being visible - switching to
// another tab, minimising the window, locking the screen.

function installPauseWhenHidden() {
  // The build's Lookit load check calls generateProtocol under Node, where
  // there is no document - bail rather than throw and fail the build.
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  // generateProtocol can be called more than once per page load; one
  // listener is enough.
  if (window.__pauseWhenHiddenInstalled) return;
  window.__pauseWhenHiddenInstalled = true;

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) return;
    const inFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    if (!inFullscreen) return;
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    // Exiting fullscreen needs no user gesture (entering does), so this is
    // allowed even though it runs while the page is hidden. Firefox
    // rejects the promise if fullscreen has already gone away on its own -
    // that is the outcome we wanted anyway, so swallow it.
    const result = exit.call(document);
    if (result && typeof result.catch === 'function') result.catch(function () {});
  });
}

// Leaves browser fullscreen as soon as the exit survey renders, so its
// withdrawal-confirmation dialog is visible.

function installExitFullscreenOnExitSurvey() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (window.__exitSurveyFullscreenInstalled) return;
  window.__exitSurveyFullscreenInstalled = true;

  function leaveFullscreenIfExitSurveyShowing() {
    if (!document.querySelector('.exp-lookit-exit-survey')) return false;
    const inFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    if (inFullscreen) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      const result = exit.call(document);
      if (result && typeof result.catch === 'function') result.catch(function () {});
    }
    // Found the frame: stop watching either way. If it was already out of
    // fullscreen there is nothing left to do, and the exit survey is
    // terminal, so it will not appear a second time.
    return true;
  }

  if (typeof MutationObserver === 'undefined' || !document.body) return;
  const observer = new MutationObserver(function () {
    if (leaveFullscreenIfExitSurveyShowing()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  if (leaveFullscreenIfExitSurveyShowing()) observer.disconnect();
}

// Removes the attention getter's letterbox strips by letting the clip
// fill the frame, so no CSS background is visible inside an AG at all.

function installVideoFillsFrame() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ag-video-fill')) return;
  const style = document.createElement('style');
  style.id = 'ag-video-fill';
  // The frameplayer's own rule is `width/height: 100% !important` with
  // object-fit: contain, so this needs !important to win.
  style.textContent = '#player-video { object-fit: fill !important; }';
  (document.head || document.documentElement).appendChild(style);
}

// Item-experience checklist: shows the pictures small, in 2 rows of 6,
// with "None of these" on its own row below. Checking "None of these"
// clears the pictures, and checking a picture clears "None of these".
const ITEM_EXPERIENCE_CSS = [
  '.item-experience-img { display: block; width: 100%; max-width: 110px; height: auto; margin: 0 auto; }',
  '.item-experience-img { border: 3px solid transparent; border-radius: 6px; }',
  '.item-experience-grid {',
  '  display: grid; grid-template-columns: repeat(6, minmax(0, 110px)); gap: 10px;',
  '  justify-content: start; margin-bottom: 32px;',
  '}',
  // The question text and anything else in there that is not an option
  // gets its own full-width row.
  '.item-experience-grid > :not(.item-experience-option) { grid-column: 1 / -1; }',
  '.item-experience-option { margin: 0; text-align: center; }',
  '.item-experience-option label { display: block; margin: 0; padding: 0; cursor: pointer; }',
  '.item-experience-option input[type=checkbox] { position: static; margin: 4px auto 0; display: block; }',
  '.item-experience-option.item-experience-checked .item-experience-img { border-color: #337ab7; }',
  '.item-experience-none { grid-column: 1 / -1; margin-top: 12px; text-align: left; }',
  '.item-experience-none label { display: flex; align-items: center; gap: 8px; }',
  '.item-experience-none input[type=checkbox] { margin: 0; }',
].join('\n');

// The element that holds one whole checkbox option.
function optionOf(input) {
  let option = input;
  while (option.parentElement && option.parentElement.querySelectorAll('input[type=checkbox]').length === 1) {
    option = option.parentElement;
  }
  return option;
}

function layOutItemExperience(container) {
  const inputs = Array.prototype.slice.call(container.querySelectorAll('input[type=checkbox]'));
  container.classList.add('item-experience-grid');
  inputs.forEach(function (input) {
    const option = optionOf(input);
    option.classList.add('item-experience-option');
    if (!option.querySelector('.item-experience-img')) option.classList.add('item-experience-none');
    // Put the checkbox under its picture.
    const label = input.closest('label');
    if (label && label.querySelector('.item-experience-img')) label.appendChild(input);
  });
  refreshCheckedHighlight(container);
}

function refreshCheckedHighlight(container) {
  container.querySelectorAll('.item-experience-option').forEach(function (option) {
    const input = option.querySelector('input[type=checkbox]');
    option.classList.toggle('item-experience-checked', !!(input && input.checked));
  });
}

// Finds the checklist once the survey is on screen, if not laid out yet.
function findUnlaidItemExperience() {
  const img = document.querySelector('.item-experience-img');
  if (!img) return null;
  let input = null;
  for (let node = img.parentElement; node && !input; node = node.parentElement) {
    input = node.querySelector('input[type=checkbox]');
  }
  if (!input) return null;
  const option = optionOf(input);
  const container = option.parentElement;
  if (!container || container.classList.contains('item-experience-grid')) return null;
  return container;
}

function installItemExperienceGrid() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (window.__itemExperienceGridInstalled) return;
  window.__itemExperienceGridInstalled = true;

  const style = document.createElement('style');
  style.id = 'item-experience-grid';
  style.textContent = ITEM_EXPERIENCE_CSS;
  (document.head || document.documentElement).appendChild(style);

  if (typeof MutationObserver === 'undefined' || !document.body) return;
  const observer = new MutationObserver(function () {
    const container = findUnlaidItemExperience();
    if (container) layOutItemExperience(container);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // "None of these" vs. the pictures. Each box cleared here also gets a
  // `change` event so the survey saves the cleared state.
  document.addEventListener('change', function (event) {
    const input = event.target;
    if (!input || input.type !== 'checkbox') return;
    const container = input.closest('.item-experience-grid');
    if (!container) return;
    if (input.checked) {
      const isNone = !!input.closest('.item-experience-none');
      container.querySelectorAll('input[type=checkbox]').forEach(function (other) {
        if (other === input || !other.checked) return;
        if (isNone === !!other.closest('.item-experience-none')) return;
        other.checked = false;
        other.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    refreshCheckedHighlight(container);
  });
}

// Warms the browser cache with the trial stimuli while the parent is
// still reading the setup instructions.

function installStimulusPreload(imageUrls, firstVideoUrl) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (window.__stimulusPreloadInstalled) return;
  window.__stimulusPreloadInstalled = true;

  const held = [];
  imageUrls.forEach(function (url) {
    const img = new Image();
    img.src = url;
    held.push(img);
  });

  if (firstVideoUrl) {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.src = firstVideoUrl;
    held.push(video);
  }

  window.__preloadedStimuli = held;
}

// Every distinct trial-image URL in this session's frames, taken from the
// built frames rather than rebuilt from config, so it cannot disagree
// with what the trials actually request.
function trialImageUrls(trialFrames) {
  const urls = [];
  for (const id of Object.keys(trialFrames)) {
    const frame = trialFrames[id];
    if (!frame || frame.kind !== 'group' || !frame.frameList) continue;
    for (const sub of frame.frameList) {
      if (!Array.isArray(sub.images)) continue;
      for (const image of sub.images) {
        if (image && image.src && urls.indexOf(image.src) === -1) urls.push(image.src);
      }
    }
  }
  return urls;
}

// The first attention-getter clip in this session, for the same reason.
function firstAttentionGetterUrl(trialFrames) {
  for (const id of Object.keys(trialFrames)) {
    const frame = trialFrames[id];
    if (!frame || frame.kind !== 'group' || !frame.frameList) continue;
    for (const sub of frame.frameList) {
      if (sub.kind === 'exp-lookit-video' && sub.video && sub.video.source && sub.video.source[0]) {
        return sub.video.source[0].src;
      }
    }
  }
  return null;
}

installVideoFillsFrame();
  installPauseWhenHidden();
  installExitFullscreenOnExitSurvey();
  installItemExperienceGrid();

  const childSeed = getChildSeed(child);
  const sessionSeed = makeSessionSeed();
  // eslint-disable-next-line no-console
  console.log(`generateProtocol: childSeed ${childSeed} | sessionSeed ${sessionSeed}`);

  const allPairs = getAllPairs();
  const plan = generateSessionPlan({ childSeed, sessionSeed }, allPairs);
  const { frames: trialFrames, sequence: trialSequence } = buildTrialFrames(plan);
  installStimulusPreload(trialImageUrls(trialFrames), firstAttentionGetterUrl(trialFrames));

  const frames = {
    'welcome-instructions': WELCOME_INSTRUCTIONS,
    'video-config': VIDEO_CONFIG,
    'setup-instructions-1': SETUP_INSTRUCTIONS_1,
    'study-intro-video': STUDY_INTRO_VIDEO,
    'setup-instructions': SETUP_INSTRUCTIONS,
    'final-setup-instructions': FINAL_SETUP_INSTRUCTIONS,
    'video-consent': VIDEO_CONSENT,
    'webcam-display-check': WEBCAM_DISPLAY_CHECK,
    ...trialFrames,
    feedback: FEEDBACK_SURVEY,
    'study-debrief': STUDY_DEBRIEF,
    'closing-router': CLOSING_ROUTER,
  };


  const sequence = [
    'welcome-instructions',
    'video-config',
    'setup-instructions-1',
    'study-intro-video',
    'setup-instructions',
    'final-setup-instructions',
    'video-consent',
    'webcam-display-check',
    ...trialSequence,
    'feedback',
    'study-debrief',
    // Must stay LAST - it is where exitEarly() lands. See CLOSING_ROUTER.
    'closing-router',
  ];

  return { frames, sequence };
}
