// All participant-facing copy, gathered here so it's easy to find and
// replace.

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
  troubleshootingIntro:
    'If you are having trouble getting this experiment set up, please feel free to contact Nicole Sahrling by ' +
    'email at <b>soc-participate@stanford.edu</b>, and I would be happy to help you out!',
};

const VIDEO_CONSENT = {
  kind: 'exp-lookit-video-consent',
  template: 'consent_006',
  PIName: 'Dr. Cameron Ellis, PhD',
  institution: 'Stanford University',
  PIContact: 'Dr. Cameron Ellis at (650) 308-6130',
  purpose:
    'Your child is invited to participate in a research study on baby cognition. The aim of this research is to ' +
    'investigate how babies see, learn, remember, and pay attention.',
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
    'As a token of appreciation for your child’s participation, we will send you a digital code to a $10 e-gift ' +
    'card. To be eligible, your child must fall within the age range, you will need to submit a valid consent ' +
    'statement, and your child’s face must be visible during the consent process. After you have finished the ' +
    'study, we will message you with a digital code to the e-gift card within a week. We will still send you an ' +
    'e-gift card in the event you and your child cannot finish the study or you choose to withdraw at any time. ' +
    'We cannot and do not guarantee or promise that you and your child will receive any benefits from this study.',
  datause: '',
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
        'This study will take at most 30 minutes of your time, including set up and debrief. Your child needs to ' +
        'be present for at most 12 minutes.',
    },
    { text: '\n<u>Here are our estimates for how long each part of this study will take:</u>' },
    {
      listblocks: [
        { text: 'Consent (happening now) <b>[1 minute]</b> - your child <i>must</i> be present when you record the consent video' },
        { text: 'Introduction and setup <b>[5 minutes]</b> - your child does <i>not</i> need to be present' },
        { text: 'Experiment <b>[6-12 minutes]</b> - your child <i>must</i> be present' },
        { text: 'Debrief <b>[5 minutes]</b> - your child does <i>not</i> need to be present' },
      ],
    },
  ],
};

const SETUP_INSTRUCTIONS_1 = {
  kind: 'exp-lookit-text',
  displayFullscreenOverride: true,
  showPreviousButton: false,
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
      src: 'https://github.com/scaffolding-of-cognition-team/visual-saliency-chs/raw/main/instruction%20videos/chs_instructions_v1.mov',
      type: 'video/mp4',
    },
  ],
  introText:
    '<b><u>At this point, your child does not have to be here</u></b>. Feel free to occupy them for the next ' +
    'few minutes. \n\n Please watch this video for an overview of what will happen during the study. \n(You can ' +
    'read the transcript to the right if you prefer.)',
    
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
        'Then we will show your child two images, which we call an “experimental trial.” These images consist of naturalistic photos of toys like blocks or cars,' +
        'and bodyparts, like eyes, or teeth. ' +
        // `Your child may also hear a label referring to one of the images, such as "Look at the blocks!" ` +
        'When your child is watching one of these trials, we will measure how long they want to look at each image on the screen.',
    },
    {
      text:
        'The experiment will start by showing a picture of an attention getter, follow by either a two toys or two bodyparts, side by ' +
        'side. Throughout the study, your child will continue to see see attention-getters with various colorful shapes and sounds. This is so we can make sure ' +
        'they are looking at the screen throughout the entire experiment. Each experiment trial, that is the ones with the images, lasts about'+
        'six seconds. Next, we’ll show another trial with two images side by side for another six seconds. '
    },
    {
      text:
        'We will repeat around 30 of these experiment trials in total, plus the attention getter trials that ' +
        'will be interleaved throughout the study.',
    },
    {
      text:
        'Together, the attention getter video and the experimental trials can take up to 7 minutes. ' +
        'After 7 minutes, the study will end and the videos will stop automatically. ' +
        'You can pause or stop the study at any time by pressing the escape key. ' +
        'Please note, while the attention getter has sound, the experiment trials do not have any sound.',
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
        src: 'https://github.com/scaffolding-of-cognition-team/placepath-behavioral/blob/main/img/distractions.png?raw=true',
        title: 'Setting up the video',
      },
    },
    {
      text: '\n\n Please make sure your webcam is centered on the screen (this should be the case for most laptops). \n\n',
      image: {
        alt: 'Center camera',
        src: 'https://github.com/scaffolding-of-cognition-team/placepath-behavioral/blob/main/img/centering.png?raw=true',
      },
    },
    {
      text:
        '\n\n If you are using two monitors, please turn one of them off. Make sure that the camera you are ' +
        'using is attached to the same screen that your child is looking at. \n\n',
      image: {
        alt: 'Turn off monitor',
        src: 'https://github.com/scaffolding-of-cognition-team/placepath-behavioral/blob/main/img/monitors.png?raw=true',
      },
    },
    // Plain trailing text block (no image) so the Next button doesn't sit
    // immediately adjacent to the last image block - that adjacency looked
    // like the likely cause of the squished/off-center button.
    { text: '\n' },
  ],
  nextButtonText: 'Next',
};


const FINAL_REMINDERS = {
  kind: 'exp-lookit-instructions',
  displayFullscreenOverride: true,
  restartAfterPause: true,
  blocks: [
    {
      title: 'Some final reminders!',
      listblocks: [
        {
          text:
            "During the study, you can set your baby up in a high chair and stand or sit behind them. You can " +
            'also sit in front of the computer with your child on your lap if you think they would prefer that ' +
            "arrangement. During the study, try to keep your child's body oriented towards the screen so they " +
            'can look at it if they want to.',
        },
        {
          text:
            "Make sure that your child's eyes are fully visible, and that your eyes are out of frame, if " +
            "possible. This way, we'll be able to focus on where your baby is looking!",
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
        { text: 'At this point, you can go get your child and set them up in a high chair or on your lap.' },
        {
          text:
            'Please put the laptop or computer close to your child, but far enough away that they cannot reach ' +
            'forward and touch the keyboard.',
        },
        {
          text:
            'On the next page, you will be able to check the webcam view. Please make sure that the webcam has ' +
            "a full view of your child's face and their eyes. <b>Before you start the study, try to make sure " +
            'that your face is not present in the camera.</b>',
        },
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
      listblocks: [{ text: 'If so, you can go ahead and start the experiment!' }],
    },
  ],
};

const STUDY_OUTRO = {
  kind: 'exp-lookit-text',
  displayFullscreenOverride: true,
  blocks: [
    { emph: true, title: 'You and your child have completed the experiment! Awesome job!' },
    {
      text:
        'To wrap up, we will ask you a few questions that will take at most 5 minutes more. \n\n<b>At this ' +
        'point, your child has completed the study and does not need to be present.</b> Feel free to occupy ' +
        'them now before we wrap up.',
    },
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
          title:
            'Please provide your email so we can send your $10 Tango Gift Card. Your email will be exclusively ' +
            'utilized for the purpose of delivering your compensation.',
          type: 'string',
          format: 'email',
        },
        'instructions-feedback': {
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
      },
    },
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
    title: 'Thank you!',
    emph: true,
    text: 'Here is some more information about the study you and your child just participated in. Feel free to skip this part if you want.',
    blocks: [
      {
        text:
          'This was a visual preference study on what kinds of pictures infants find most interesting. They ' +
          'saw different images of early-learned words paired together, and we want to know which image the ' +
          'look longer at, and if this preference is stable across children.',
      },
      {
        text:
          "We are interested in measuring your child's gaze as a way to determine if, on average, infants have " +
          'a preference for looking at certain images over others.',
      },
      {
        text:
          'If babies, on average, have similar preferences for some images over others that we showed them ' +
          "here, then that would suggest that there is something unique about the image that makes it " +
          "interesting to infants. We measure this 'preference' by recording the amount of time your child " +
          'looked at one picture over the other on the screen. On average, if the children in this study look ' +
          'longer at specific images, we infer that there is something about that image or concept that infants ' +
          'find particularly interesting. We hope that this study will help us better understand the origins of ' +
          'how children learn words and their visual preferences.',
      },
    ],
  },
};

module.exports = {
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
};
