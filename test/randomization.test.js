// Plain Node test (no framework/deps) - run with: node test/randomization.test.js
const assert = require('assert');
const { getAllPairs } = require('../src/pairs');
const { generateSessionPlan } = require('../src/randomization');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    throw err;
  }
}

test('getAllPairs returns exactly 120 unique pairs', () => {
  const pairs = getAllPairs();
  assert.strictEqual(pairs.length, 120);
  const uniqueIds = new Set(pairs.map((p) => p.pairID));
  assert.strictEqual(uniqueIds.size, 120);
});

test('getAllPairs has no within-category token collisions and no self-pairs', () => {
  const pairs = getAllPairs();
  for (const pair of pairs) {
    const tokenA = pair.imageA.slice(2, -4);
    const tokenB = pair.imageB.slice(2, -4);
    assert.notStrictEqual(tokenA, tokenB, `self-pair found: ${pair.pairID}`);
  }
});

test('same childId produces an identical plan (deterministic)', () => {
  const allPairs = getAllPairs();
  const planA = generateSessionPlan('child-123', allPairs);
  const planB = generateSessionPlan('child-123', allPairs);
  assert.deepStrictEqual(planA, planB);
});

test('different childIds produce different plans', () => {
  const allPairs = getAllPairs();
  const planA = generateSessionPlan('child-123', allPairs);
  const planB = generateSessionPlan('child-456', allPairs);
  assert.notDeepStrictEqual(planA, planB);
});

test('each child gets exactly 30 trials, all unique pairIDs', () => {
  const allPairs = getAllPairs();
  const plan = generateSessionPlan('child-abc', allPairs);
  assert.strictEqual(plan.length, 30);
  const uniqueIds = new Set(plan.map((t) => t.pairID));
  assert.strictEqual(uniqueIds.size, 30);
});

test('trial 1 always has an attention-getter', () => {
  const allPairs = getAllPairs();
  for (const childId of ['a', 'b', 'c', 'd', 'e']) {
    const plan = generateSessionPlan(childId, allPairs);
    assert.ok(plan[0].attentionGetter, `child ${childId} missing first-trial AG`);
  }
});

test('an attention-getter never immediately repeats on back-to-back trials', () => {
  const allPairs = getAllPairs();
  for (const childId of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
    const plan = generateSessionPlan(childId, allPairs);
    for (let i = 1; i < plan.length; i++) {
      if (plan[i].attentionGetter) {
        assert.ok(!plan[i - 1].attentionGetter, `child ${childId} has back-to-back AGs at trial ${i}`);
      }
    }
  }
});

test('sideOfA is always left or right, isiSeconds always within [1, 2]', () => {
  const allPairs = getAllPairs();
  const plan = generateSessionPlan('child-xyz', allPairs);
  for (const trial of plan) {
    assert.ok(trial.sideOfA === 'left' || trial.sideOfA === 'right');
    assert.ok(trial.isiSeconds >= 1 && trial.isiSeconds <= 2);
  }
});

test('coverage sanity: across many simulated children, per-pair inclusion is near the expected 25%', () => {
  const allPairs = getAllPairs();
  const numChildren = 200;
  const counts = new Map(allPairs.map((p) => [p.pairID, 0]));

  for (let i = 0; i < numChildren; i++) {
    const plan = generateSessionPlan(`sim-child-${i}`, allPairs);
    for (const trial of plan) {
      counts.set(trial.pairID, counts.get(trial.pairID) + 1);
    }
  }

  const values = [...counts.values()];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  // Expected mean = 200 * 0.25 = 50, SD ~ 6.1. Generous bound (+/- 4 SD)
  // to keep this non-flaky while still catching a broken generator.
  assert.ok(mean > 45 && mean < 55, `mean observations/pair was ${mean}, expected ~50`);
  for (const v of values) {
    assert.ok(v > 20 && v < 80, `pair count ${v} far outside expected range`);
  }
});

console.log('All randomization tests passed.');
