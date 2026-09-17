// Fixed inventory of the 60 unique image pairs, derived from the same
// within-category factorial as GenerateTrials_Simsom_LWL.m, restricted to
// the objects category (the body-part category has been dropped from this
// study entirely):
//
//   6 object tokens, all unordered token pairs (6 choose 2 = 15),
//   x4 familiarity combinations per token pair (FF, UU, and the two mixed
//     F/U assignments, which are genuinely different images) = 60 pairs.
//
// The MATLAB code gets to its own inventory via a different route: it builds
// *ordered* (target, lure) token pairs x4 familiarity combos, which
// double-count each unordered image pair once per direction (target=A/lure=B
// and target=B/lure=A land on the same two images). Once the spoken label -
// and the target/lure role it created - is dropped, only the unordered pair
// survives, so the objects half of MATLAB's 240 raw slots (120) halves to
// these 60. Same inventory, no label.
//
// 60 pairs is exactly NUM_TRIALS (config.js), so every child sees the
// complete inventory once - see randomization.js.

const TOKENS = ['car', 'ball', 'blocks', 'keys', 'fridge', 'drawer'];

const FAMILIARITIES = ['F', 'U'];

function imageFilename(familiarity, token) {
  return `${familiarity}_${token}.png`;
}

// Canonical pairID: tokenLow-tokenHigh-famOfLowfamOfHigh, tokens sorted
// alphabetically so the ID is stable regardless of trial-time side
// assignment. e.g. "ball-blocks-FU" -> imageA = F_ball.png (the "low"
// token), imageB = U_blocks.png (the "high" token). Side (sideOfA) is
// decided per trial by randomization.js, not baked into the ID.
//
// There is no longer a category segment in the ID (it used to read
// "toys-ball-blocks-FU"): with body parts gone there is only one category,
// so the segment carried no information.
//
// Dash-only (no underscores): pairID gets spliced directly into Lookit
// frame ids (frames.js), and Lookit frame ids may only contain letters,
// numbers, and dashes - an underscore anywhere in one produces a silent
// console-only validation error with no on-screen message.
function getAllPairs() {
  const pairs = [];
  const sortedTokens = [...TOKENS].sort();

  for (let i = 0; i < sortedTokens.length; i++) {
    for (let j = i + 1; j < sortedTokens.length; j++) {
      const tokenLow = sortedTokens[i];
      const tokenHigh = sortedTokens[j];

      for (const famLow of FAMILIARITIES) {
        for (const famHigh of FAMILIARITIES) {
          pairs.push({
            pairID: `${tokenLow}-${tokenHigh}-${famLow}${famHigh}`,
            imageA: imageFilename(famLow, tokenLow),
            imageB: imageFilename(famHigh, tokenHigh),
          });
        }
      }
    }
  }

  return pairs;
}

module.exports = { TOKENS, FAMILIARITIES, getAllPairs, imageFilename };
