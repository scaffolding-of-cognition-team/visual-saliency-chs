// Lookit Ember Frameplayer protocol generator for the visual-salience
// two-alternative preferential-looking study (adapted from the Simsom LWL
// MATLAB paradigm, spoken labels dropped - see README for the full design
// writeup and open items).
//
// require()/module.exports below are for local Node development and
// testing only (`node scripts/build.js` flattens this + src/*.js into a
// single dependency-free script for pasting into the Lookit builder, which
// expects one self-contained generateProtocol(child, pastSessions)).

const { BACKGROUND_COLOR } = require('./src/config');
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

// Lays out the wrap-up survey's item-experience checklist (FEEDBACK_SURVEY
// in src/text.js) as 2 rows x 6 columns of small pictures, with "None of
// these" on its own row below, and makes "None of these" mutually
// exclusive with the pictures.
//
// Nothing here assumes Alpaca's markup. A first version keyed everything
// off Bootstrap's div.checkbox wrapper and a fieldClass, matched nothing in
// Lookit, and left each picture at its natural 800px. Instead the only
// hook is the .item-experience-img class text.js puts on each picture, and
// the structure is found from there when the survey renders:
//
//   option     the highest ancestor of an input that holds no other input
//              - the whole per-option wrapper, whatever Alpaca calls it.
//   container  the options' shared parent, which becomes the grid.
//   none       the one option in it with no picture.
//
// The image size cap is plain CSS on the picture itself, so it holds even
// if the layout step never runs.
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
    // Moved to the end - picture first, checkbox under it - unless this is
    // "None of these", which keeps its checkbox beside the text.
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

function findUnlaidItemExperience() {
  const img = document.querySelector('.item-experience-img');
  if (!img) return null;
  // Nearest checkbox to the picture: usually inside the same label, but
  // walk up rather than assume so, in case the input sits beside it.
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

  // The survey renders minutes after generateProtocol runs, and could
  // render more than once (e.g. going back to it), so keep watching rather
  // than disconnecting after the first layout.
  if (typeof MutationObserver === 'undefined' || !document.body) return;
  const observer = new MutationObserver(function () {
    const container = findUnlaidItemExperience();
    if (container) layOutItemExperience(container);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Mutual exclusivity. Alpaca keeps its own copy of the field's value,
  // updated from its change handler on each input, and setting .checked
  // from JS fires no event - so each box cleared here gets a synthetic
  // `change` too, or the saved answer would still include it. Unchecks
  // are ignored, so those synthetic events do not cascade.
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
//
// THE PROBLEM. exp-lookit-images-audio's template renders each image as a
// plain <img src=...> with no gating, so the browser paints each one the
// moment its own fetch finishes. The component does preload via
// `new Image()` and holds startTrial() until image_loaded_count reaches
// nImages, but that only gates the TIMER - the pictures themselves are
// already on screen by then. On trial 1 nothing is cached, the two images
// are ~1 MB each from GitHub raw (not a CDN), and they arrive whenever
// they arrive: hence one appearing before the other.
//
// From trial 2 on it is invisible, because the study only has 12 distinct
// images and they are all cached by then. That is exactly why this shows
// up on the first trial and nowhere else.
//
// THE FIX. Kick off the fetches at protocol-generation time, which is
// study start - minutes of consent and setup frames before the trial
// block. By the time trial 1 runs the images are in cache and paint
// together. Nothing waits on this: if it has not finished, behaviour is
// exactly what it is today.
//
// The first attention-getter clip is included because it plays
// immediately before trial 1 and is the other cold fetch in that window.
// The rest are deliberately NOT preloaded - all 30 come to ~19 MB, and
// they are spread across the session with an ISI before each.
//
// References are parked on window so the objects are not garbage
// collected before the cache entry is used.
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

function generateProtocol(child, pastSessions) {
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
