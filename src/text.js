// All participant facing copy

const { IMG_BASE_URL, STIMULI_BASE_URL, TRIAL_IMAGE_SUBFOLDER } = require('./config');
const { TOKENS, FAMILIARITIES, imageFilename } = require('./pairs');

// The 12 trial images, as (value, label) pairs for the toy-experience
// question below. Derived from pairs.js rather than retyped, so they
// cannot drift out of sync with the actual stimuli; safe in the flattened
// build because scripts/build.js emits config.js and pairs.js before
// text.js, so all three bindings already exist.
//
// ORDER IS THE LAYOUT. installToyImageGrid (protocol.js) drops these into
// a 6-column CSS grid, which fills row by row - so listing all six
// familiar exemplars and then all six unfamiliar ones puts one OBJECT per
// column and one familiarity per row. Reordering this list silently
// rearranges the grid.
//
// STORED VALUES ARE THE FILENAMES ('F_ball.png'), not the labels, so the
// response joins directly against the trial data, which identifies images
// the same way. The labels are display only.
//
// LABELS ARE HTML. Alpaca renders optionLabels as markup, which is what
// makes thumbnails possible at all - there is no image support anywhere
// in exp-lookit-survey's own schema. The alt text carries the object name
// so the option is still identifiable if an image fails to load.
const TRIAL_IMAGE_OPTIONS = FAMILIARITIES.flatMap((familiarity) =>
  [...TOKENS].sort().map((token) => {
    const file = imageFilename(familiarity, token);
    return {
      value: file,
      label:
        `<img src="${STIMULI_BASE_URL}${TRIAL_IMAGE_SUBFOLDER}/${file}" alt="${token}" ` +
        'style="width:80px;height:80px;max-width:100%;object-fit:contain;' +
        'background:#fff;border-radius:4px;padding:2px" />',
    };
  })
);
// 'none' first, so it reads as the opt-out above the grid rather than a
// thirteenth picture. Its value is not a .png, which is also how
// installToyImageGrid tells it apart from the images.
const TOY_EXPERIENCE_VALUES = ['none'].concat(TRIAL_IMAGE_OPTIONS.map((o) => o.value));
const TOY_EXPERIENCE_LABELS = ['None of these'].concat(TRIAL_IMAGE_OPTIONS.map((o) => o.label));

// Pause / exit copy. Three separate behaviours, all real, all
// parent-visible, so all three are spelled out rather than collapsed into
// "press escape":
//
//   space bar       -> pause-unpause mixin's pauseKey (default ' ').
//                      Pause screen reads "Study paused / Press space to
//                      resume", so the copy has to name the space bar or
//                      the on-screen instruction comes out of nowhere.
//   leaving         -> pauseWhenExitingFullscreen (set in frames.js).
//   fullscreen         Pause screen reads "Please return to fullscreen".
//   switching tabs  -> installPauseWhenHidden in protocol.js drops
//   / minimising       fullscreen on `visibilitychange`, which lands in
//                      the same pauseWhenExitingFullscreen path above -
//                      so the parent sees the same "return to fullscreen"
//                      screen, and the copy does not need a fourth case.
//   escape          -> exp-player's own keydown handler: exits fullscreen
//                      (hence also pauses) AND shows the Continue/Exit
//                      confirmation box.
const ESCAPE_PAUSE_EXIT_TRANSCRIPT_BLOCK = {
  text:
    'You can pause the study at any time by pressing the space bar. You will see a "Study paused" ' +
    'message; press the space bar again when you are ready to start back up. The study also pauses on its own ' +
    'if you leave full screen or switch to another tab or window, and the message will ask you to return to ' +
    'full screen first. \n\n' +
    'To stop the study early, press the escape key. That pauses the study and brings up a box in the top right ' +
    'hand corner. You can press "Continue" if you think your child would like to keep going, or "Exit" if you ' +
    'or your child wants to stop the study early.',
};

const VIDEO_CONFIG = {
  kind: 'exp-video-config',
  troubleshootingIntro:
    'If you are having trouble getting this experiment set up, please feel free to contact Nicole Sahrling by ' +
    'email at <b>soc-participate@stanford.edu</b>, and I would be happy to help you out!',
};

const VIDEO_CONSENT = {
  kind: 'exp-lookit-video-consent',
  template: 'consent_005',
  PIName: 'Dr. Cameron Ellis, PhD',
  institution: 'Stanford University',
  PIContact: 'Dr. Cameron Ellis at (650) 308-6130',
  purpose:
    'Your child is invited to participate in a research study on infant cognition. The aim of this research is to investigate how infants see, learn, remember, and pay attention. ',
  procedures:
    'With your permission, your child’s face and gaze will be video recorded while they are presented with a ' +
    'variety of stimuli. We are interested in which stimuli your child engages with for longer periods of time. ' +
    'We will ask you (the parent) to turn away from the screen to avoid influencing your child’s responses.',
  risk_statement:
    'The risks associated with this study are minimal. Standard computer displays will be used, involving ' +
    'child-friendly images and videos. If you or your child experience any discomfort, you may end the session ' +
    'with no penalty. The data collected will be stored securely, in compliance with Stanford University ' +
    'standards, minimizing the risk of a confidentiality breach. There are no anticipated risks associated with ' +
    'participating.',
  voluntary_participation: '',
  payment:
    'As a token of appreciation for your child’s participation, we will send you a ' +
    'digital code to a $5 e-gift ' +
    'card. To be eligible, your child must fall within the age range, you will need to submit a valid consent ' +
    'statement, and your child’s face must be visible during the consent process. After you have finished the ' +
    'study, we will message you with a digital code to the e-gift card within a week. We will still send you an ' +
    'e-gift card in the event you and your child cannot finish the study or you choose to withdraw at any time. ' +
    'We cannot and do not guarantee or promise that you and your child will receive any benefits from this study.',
  // Renders as a paragraph at the END of the consent form's "How we use
  // your data" section, right after the template's boilerplate
  // ("...whether siblings tend to respond similarly... family demographic
  // survey data."). consent-template005/template.hbs wraps it in
  // {{#if datause}}, so '' omits the paragraph entirely - which is what
  // this used to be.
  datause: 'With your permission, the recordings will be used for analysis.',
  include_databrary: true,
  additional_video_privacy_statement: '',
  gdpr: false,
  research_rights_statement:
    'If you have read this form and have decided to allow your child to participate in this project, please ' +
    'understand your child’s participation is voluntary and as their parent or legal guardian, you have the ' +
    'right to withdraw consent or discontinue participation at any time without penalty or loss of benefits to ' +
    'which they are otherwise entitled. The alternative is not to participate. You and your child have the right ' +
    'to refuse to answer particular questions. Your child’s face will be video recorded so we can track their eye ' +
    'movements offline for our research. The results of this research study may be presented at scientific or ' +
    'professional meetings or published in scientific journals. Your child’s individual privacy will be ' +
    'maintained in all published and written data resulting from the study. \n\n Identifiers will be removed ' +
    'from identifiable private information and, after such removal, the information could be used for future ' +
    'research studies or distributed to another investigator for future research studies without additional ' +
    'informed consent from you.',
  additional_segments: [
    {
      title: 'How long we will store your data',
      text:
        'Once the study has concluded, our research team at Stanford University will retain the data collected ' +
        'from you for 5 years, after which we will delete and remove any data from our servers. Lookit stores ' +
        'data indefinitely unless you withdraw your recordings at the end of the study.',
    },
  ],
};

const WELCOME_INSTRUCTIONS = {
  kind: 'exp-lookit-text',
  displayFullscreenOverride: true,
  showPreviousButton: false,
  blocks: [
    { emph: true, title: 'Welcome!', text: 'Thank you for taking the time to participate in our study!' },
    {
      text:
        'This study will take at most 15 minutes of your time, including set up and debrief. Your child needs to ' +
        'be present for about 9 minutes.',
    },
    { text: '\n<u>Here are our estimates for how long each part of this study will take, in order:</u>' },
    {
      listblocks: [
        { text: 'Introduction and setup (happening now) <b>[4 minutes]</b> - your child does <i>not</i> need to be present' },
        { text: 'Consent <b>[1 minute]</b> - your child <i>must</i> be present when you record the consent video' },
        { text: 'Experiment <b>[about 8 minutes]</b> - your child <i>must</i> be present' },
        { text: 'Debrief <b>[2 minutes]</b> - your child does <i>not</i> need to be present' },
      ],
    },
    {
      text:
        '\nYou do not need to have your child with you while you set up. Feel free to leave the window before you start the study so that your child is in a good mood and ready to begin.',
    },
  ],
};

// NOTE: must be exp-lookit-instructions, NOT exp-lookit-text.
// `mediaBlock` (the audio-check player) is only implemented in
// exp-lookit-instructions' template. exp-lookit-text renders each block
// through exp-text-block, which handles only title / text / emph / image /
// listblocks - a mediaBlock there is silently ignored, so no audio player
// appears at all and there is no error to notice.
const SETUP_INSTRUCTIONS_1 = {
  kind: 'exp-lookit-instructions',
  displayFullscreenOverride: true,
  showPreviousButton: false,
  nextButtonText: 'Next',
  blocks: [
    {
      emph: true,
      title: 'Check audio!',
      text:
        "Let's make sure your computer audio is working. Please turn up the volume on your computer so that it " +
        'is easy to hear sounds while still being at a comfortable level.',
    },
    {
      mediaBlock: {
        text: "You should hear 'Ready to go!'",
        isVideo: false,
        mustPlay: true,
        warningText: 'Please try playing the sample audio. Make sure you can hear the words clearly!',
        sources: [
          { src: 'https://s3.amazonaws.com/lookitcontents/exp-physics-final/audio/ready.mp3', type: 'audio/mp3' },
          { src: 'https://s3.amazonaws.com/lookitcontents/exp-physics-final/audio/ready.ogg', type: 'audio/ogg' },
        ],
      },
    },
  ],
};

const STUDY_INTRO_VIDEO = {
  kind: 'exp-lookit-instruction-video',
  displayFullscreenOverride: true,
  instructionsVideo: [
    {
      // The extension must match the file on disk EXACTLY - a wrong one
      // 404s silently, since the frame just emits <source src type>. This
      // was .m4v (Apple's name for an MP4 container, also served as
      // video/mp4) until the file was re-exported as .mp4 on 2026-09-23.
      //
      // Do NOT point this at a .mov: Firefox won't play a QuickTime
      // container, and `type` is what the browser uses to decide whether
      // to even attempt a source.
      //
      // The %20 is required - the folder really is "instruction videos"
      // with a space, and an unescaped space breaks the URL.
      src: 'https://github.com/scaffolding-of-cognition-team/visual-saliency-chs/raw/main/instruction%20videos/chs_instructions_v2.mp4',
      type: 'video/mp4',
    },
  ],
  introText:
    '<b><u>At this point, your child does not have to be here</u></b>. Feel free to occupy them for the next ' +
    'few minutes - we will ask you to go get them in about 3 minutes, once the setup is done and just before ' +
    'we record consent. \n\n Please watch this video for an overview of what will happen during the study. ' +
    '\n(You can read the transcript to the right if you prefer.)',
    
// TODO: considering hving this be a separate slide
  transcriptTitle: 'Video Transcript',
  transcriptBlocks: [
    {
      text:
        'At the beginning of the experiment, your child will see a video of an exciting rotating shape, like a ' +
        'star or heart. We call this video the attention getter because we use it to get your child’s attention.',
    },
    {
      text:
        'Then we will show your child two images, which we call an “experimental trial.” These images are ' +
        'naturalistic photos of everyday objects, like blocks, cars, or keys. ' +
        'Halfway through each trial, your child will hear a label naming one of the two images, such as ' +
        '"Look at the blocks!" ' +
        'When your child is watching one of these trials, we will measure how long they want to look at each image on the screen.',
    },
    {
      text:
        'The experiment will start by showing a picture of an attention getter, followed by two objects, side by ' +
        'side. Throughout the study, your child will continue to see attention-getters with various colorful shapes and sounds. This is so we can make sure ' +
        'they are looking at the screen throughout the entire experiment. Each experiment trial, that is the ones with the images and the label, lasts about '+
        'six seconds. Next, we’ll show another trial with two images side by side for another six seconds. '
    },
    {
      text:
        'We will repeat 60 of these experiment trials in total, plus the attention getter trials that ' +
        'will be interleaved throughout the study.',
    },
    {
      text:
        'Together, the attention getter video and the experimental trials take about 8 minutes. ' +
        'After about 8 minutes, the study will end and the videos will stop automatically. ' +
        'Please note that both the attention getters and the experiment trials have sound, so please keep your ' +
        'volume up throughout.',
    },
    ESCAPE_PAUSE_EXIT_TRANSCRIPT_BLOCK,
  ],
  warningText: 'Please watch the video or read the summary before proceeding.',
  nextButtonText: 'Next',
  title: 'Study instructions',
  showPreviousButton: false,
  requireWatchOrRead: true,
};


const SETUP_INSTRUCTIONS = {
  kind: 'exp-lookit-instructions',
  displayFullscreenOverride: true,
  blocks: [
    {
      text:
        'If possible, complete the study in a quiet room, away from windows, open doorways, toys, pets, ' +
        'siblings, etc. In other words, we want to minimize interesting things that your child may want to look ' +
        'at that are not our videos. For example, a home office is better than a busy kitchen. However, we ' +
        'understand that a quiet environment is not always possible!\n\n',
      image: {
        alt: 'No distractions',
        src: `${IMG_BASE_URL}distractions.png`,
        title: 'Setting up the video',
      },
    },
    {
      text: '\n\n Please make sure your webcam is centered on the screen (this should be the case for most laptops). \n\n',
      image: {
        alt: 'Center camera',
        src: `${IMG_BASE_URL}centering.png`,
      },
    },
    {
      text:
        '\n\n If you are using two monitors, please turn one of them off. Make sure that the camera you are ' +
        'using is attached to the same screen that your child is looking at. \n\n',
      image: {
        alt: 'Turn off monitor',
        src: `${IMG_BASE_URL}monitors.png`,
      },
    },
    // Plain trailing text block (no image) so the Next button doesn't sit
    // immediately adjacent to the last image block - that adjacency looked
    // like the likely cause of the squished/off-center button.
    { text: '\n' },
  ],
  nextButtonText: 'Next',
};


// Merged from what used to be two frames, FINAL_REMINDERS followed by
// FINAL_SETUP_INSTRUCTIONS - they overlapped heavily (both told the
// parent to seat the child and keep their own face out of shot), so the
// pair read as one instruction repeated twice.
const FINAL_SETUP_INSTRUCTIONS = {
  kind: 'exp-lookit-instructions',
  displayFullscreenOverride: true,
  restartAfterPause: true,
  blocks: [
    {
      title: 'Time to get your child set up!',
      listblocks: [
        {
          text:
            "Keep your child's body oriented towards the screen so they can look at it if they want to.",
        },
        {
          text:
            "Make sure that your child's eyes are fully visible, and that your eyes are out of frame, if " +
            "possible. This way, we'll be able to focus on where your baby is looking!",
        },
        {
          // Kept from the old FINAL_SETUP_INSTRUCTIONS when the two frames
          // merged. This is the ONLY place the parent is told the child
          // has to be on camera during consent, and the consent form makes
          // that an eligibility condition for the gift card ("your child's
          // face must be visible during the consent process") - so a
          // parent who records consent alone fails a check nothing else
          // warns them about.
          text:
            'On the next page, we will ask for your consent to take part <b>[1 minute]</b>. You will record a ' +
            "short video of yourself giving consent, and <b>your child's face needs to be visible in that " +
            'recording</b>, so please have them with you before you continue.',
        },
      ],
    },
    { text: '<u>As a reminder:</u>' },
    {
      listblocks: [
        {
          text:
            "<b>Don’t worry if your child isn’t looking at the screen the entire time!</b> There's no need to " +
            "direct your child's attention towards the screen, or interact with them during the study, since " +
            'we want to know what decisions your child makes on their own.',
        },
        {
          text:
            "Please avoid peeking over your child's shoulder to check their gaze, narrating the experiment, or " +
            'pointing at the screen.',
        },
      ],
    },
    {
      title: 'Ready?',
      emph: true,
      text: "If your child is with you and set up, go ahead and press the 'Record consent' button.",
    },
  ],
  nextButtonText: 'Record consent',
};

const WEBCAM_DISPLAY_CHECK = {
  kind: 'exp-lookit-webcam-display',
  nextButtonText: 'Start the experiment!',
  showPreviousButton: false,
  displayFullscreenOverride: true,
  startRecordingAutomatically: false,
  blocks: [
    {
      title: "Last check: Does the video look good? Are your child's eyes visible?",
      listblocks: [
        {
          text:
            'Now that consent is recorded, please move back out of the camera view if you were in it, so that ' +
            "we can see your child's eyes clearly.",
        },
        { text: 'If the view looks good, you can go ahead and start the experiment! It takes about 8 minutes.' },
      ],
    },
  ],
};

const FEEDBACK_SURVEY = {
  kind: 'exp-lookit-survey',
  displayFullscreenOverride: true,
  formSchema: {
    schema: {
      type: 'object',
      title: 'Wrap-up Questions',
      properties: {
        email: {
          title:
            'Please provide your email so we can send your $5 e-gift card. Your email will be exclusively ' +
            'utilized for the purpose of delivering your compensation.',
          type: 'string',
          format: 'email',
        },
        'instructions-feedback': {
          // Every other field here has a title; this one never did, so the
          // 1-5 radios rendered with no question above them. Alpaca falls
          // back to the property name only for the label position, not as
          // a question, so there was nothing on screen to answer.
          title: 'How clear were the instructions for this study?',
          type: 'string',
          enum: [
            '1 - Not clear at all',
            '2 - Somewhat unclear',
            '3 - Neither clear nor unclear',
            '4 - Somewhat clear',
            '5 - Extremely clear',
          ],
        },
        'video-feedback': {
          title: 'Did you notice any of the following issues with the study while your child was participating?',
          type: 'array',
          items: {
            type: 'string',
            enum: ["The videos buffered or didn't play smoothly", 'The videos took a long time to load'],
          },
          uniqueItems: true,
        },
        'toy-experience': {
          title:
            'Has your child ever regularly played with any of these specific items in real life? ' +
            'These are the exact pictures they saw. Select all that apply.',
          type: 'array',
          items: { type: 'string', enum: TOY_EXPERIENCE_VALUES },
          uniqueItems: true,
        },
        'miscellaneous-feedback': {
          title: 'Is there any other feedback that you would like to share about your experience with this study?',
          type: 'string',
        },
      },
      required: ['email'],
    },
    options: {
      fields: {
        'instructions-feedback': {
          type: 'radio',
          optionLabels: [
            '1 - Not clear at all',
            '2 - Somewhat unclear',
            '3 - Neither clear nor unclear',
            '4 - Somewhat clear',
            '5 - Extremely clear',
          ],
          hideNone: true,
        },
        'video-feedback': {
          type: 'checkbox',
          optionLabels: ["The videos buffered or didn't play smoothly", 'The videos took a long time to load'],
        },
        'toy-experience': {
          type: 'checkbox',
          optionLabels: TOY_EXPERIENCE_LABELS,
        },
      },
    },
  },
  nextButtonText: 'Next',
};

const STUDY_DEBRIEF = {
  kind: 'exp-lookit-exit-survey',
  // NO displayFullscreenOverride here, unlike every other frame in this
  // file. exp-lookit-exit-survey is ExpFrameBaseComponent.extend(
  // Validations) - it does not mix in FullScreen, so the property was
  // silently ignored anyway (see the "frame properties are silently
  // ignored" warning in the README). Removed rather than left as a
  // harmless leftover because it implied this frame was deliberately
  // fullscreen, which is exactly the thing that breaks its withdrawal
  // dialog - see installExitFullscreenOnExitSurvey in protocol.js.
  doUseCamera: false,
  showDatabraryOptions: true,
  includeWithdrawalExample: true,
  debriefing: {
    title: 'Thank you!',
    emph: true,
    text: 'Here is some more information about the study you and your child just participated in. Feel free to skip this part if you want.',
    // The closing message lives HERE, folded in from what used to be a
    // separate STUDY_OUTRO frame, because this frame is the only one an
    // early-exiting participant ever sees. exp-player's exitEarly() does
    // `send('next', frames.length - 1)` - a single frame, the last one -
    // and ExperimentParser.parse() flattens groups, so early exit can
    // never play a sequence. Anything that must reach every participant
    // has to be in this frame. Text is unchanged from the old outro.
    blocks: [
      {
        text:
          'To wrap up, we will ask you a few questions that will take at most 2 minutes more. \n\n<b>At this ' +
          'point, your child has completed the study and does not need to be present.</b> Feel free to occupy ' +
          'them now before we wrap up.',
      },
      { text: '\n' },
      {
        text:
          'This was a study on how babies begin to understand early-learned nouns in their first two years of life.',
      },
      {
        text:
          "To begin, your child first viewed an 'attention-getter' (the colorful shapes and sounds) to ensure " +
          'they were focused on the screen before each trial. Next, we presented two photos of objects ' +
          'side-by-side on the screen, followed by a verbal cue instructing your child to look at one of the ' +
          'objects on screen. All these images are of unfamiliar toys that your child likely has not had ' +
          'real-world experience with.',
      },
      {
        text:
          'Our goal was to measure at what age children begin to look at the correct image that corresponds ' +
          'with the label, and if differences emerge when compared to children who have had real-world ' +
          'experience with some of the objects.',
      },
      {
        text:
          'We anticipated that children who have direct experience with the objects on screen would learn the ' +
          'words faster. Additionally, we were interested in whether infants found some images more ' +
          'interesting than others in this dataset, and whether these preferences are stable across children.',
      },
      {
        // exp-text-block renders `text` as HTML (the copy above relies on
        // <b>/<u>/<i> elsewhere), so the anchor works as written. Single
        // quotes inside, double quotes outside - the attributes must not
        // terminate the JS string.
        text:
          "If you would like to learn more about this topic, you can check out this TED Talk: " +
          "<a href='https://www.ted.com/talks/deb_roy_the_birth_of_a_word?subtitle=en' target='_blank' rel='noopener'>The Birth of a Word</a>",
      },
      {
        text:
          'We appreciate your participation in our study. As a token of gratitude, you will receive a $5 Tango ' +
          'gift card as compensation within a week.',
      },
    ],
  },
};

// A blank, instantly self-advancing frame that sits LAST in the sequence
// and exists only to route. It is never really "seen": no images, no
// text, 0.1s long, auto-proceeding.
//
// WHY IT EXISTS. exp-player's exitEarly() does
// `send('next', frames.length - 1)`, so a participant who presses Escape
// -> Exit always lands on whatever frame is last, and the study would
// then end - skipping `feedback`, so they would never be asked for the
// address their gift card goes to. Only one frame is ever shown that way
// (ExperimentParser.parse() flattens groups, so a group cannot smuggle in
// a sequence).
//
// selectNextFrame is the lever: exp-frame-base's next() evaluates it (as
// a STRING, via `Function('return ' + ...)`, so it must begin with
// `function`) and passes it expData, letting this frame look at what has
// already been completed and send the participant back for anything they
// missed. expData is keyed `${index}-${frame.id}`, hence the suffix match.
//
//   completer:    debrief -> feedback -> [here] -> done -> END
//   early exiter: [here] -> debrief -> feedback -> [here] -> done -> END
//
// So BOTH paths see debrief then feedback, in that order. The list
// ["-study-debrief", "-feedback"] IS that order - the router jumps to the
// first entry not yet in expData, so it resumes at the earliest thing the
// participant missed rather than only ever checking one frame. Putting the
// router last rather than giving feedback and debrief a selectNextFrame
// each is what keeps the order identical: with only two frames at the
// end, whichever is last is necessarily first for an early exiter and
// last for a completer, so one path is always reversed.
//
// If expData is unavailable the router ends the study - exactly the
// behaviour without this frame. That guard is load-bearing: without it,
// "nothing recorded" reads as "nothing completed" and the router would
// send a completer back round forever.
//
// With expData present a loop cannot happen, because each backward jump
// is to a frame that then writes its own key, so the next pass through
// finds it done. The one residual case is a frame whose save never lands
// at all - but EFP surfaces save failures itself, and the study is
// already broken at that point.
//
// displayFullscreen:false is REQUIRED. exp-lookit-images-audio hardcodes
// `displayFullscreen: true` as a component default ("force fullscreen for
// all uses of this component"), and this frame runs after the exit survey
// has deliberately left fullscreen (installExitFullscreenOnExitSurvey in
// protocol.js). Without the override it would try to re-enter fullscreen
// on the last screen of the study.
const CLOSING_ROUTER = {
  kind: 'exp-lookit-images-audio',
  images: [],
  durationSeconds: 0.1,
  autoProceed: true,
  doRecording: false,
  displayFullscreen: false,
  showProgressBar: false,
  showCursor: false,
  selectNextFrame:
    'function (frames, frameIndex, frameData, expData) {' +
    '  if (!expData) { return frames.length; }' +
    '  var seen = Object.keys(expData);' +
    '  var done = function (suffix) {' +
    '    return seen.some(function (k) { return k.endsWith(suffix); });' +
    '  };' +
    '  var indexOf = function (suffix) {' +
    '    return frames.findIndex(function (f) { return f.id && f.id.endsWith(suffix); });' +
    '  };' +
    '  var pending = ["-study-debrief", "-feedback"].filter(function (s) { return !done(s); });' +
    '  if (!pending.length) { return frames.length; }' +
    '  var i = indexOf(pending[0]);' +
    '  return i === -1 ? frames.length : i;' +
    '}',
};

module.exports = {
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
};
