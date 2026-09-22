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
// The spoken label is what makes the last factor real. Without it the two
// target assignments land on an identical screen and collapse to one
// trial type - which is why this file returned 60 pairs while the label
// was dropped. With "Look at the ball!" playing on every trial, target
// and lure are different roles for the same two images, so the ordered
// pair is the trial type, exactly as in the MATLAB original.
//
// The same 120 can be indexed two ways, and both views are carried on
// every pair object because different consumers want different ones:
//
//   by SCREEN        cellID (60) x target assignment (2)
//   by ORDERED PAIR  orderedPairID (30) x targetLureFamiliarity (4)
//
// The second is GenerateTrials_Simsom_LWL.m's own structure
// (Stimuli.Pairs{pairing}{counterbalance}), and it is what
// chooseSessionTrials in randomization.js counterbalances over: all 30
// pairings present per child, 2 of the 4 familiarity variants each.

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

module.exports = { TOKENS, FAMILIARITIES, getAllPairs, imageFilename };
