// Seeded trial-set generation.
//
// No global cross-participant state: generateProtocol only ever sees THIS
// session's (child, pastSessions), so there's no participant counter to
// base a rotation/pointer/Latin-square-position on. A seeded PRNG is the
// substitute.
//
// The seed itself is supplied by the caller. protocol.js passes fresh
// entropy per session (see makeSessionSeed there), so every run gets a new
// order; passing a fixed string instead makes the whole session
// reproducible, which is what the checks below and any ad-hoc replay rely
// on. This module is agnostic: same seed in, same session out.
//
// Design translation from GenerateTrials_Simsom_LWL.m (see README for the
// full writeup): the MATLAB script's only real, verified guarantee is
// "every macro-block is a complete, evenly-covered set, shuffled within
// itself for random adjacency" - it does NOT balance side (L/R) at any
// scale, just draws it IID per trial. Now that the inventory is
// objects-only (60 pairs) and the session is 60 trials, one child's session
// IS exactly one such complete macro-block: every pair appears once, in a
// seeded per-child random order. Side assignment mirrors MATLAB exactly:
// IID Bernoulli(0.5) per trial, no forced split.

const { AG_PROBABILITY_BY_GAP, AG_SHAPES, AG_SOUNDS, AG_MOTIONS, ISI_SECONDS_RANGE, NUM_TRIALS } = require('./config');

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

// Mirrors the MATLAB draws one for one: is_AG_right = randi([0,1]), then
// datasample over shapes, sounds and motions. Same order, same count of
// draws, so the seeded stream stays interpretable.
function buildAttentionGetter(rng) {
  return {
    side: rng() < 0.5 ? 'left' : 'right',
    shape: pickOne(AG_SHAPES, rng),
    sound: pickOne(AG_SOUNDS, rng),
    motion: pickOne(AG_MOTIONS, rng),
  };
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

  // Seeded permutation of the whole pair inventory, take the first N. With
  // numTrials === allPairs.length (60 = 60, the intended configuration)
  // the slice is a no-op and this is complete coverage: every child sees
  // every pair exactly once, only the order and side assignment differ
  // between children. That is the full-shuffle-within-a-complete-block step
  // GenerateTrials_Simsom_LWL.m does, now at the level of a single session.
  // The slice is kept so a smaller numTrials (e.g. for a pilot) still
  // yields a uniform random subset rather than throwing.
  const chosenPairs = shuffle(allPairs, childRng).slice(0, numTrials);

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
      attentionGetter = buildAttentionGetter(sessionRng);
      trialsSinceLastAG = 0;
    }

    const sideOfA = childRng() < 0.5 ? 'left' : 'right';

    // Continuous uniform draw on [1, 2) seconds, independently per trial -
    // matches Experiment_Simsom_LWL.m's Parameters.ISI = [1, 2]. Rounded to
    // the millisecond because this value goes straight into the frame's
    // durationSeconds (and into the exported data), where 16 significant
    // digits of a float are noise: the browser's own timer resolution is
    // coarser than that.
    //
    // Drawn unconditionally from childRng, then discarded on
    // attention-getter trials, where the AG's own Post_wait stands in for
    // the ISI (see frames.js's buildTrialGroup). Drawing first and
    // discarding after keeps exactly one childRng draw per trial, so the
    // image-trial stream stays independent of which trials the session's
    // AG schedule happens to land on.
    const isiDraw =
      Math.round((isiRange[0] + childRng() * (isiRange[1] - isiRange[0])) * 1000) / 1000;
    const isiSeconds = attentionGetter ? null : isiDraw;

    plan.push({
      pairID: pair.pairID,
      imageA: pair.imageA,
      imageB: pair.imageB,
      sideOfA,
      attentionGetter,
      isiSeconds,
    });
  }

  return plan;
}

module.exports = { createRng, shuffle, pickOne, generateSessionPlan };
