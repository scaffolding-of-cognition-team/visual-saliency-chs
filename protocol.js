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

// Fresh entropy, used to seed the attention-getter stream only. AGs vary
// run to run; the image trials do not (see getChildSeed).
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
//
// Lookit's docs list child's accessible fields as givenName / birthday /
// gender / ageAtBirth / additionalInformation / languageList /
// conditionList, all via child.get(...) - `id` is not documented. But
// `child` is an Ember Data record (exp-player passes `session.child`), and
// those expose the primary key as `.id` outside the attributes hash, so
// that is tried first, then via .get('id'), then a name+birthday composite.
//
// LAST RESORT IS RANDOM, NOT A CONSTANT. An earlier version returned the
// literal 'anonymous' here, which meant every child lacking a resolvable
// id shared one identical pair order - perfectly confounding pair identity
// with serial position across the whole sample. Degrading to random keeps
// the across-child randomisation that actually protects the design, and
// costs only the reload-stability, which is the lesser guarantee.
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

function generateProtocol(child, pastSessions) {
  const childSeed = getChildSeed(child);
  const sessionSeed = makeSessionSeed();
  // eslint-disable-next-line no-console
  console.log(`generateProtocol: childSeed ${childSeed} | sessionSeed ${sessionSeed}`);

  const allPairs = getAllPairs();
  const plan = generateSessionPlan({ childSeed, sessionSeed }, allPairs);
  const { frames: trialFrames, sequence: trialSequence } = buildTrialFrames(plan);

  const frames = {
    'welcome-instructions': WELCOME_INSTRUCTIONS,
    'video-config': VIDEO_CONFIG,
    'setup-instructions-1': SETUP_INSTRUCTIONS_1,
    'study-intro-video': STUDY_INTRO_VIDEO,
    'setup-instructions': SETUP_INSTRUCTIONS,
    'final-reminders': FINAL_REMINDERS,
    'final-setup-instructions': FINAL_SETUP_INSTRUCTIONS,
    'video-consent': VIDEO_CONSENT,
    'webcam-display-check': WEBCAM_DISPLAY_CHECK,
    ...trialFrames,
    'study-outro': STUDY_OUTRO,
    feedback: FEEDBACK_SURVEY,
    'study-debrief': STUDY_DEBRIEF,
  };

  // ORDER NOTE: consent sits late, immediately after the "go get your
  // child" frame, so the child only has to be present once - for consent
  // plus the trials - instead of arriving for consent, leaving for ~4
  // minutes of parent-only setup, and coming back. Lookit's only hard
  // requirement is that consent precede any video recording, in particular
  // the session recorder (see exp-lookit-video-consent's "Do not use with
  // session recording"). Nothing before 'video-consent' here records or
  // collects study data: video-config is camera setup, the rest are text /
  // instruction-video frames, and 'webcam-display-check' has
  // startRecordingAutomatically: false and now runs after consent anyway.
  // The session recorder starts inside the trial block (frames.js's
  // exp-lookit-start-recording), well after consent.
  const sequence = [
    'welcome-instructions',
    'video-config',
    'setup-instructions-1',
    'study-intro-video',
    'setup-instructions',
    'final-reminders',
    'final-setup-instructions',
    'video-consent',
    'webcam-display-check',
    ...trialSequence,
    'study-outro',
    'feedback',
    'study-debrief',
  ];

  return { frames, sequence };
}

module.exports = { generateProtocol };
