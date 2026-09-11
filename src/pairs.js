// Fixed inventory of the 120 unique image pairs, derived from the same
// within-category factorial as GenerateTrials_Simsom_LWL.m:
//
//   6 tokens/category, all unordered token pairs (6 choose 2 = 15/category),
//   x2 categories = 30 unordered token pairs
//   x4 familiarity combinations per token pair (FF, UU, and the two mixed
//     F/U assignments, which are genuinely different images) = 120 pairs.
//
// The MATLAB code gets to 120 via a different route: it builds 60 *ordered*
// (target, lure) token pairs x4 familiarity combos = 240 raw target/lure
// slots, which double-count each unordered image pair once per direction
// (target=A/lure=B and target=B/lure=A land on the same two images). Once
// the spoken label - and the target/lure role it created - is dropped, only
// the unordered pair survives, so 240/2 = 120. Same inventory, no label.

const CATEGORIES = {
  BodyParts: ['nose', 'teeth', 'eye', 'hand', 'shin', 'knee'],
  Toys: ['car', 'ball', 'blocks', 'keys', 'fridge', 'drawer'],
};

const FAMILIARITIES = ['F', 'U'];

function imageFilename(familiarity, token) {
  return `${familiarity}_${token}.png`;
}

// Canonical pairID: category-tokenLow-tokenHigh-famOfLowfamOfHigh, tokens
// sorted alphabetically so the ID is stable regardless of trial-time side
// assignment. e.g. "bodyparts-eye-teeth-FU" -> imageA = F_eye.png (the "low"
// token), imageB = U_teeth.png (the "high" token). Side (sideOfA) is decided
// per trial by randomization.js, not baked into the ID.
//
// Dash-only (no underscores): pairID gets spliced directly into Lookit
// frame ids (frames.js), and Lookit frame ids may only contain letters,
// numbers, and dashes - an underscore anywhere in one produces a silent
// console-only validation error with no on-screen message.
function getAllPairs() {
  const pairs = [];

  for (const [category, tokens] of Object.entries(CATEGORIES)) {
    const sortedTokens = [...tokens].sort();

    for (let i = 0; i < sortedTokens.length; i++) {
      for (let j = i + 1; j < sortedTokens.length; j++) {
        const tokenLow = sortedTokens[i];
        const tokenHigh = sortedTokens[j];

        for (const famLow of FAMILIARITIES) {
          for (const famHigh of FAMILIARITIES) {
            const pairID = `${category.toLowerCase()}-${tokenLow}-${tokenHigh}-${famLow}${famHigh}`;

            pairs.push({
              pairID,
              category,
              imageA: imageFilename(famLow, tokenLow),
              imageB: imageFilename(famHigh, tokenHigh),
            });
          }
        }
      }
    }
  }

  return pairs;
}

module.exports = { CATEGORIES, FAMILIARITIES, getAllPairs, imageFilename };
