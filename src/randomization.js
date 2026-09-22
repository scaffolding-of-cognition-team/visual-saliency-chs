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

// Local copy of frames.js's helper - these two files are concatenated by
// scripts/build.js into one flat script, so a second top-level `function
// oppositeSide` would be a redeclaration. Kept as a const arrow instead:
// same name, but build.js emits src/*.js before protocol.js and the
// duplicate would only surface at load time, which is exactly the class
// of silent failure the load check exists to catch.
const flipSide = (side) => (side === 'left' ? 'right' : 'left');

// Shuffled-bag ("deck") sampler: deal a shuffled copy of `items` one at a
// time, reshuffle once the bag is empty. Sampling WITHOUT replacement
// within each bag is what stops the clumping that plain IID draws produce.
//
// Why this replaced pickOne for attention-getter properties: MATLAB's
// `datasample` draws IID with replacement, and with only 5 shapes / 5
// sounds and ~15 AGs in a session, that means a 20% chance that any two
// consecutive AGs share a shape, a 37% chance a session contains the same
// shape three times in a row, and ~2.7 back-to-back same-sound pairs per
// session (simulated over 5000 sessions). Statistically unremarkable,
// visibly repetitive to a parent watching, and an AG that has stopped
// being novel has stopped doing its one job.
//
// avoidImmediateRepeat guards the seam between bags - without it, the last
// item of one bag and the first of the next can still match. Implemented
// by swapping the offending first element with a random later one, which
// is cheaper than reshuffling until it passes and keeps every item
// reachable. Left OFF for `side`, where 2 items + no repeats would force
// strict L/R/L/R alternation: perfectly predictable AG locations are worse
// for a frame whose purpose is a known-gaze-direction reference than the
// occasional repeated side.
//
// Marginal frequencies stay uniform; what changes is the spacing. Each
// shape/sound now appears ~3 times per session and each motion ~5, spread
// out rather than clumped.
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
//
// MATLAB's scheme, in its own terms: Stimuli.Pairs is indexed by the 30
// ordered (target, lure) token pairings, each holding 4 counterbalance
// variants - the (targetFamiliarity, lureFamiliarity) combinations. It
// then emits BLOCKS. One block = all 30 pairings, each contributing ONE
// variant, shuffled. `counterbalance_matrix(pair, :) = randperm(4)` picks
// a fresh variant order per pairing, so block k takes each pairing's k-th
// variant, and 4 consecutive blocks exhaust the inventory.
//
// This session is 2 of those blocks: 30 pairings x 2 variants = 60
// trials. So every child sees all 30 target->lure pairings exactly twice,
// with two DIFFERENT familiarity variants, and the two instances of a
// pairing always land in different halves of the session - MATLAB's block
// structure is what spaces them, and it is reproduced here rather than
// flattening everything into one 60-long shuffle.
//
// WHICH 2 of the 4 variants, and how the two DIRECTIONS of a token pair
// relate. MATLAB takes the first 2 of a randperm - a uniform random
// 2-subset, all 6 equally likely, chosen independently for every pairing.
// Two constraints are imposed on top of that, both to buy balance a
// 2-block session cannot get the way MATLAB does (by completing all 4):
//
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
//     It also restores complete SCREEN coverage as a side effect. The
//     matched direction uses screens FF and UU, the mixed one uses FU and
//     UF, so all 4 screens of the token pair appear exactly once - where
//     independent choice showed 2 screens twice and 2 never (only ~45 of
//     the 60 distinct screens per child).
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

    // TARGET side is what gets balanced, and sideOfA is derived from it -
    // not the other way round. Drawing sideOfA directly (as this did,
    // matching MATLAB's is_AG_right = randi([0,1])) leaves target side
    // IID, which was harmless while there was no target but is not now:
    // simulated over 3,000 children it put the target on the left a mean
    // of 30.0/60 times but with a per-child range of 17-41, so 15% of
    // children fell outside 25-35. Combined with an individual side bias
    // that is a within-child confound between target role and side.
    //
    // The 2-item shuffled bag deals exactly 30 left and 30 right per
    // 60-trial session, with avoidImmediateRepeat off for the same reason
    // as the AG's side (see makeBagSampler): banning repeats on a 2-level
    // factor forces strict L/R/L/R alternation, which is predictable to
    // the infant - worse than the occasional doubled side. Runs cap at 2.
    const targetSide = drawTargetSide();
    const sideOfA = pair.targetImage === 'imageA' ? targetSide : flipSide(targetSide);

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

module.exports = {
  createRng,
  shuffle,
  pickOne,
  makeBagSampler,
  makeAttentionGetterSampler,
  chooseSessionTrials,
  generateSessionPlan,
};
