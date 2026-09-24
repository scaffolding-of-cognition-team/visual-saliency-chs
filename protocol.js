// Lookit Ember Frameplayer protocol generator for the visual-salience
// two-alternative preferential-looking study (adapted from the Simsom LWL
// MATLAB paradigm, spoken labels dropped - see README for the full design
// writeup and open items).
//
// require()/module.exports below are for local Node development and
// testing only (`node scripts/build.js` flattens this + src/*.js into a
// single dependency-free script for pasting into the Lookit builder, which
// expects one self-contained generateProtocol(child, pastSessions)).

const { BACKGROUND_COLOR, TRIAL_IMAGE_SUBFOLDER } = require('./src/config');
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
  FINAL_SETUP_INSTRUCTIONS,
  WEBCAM_DISPLAY_CHECK,
  FEEDBACK_SURVEY,
  STUDY_DEBRIEF,
  CLOSING_ROUTER,
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

// Pauses the study whenever the page stops being visible - switching to
// another tab, minimising the window, locking the screen.
//
// WHY THIS LIVES HERE AND NOT IN A FRAME PROPERTY. The frameplayer has no
// such property. Its pause-unpause mixin fires on exactly two things:
// the pauseKey, and exiting fullscreen (onFullscreen -> _togglePauseState).
// Nothing in the mixin or in exp-player listens for `visibilitychange`,
// `blur` or `pagehide`, so there is no config that expresses "pause on tab
// switch". Since the whole protocol generator is evaluated in the page,
// attaching the listener here is the only lever available without forking
// ember-lookit-frameplayer.
//
// HOW IT PAUSES. It does NOT reach into Ember or synthesise a keypress -
// both would depend on internals and on _isPaused's current value, and a
// synthetic pauseKey TOGGLES, so it could just as easily unpause. Instead
// it drops fullscreen, which routes into the mixin's own already-enabled
// pauseWhenExitingFullscreen path (set in frames.js). The parent then gets
// the standard "Study paused / Please return to fullscreen" cover and the
// standard recovery flow, with no new UI and no new state to keep in sync.
//
// Chrome may already exit fullscreen on a tab switch, in which case this
// is belt-and-braces there; it is what makes the behaviour deterministic
// on other browsers, and it also covers minimise and screen-lock, which
// do not touch fullscreen anywhere.
//
// NOT covered: switching to another APPLICATION while the browser window
// stays visible does not set document.hidden, so it does not fire. `blur`
// would catch it, but blur also fires on devtools, on clicking the URL
// bar, and on any other focus change - false pauses mid-trial are worse
// here than a missed one, so it is deliberately left out.
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
//
// THE BUG. exp-lookit-exit-survey's withdrawal checkbox opens an
// ember-bootstrap {{#bs-modal}}, and bs-modal renders through a wormhole
// into a destination element appended to <body>. The fullscreen element
// is #experiment-player (full-screen mixin's fullScreenElementId), and
// the browser paints ONLY the fullscreen element's subtree - so the modal
// mounts outside it and is simply never drawn. The parent ticks the
// withdrawal box and nothing appears to happen.
//
// WHY IT IS STILL FULLSCREEN HERE. Nothing in the frameplayer ever leaves
// fullscreen between frames. exp-player's next() calls _transition() and
// sets frameIndex, and neither consults displayFullscreen; the full-screen
// mixin has no willDestroyElement and only exits from displayError() or
// the Escape handler. So fullscreen entered back in the trial block simply
// persists all the way to the end of the study.
//
// Note this frame cannot fix it itself: exp-lookit-exit-survey is
// ExpFrameBaseComponent.extend(Validations) - it mixes in NEITHER
// FullScreen nor PauseUnpause. That is also why the exit is safe: with no
// pause-unpause mixin there is no onFullscreen handler to trip, so
// dropping fullscreen here cannot pause the frame (it would, on a trial
// frame - see frames.js's pauseWhenExitingFullscreen).
//
// Keyed on `.exp-lookit-exit-survey`, the root class in the component's
// own template. The observer disconnects on first hit, and the callback is
// one querySelector per mutation batch until then.
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

// Lays the 12 trial-image checkboxes out as a 6-column grid: one object
// per column, familiar exemplar on the top row and unfamiliar beneath.
//
// WHY IT IS NOT JUST CSS IN THE FRAME CONFIG. exp-lookit-survey renders
// through {{dynamic-form}} -> AlpacaJS, and neither exposes any layout
// control for a checkbox field - options come out as a plain vertical
// list. There is also nowhere in the frame schema to put a stylesheet.
//
// The grid is therefore built by moving the rendered nodes. It keys off
// OUR OWN option values (the image filenames end in .png; the 'none'
// option does not), never off Alpaca's class names, so it does not break
// if the form library restyles. Order comes from TOY_EXPERIENCE_VALUES in
// text.js - all six familiar exemplars, then all six unfamiliar - which a
// row-filling 6-column grid turns into one object per column.
//
// If this never runs, the question still works: it degrades to Alpaca's
// normal vertical list with 'None of these' at the top.
function installToyImageGrid() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (window.__toyImageGridInstalled) return;
  window.__toyImageGridInstalled = true;

  // Keyed off the rendered <img> elements, NOT the checkbox `value`
  // attribute. A first attempt used input[value$=".png"] and silently did
  // nothing: Alpaca sets an option's value as a DOM property, so the
  // attribute selector never matched. The images are the one thing we
  // know is in the DOM, because we put them there (see
  // TRIAL_IMAGE_OPTIONS in text.js) - and their src is the only marker
  // Alpaca cannot rename.
  const IMG_SELECTOR = 'img[src*="/' + TRIAL_IMAGE_SUBFOLDER + '/"]';

  // Deepest element containing every image. Whatever Alpaca wraps each
  // option in, the options are all somewhere under this.
  function commonAncestor(nodes) {
    let node = nodes[0];
    while (node && !nodes.every((n) => node.contains(n))) node = node.parentElement;
    return node;
  }

  // The option's own row: walk up from the image until we are a direct
  // child of the shared container. That lands on whichever wrapper Alpaca
  // used (.checkbox, a bare <label>, a div) without having to name it.
  function rowFor(node, host) {
    let n = node;
    while (n && n.parentElement && n.parentElement !== host) n = n.parentElement;
    return n && n.parentElement === host ? n : null;
  }

  function layOutGrid() {
    const images = Array.prototype.slice.call(document.querySelectorAll(IMG_SELECTOR));
    if (images.length < 2) return false;

    const host = commonAncestor(images);
    if (!host || host.getAttribute('data-toy-grid')) return true;

    const rows = [];
    for (const img of images) {
      const row = rowFor(img, host);
      // A row per image, in DOM order, with no duplicates - if two images
      // resolve to the same wrapper the layout assumption is wrong and it
      // is better to leave the list alone than to scramble it.
      if (!row || rows.indexOf(row) !== -1) return true;
      rows.push(row);
    }

    const grid = document.createElement('div');
    grid.setAttribute('data-toy-grid-inner', '1');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(6, minmax(0, 1fr))';
    grid.style.gap = '6px 10px';
    grid.style.justifyItems = 'center';
    grid.style.alignItems = 'start';
    grid.style.marginTop = '8px';

    // Anything above the first image - the question title and the 'None
    // of these' option - keeps its place.
    host.insertBefore(grid, rows[0]);
    rows.forEach(function (row) {
      row.style.margin = '0';
      row.style.display = 'block';
      grid.appendChild(row);
    });
    host.setAttribute('data-toy-grid', '1');
    return true;
  }

  if (typeof MutationObserver === 'undefined' || !document.body) return;
  const observer = new MutationObserver(function () {
    if (layOutGrid()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  if (layOutGrid()) observer.disconnect();
}

// Removes the attention getter's letterbox strips by letting the clip
// fill the frame, so no CSS background is visible inside an AG at all.
//
// THE PROBLEM. The clips are 1280x720 played with maximizeVideoArea on,
// so on any viewport that is not 16:9 (most laptops are 16:10) object-fit:
// contain letterboxes them, leaving a strip above and below. Those strips
// are CSS rgb(50,50,50) and the clip's own background is authored
// rgb(50,50,50), yet the seam between them is visible.
//
// WHY MATCHING THE COLOUR CANNOT WORK. The pixels are not the problem -
// Chrome decodes these clips to exactly 50,50,50, with and without GPU
// (measured via canvas readback, both headless modes). The difference
// appears at DISPLAY time: macOS colour-manages tagged video through the
// display profile, while a CSS colour is treated as plain sRGB, so on a
// wide-gamut screen the same nominal grey lands on two slightly different
// physical greys. Nothing in JS can observe that - getImageData returns
// the pre-transform value - and no choice of CSS colour is correct on
// every display profile.
//
// Two earlier attempts failed for exactly this reason and are recorded so
// they are not retried: tagging the clips tv/bt709 in make_ag_assets.py
// (correct, but the decode was never wrong), and sampling the decoded
// pixel at runtime to paint the surrounds to match (reads 50, paints 50,
// changes nothing).
//
// THE FIX. object-fit: fill makes the clip stretch to the frame instead
// of fitting inside it, so there are no strips to mismatch. The whole AG
// screen is then video, and its background is the rgb(50,50,50) that was
// authored into it.
//
// COST: a 16:9 clip on a 16:10 viewport is stretched ~11% vertically, so
// shapes are slightly oval. Chosen over object-fit: cover, which removes
// the strips by cropping the sides - and the shape's horizontal position
// is what encodes the AG's side, the known-gaze-direction reference the
// frame exists to provide. Stretching preserves horizontal position
// exactly, as a fraction of width.
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

function generateProtocol(child, pastSessions) {
  installVideoFillsFrame();
  installPauseWhenHidden();
  installExitFullscreenOnExitSurvey();
  installToyImageGrid();

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
    'final-setup-instructions': FINAL_SETUP_INSTRUCTIONS,
    'video-consent': VIDEO_CONSENT,
    'webcam-display-check': WEBCAM_DISPLAY_CHECK,
    ...trialFrames,
    feedback: FEEDBACK_SURVEY,
    'study-debrief': STUDY_DEBRIEF,
    'closing-router': CLOSING_ROUTER,
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

module.exports = { generateProtocol };
