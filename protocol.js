// Lookit Ember Frameplayer protocol generator for the visual-salience
// two-alternative preferential-looking study (adapted from the Simsom LWL
// MATLAB paradigm, spoken labels dropped - see README for the full design
// writeup and open items).
//
// require()/module.exports below are for local Node development and
// testing only (`node scripts/build.js` flattens this + src/*.js into a
// single dependency-free script for pasting into the Lookit builder, which
// expects one self-contained generateProtocol(child, pastSessions)).

const { getAllPairs } = require('./src/pairs');
const { generateSessionPlan } = require('./src/randomization');
const { buildTrialFrames } = require('./src/frames');
const {
  VIDEO_CONFIG,
  VIDEO_CONSENT,
  WELCOME_INSTRUCTIONS,
  SETUP_INSTRUCTIONS_1,
  STUDY_INTRO_VIDEO,
  SETUP_INSTRUCTIONS,
  FINAL_REMINDERS,
  FINAL_SETUP_INSTRUCTIONS,
  WEBCAM_DISPLAY_CHECK,
  STUDY_OUTRO,
  FEEDBACK_SURVEY,
  STUDY_DEBRIEF,
} = require('./src/text');

// Lookit's own protocol-generator docs list child's accessible fields as
// givenName/birthday/gender/ageAtBirth/additionalInformation/languageList/
// conditionList (all via child.get(...), since child is an Ember object,
// not a plain JS object) - no `id` field is documented. Ember Data records
// commonly expose `id` as a plain property outside that attributes hash,
// so it's tried first, but this is NOT confirmed against a live Lookit
// session. VERIFY on first real preview: register two different preview
// children and confirm they get different trial sequences. If they don't,
// child.id isn't resolving and this needs a different identifier.
function getChildId(child) {
  if (!child) return 'anonymous';
  if (child.id) return `id:${child.id}`;
  if (typeof child.get === 'function') {
    const givenName = child.get('givenName');
    const birthday = child.get('birthday');
    if (givenName || birthday) {
      // eslint-disable-next-line no-console
      console.warn('generateProtocol: child.id unavailable, falling back to givenName+birthday for seeding.');
      return `name:${givenName}|birthday:${birthday}`;
    }
  }
  // eslint-disable-next-line no-console
  console.warn("generateProtocol: no usable child identifier found - falling back to 'anonymous'. Every child would get an identical session; this must not happen in production.");
  return 'anonymous';
}

function generateProtocol(child, pastSessions) {
  const childId = getChildId(child);

  const allPairs = getAllPairs();
  const plan = generateSessionPlan(childId, allPairs);
  const { frames: trialFrames, sequence: trialSequence } = buildTrialFrames(plan);

  const frames = {
    'video-config': VIDEO_CONFIG,
    'video-consent': VIDEO_CONSENT,
    'welcome-instructions': WELCOME_INSTRUCTIONS,
    'setup-instructions-1': SETUP_INSTRUCTIONS_1,
    'study-intro-video': STUDY_INTRO_VIDEO,
    'setup-instructions': SETUP_INSTRUCTIONS,
    'final-reminders': FINAL_REMINDERS,
    'final-setup-instructions': FINAL_SETUP_INSTRUCTIONS,
    'webcam-display-check': WEBCAM_DISPLAY_CHECK,
    ...trialFrames,
    'study-outro': STUDY_OUTRO,
    feedback: FEEDBACK_SURVEY,
    'study-debrief': STUDY_DEBRIEF,
  };

  const sequence = [
    'welcome-instructions',
    'video-config',
    'video-consent',
    'setup-instructions-1',
    'study-intro-video',
    'setup-instructions',
    'final-reminders',
    'final-setup-instructions',
    'webcam-display-check',
    ...trialSequence,
    'study-outro',
    'feedback',
    'study-debrief',
  ];

  return { frames, sequence };
}

module.exports = { generateProtocol };
