// All participant-facing copy, gathered here so it's easy to find and
// replace. TODO markers are real placeholders - none of this is
// study-specific content; that's yours to write.
//
// The frame *structure* (which Lookit frame kinds, which blocks) is lifted
// from placepath-behavioral (~/Documents/Code/placepath-behavioral), an
// existing fielded Lookit study, per instruction to adapt its intro/
// consent/instruction/outro frames rather than rebuilding from scratch.
//
// One exception to "no borrowed copy": the Escape-key pause/exit
// explanation below is reproduced near-verbatim from placepath-behavioral's
// instructions-3 and instructions-10 frames. That's platform-mechanic
// boilerplate, not study content, and you explicitly asked to keep it
// worded the same way (single Escape-triggered Continue/Exit box, not a
// separate Ctrl+X/F1 explanation).

const ESCAPE_PAUSE_EXIT_TRANSCRIPT_BLOCK = {
  text:
    'At any time during the study, you can pause the video or stop the study early by pressing the escape key. ' +
    'If you do so, you will see this box in the top right hand corner. You can press the "Continue" key if you ' +
    'think your child would like to continue the study. You can press the "Exit" key if you or your child wants ' +
    'to stop the study early.',
};

const ESCAPE_PAUSE_EXIT_SETUP_NOTE = {
  text:
    "<u>NOTE:</u> If you need to pause or end the study early, press the 'esc' key. You can exit the study early " +
    "by selecting the 'exit' option at the top right corner, which will then fast forward you to the end of the " +
    'experiment. Please pause the study only in rare cases, such as your child becomes too fussy to continue or ' +
    'someone comes in and distracts your child.',
};

const VIDEO_CONFIG = {
  kind: 'exp-video-config',
  troubleshootingIntro: 'TODO: webcam-troubleshooting contact line (name/role/email), mirroring placepath-behavioral.',
};

// Structure mirrors placepath-behavioral's video-consent frame exactly
// (same keys); every value below is a TODO for you to fill in.
const VIDEO_CONSENT = {
  kind: 'exp-lookit-video-consent',
  template: 'TODO_consent_template_id',
  PIName: 'TODO PI name',
  institution: 'TODO institution',
  purpose: 'TODO: study purpose, participant-facing.',
  procedures: 'TODO: what will happen during the session, participant-facing.',
  risk_statement: 'TODO: risk statement.',
  voluntary_participation: 'TODO',
  payment: 'TODO: compensation terms.',
  datause: 'TODO: data use / Databrary sharing statement.',
  include_databrary: true,
  additional_video_privacy_statement: 'TODO',
  gdpr: false,
  research_rights_statement: 'TODO: IRB contact / participant-rights statement.',
  additional_segments: [
    {
      title: 'How long we will store your data',
      text: 'TODO: data retention statement.',
    },
  ],
};

const WELCOME_INSTRUCTIONS = {
  kind: 'exp-lookit-text',
  showPreviousButton: false,
  blocks: [
    { emph: true, title: 'Welcome!', text: 'TODO: thank-you / welcome line.' },
    { text: 'TODO: total time estimate (setup + session + debrief).' },
  ],
};

// Slot for the study intro video you'll produce later (per your plan to
// build the Escape/pause-or-exit example into it, mirroring
// placepath-behavioral's instructions-3). Left empty on purpose.
const STUDY_INTRO_VIDEO = {
  kind: 'exp-lookit-instruction-video',
  displayFullscreenOverride: true,
  instructionsVideo: [
    {
      src: 'TODO_STUDY_INTRO_VIDEO_URL',
      type: 'video/mp4',
    },
  ],
  introText: 'TODO: intro copy. \n(You can read the transcript to the right if you prefer.)',
  transcriptTitle: 'Video Transcript',
  transcriptBlocks: [
    { text: 'TODO: what the child will see, in plain terms (no target/lure language - just "two pictures").' },
    ESCAPE_PAUSE_EXIT_TRANSCRIPT_BLOCK,
  ],
  warningText: 'Please watch the video or read the summary before proceeding.',
  nextButtonText: 'Next',
  title: 'Study instructions',
  showPreviousButton: false,
  requireWatchOrRead: true,
};

// Generic webcam/room setup guidance - not study-specific, so reusing
// placepath-behavioral's own hosted setup images directly rather than
// re-hosting duplicates. TODO: swap to self-hosted copies if you'd rather
// not depend on another repo's assets long-term.
const SETUP_INSTRUCTIONS = {
  kind: 'exp-lookit-instructions',
  displayFullscreenOverride: true,
  blocks: [
    {
      text: 'TODO: quiet-room guidance.',
      image: {
        alt: 'No distractions',
        src: 'https://github.com/scaffolding-of-cognition-team/placepath-behavioral/blob/main/img/distractions.png?raw=true',
        title: 'Setting up the video',
      },
    },
    {
      text: 'TODO: center your webcam guidance.',
      image: {
        alt: 'Center camera',
        src: 'https://github.com/scaffolding-of-cognition-team/placepath-behavioral/blob/main/img/centering.png?raw=true',
      },
    },
    {
      text: 'TODO: single-monitor guidance.',
      image: {
        alt: 'Turn off monitor',
        src: 'https://github.com/scaffolding-of-cognition-team/placepath-behavioral/blob/main/img/monitors.png?raw=true',
      },
    },
  ],
  nextButtonText: 'Next',
};

const FINAL_SETUP_INSTRUCTIONS = {
  kind: 'exp-lookit-instructions',
  displayFullscreenOverride: true,
  restartAfterPause: true,
  blocks: [
    {
      title: 'Time to get your child set up!',
      listblocks: [
        { text: 'TODO: seating guidance.' },
        { text: 'TODO: laptop placement guidance.' },
        ESCAPE_PAUSE_EXIT_SETUP_NOTE,
      ],
    },
    {
      title: 'Ready?',
      emph: true,
      text: "If your child is set up, go ahead and press the 'Check video!' button.",
    },
  ],
  nextButtonText: 'Check video!',
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
      listblocks: [{ text: "If so, you can go ahead and start the experiment!" }],
    },
  ],
};

const STUDY_OUTRO = {
  kind: 'exp-lookit-text',
  displayFullscreenOverride: true,
  blocks: [
    { emph: true, title: 'TODO: thank-you headline.' },
    { text: 'TODO: wrap-up transition line.' },
  ],
  showPreviousButton: false,
  nextButtonText: 'Next',
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
          title: 'TODO: compensation-email prompt.',
          type: 'string',
          format: 'email',
        },
        'miscellaneous-feedback': {
          title: 'TODO: open feedback prompt.',
          type: 'string',
        },
      },
      required: ['email'],
    },
    options: { fields: {} },
  },
  nextButtonText: 'Next',
};

const STUDY_DEBRIEF = {
  kind: 'exp-lookit-exit-survey',
  displayFullscreenOverride: true,
  doUseCamera: false,
  showDatabraryOptions: true,
  includeWithdrawalExample: true,
  debriefing: {
    title: 'TODO: debrief title.',
    emph: true,
    text: 'TODO: debrief copy (participant-facing study explanation - no target/lure language, this is a looking-preference study).',
    blocks: [],
  },
};

module.exports = {
  VIDEO_CONFIG,
  VIDEO_CONSENT,
  WELCOME_INSTRUCTIONS,
  STUDY_INTRO_VIDEO,
  SETUP_INSTRUCTIONS,
  FINAL_SETUP_INSTRUCTIONS,
  WEBCAM_DISPLAY_CHECK,
  STUDY_OUTRO,
  FEEDBACK_SURVEY,
  STUDY_DEBRIEF,
};
