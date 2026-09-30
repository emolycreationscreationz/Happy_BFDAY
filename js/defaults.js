/*
 * Template defaults for client cards (…/?card=name).
 * Every field a card leaves empty falls back to these. The editor (customize.html)
 * also starts new cards from these. The main-link card is in js/config.js.
 */
window.GIFT_DEFAULTS = {
  theme: "blue",                   // blue · rose · red · purple · teal · black
  // --- Names ---
  hisName: "My Love",                  // his name / nickname (shown big)
  herName: "Me",                  // your name, used on the envelope and to sign the letter
  pageTitle: "Happy Boyfriend's Day",
  titleLine1: "Happy",               // big script word on the envelope & at the top
  titleLine2: "Boyfriend's Day",     // line under it (e.g. "Birthday", "Anniversary")
  date: "03 · 10 · 2026",          // small date on the envelope & hero

  // --- Opening: the envelope ---
  envelopeTo: "A little surprise for",
  envelopeFrom: "from someone who adores you",
  envelopeHint: "Tap the seal to open",
  // Lines typed out one by one after the envelope opens
  openingLines: [
    "Hey you…",
    "Today isn't just any ordinary day.",
    "It's a day all about you,",
    "and how lucky I am to have you."
  ],
  openButton: "Open your gifts",
  cardGreeting: "My love,",       // first line on the card inside the envelope

  // --- Wishes (first section) ---
  heroKicker: "Today is all about you",
  // AI video: put the file in assets/video/ and set the path. Leave "" to show a placeholder.
  video: "",
  videoWebm: "",   // fallback for browsers that can't play MP4
  videoPoster: "",
  videoAspect: "9/16",             // "9/16" portrait, "16/9" landscape, "1/1" square
  wishesTitle: "My wishes for you",
  wishes: [
    "May you always wake up smiling, the way you make me smile every day.",
    "May every dream you chase find its way back to you.",
    "May you never forget how loved, how wanted and how appreciated you are.",
    "May your heart always feel light, and your days always feel warm.",
    "And may I get to celebrate you like this for many, many more years."
  ],

  // --- Nudge between sections ---
  scrollNudgeTitle: "Wait… there's more!",
  scrollNudge: "Keep scrolling, I've hidden a few more gifts for you",

  // --- Gift 1: memories in a heart ---
  memoriesLabel: "Gift 01",
  memoriesTitle: "Our Little Memories",
  memoriesSub: "Every picture, a piece of my favourite story. Tap one to open it.",
  // Main photo in the middle of the heart
  heartPhoto: { src: "", caption: "Us, my favourite place to be", focus: "50% 40%" },
  // Up to 9 photos around the heart. Put files in assets/photos/ ("" = soft placeholder).
  // focus = which part of the photo to keep when cropped, e.g. "50% 30%"
  memories: [],

  // --- Gift 2: the letter ---
  letterLabel: "Gift 02",
  letterTitle: "A Letter For You",
  letterGreeting: "My dearest love,",
  letter: [
    "I've tried so many times to put into words what you mean to me, and every time the words feel too small. But today is your day, so I'm going to try anyway.",
    "You came into my life so quietly, and somehow you changed everything. You made ordinary days feel like something worth remembering. You made the hard days lighter just by being there.",
    "Thank you for your patience when I'm difficult, for your laughter when I need it most, and for the way you look at me like I'm the only one in the room. Thank you for choosing me, again and again.",
    "I see how hard you work, how much you carry, and how gently you still treat the people you love. I don't always say it enough, so let me say it now: I am so proud of you.",
    "Whatever tomorrow brings, I hope you always remember this: you are loved, you are appreciated, and you will always have me cheering the loudest for you.",
    "Happy Boyfriend's Day, my love. Today, and every day, I appreciate you."
  ],
  letterClosing: "Forever yours,",

  // --- Gift 3: cinema ---
  cinemaLabel: "Gift 03",
  cinemaTitle: "Our Song",
  cinemaSub: "Grab a seat next to me, the show is about to start.",
  nowShowing: "Now Showing",
  songTitle: "Our Song",           // shown on the marquee
  // Paste any YouTube link: youtu.be/…, youtube.com/watch?v=…, shorts, etc. "" = placeholder
  youtubeUrl: "",
  youtubeStart: 0,                 // start the song at this many seconds
  playButton: "Open the curtains",
  ticket: "Admit Two · You & Me",

  // --- Finale: I appreciate you ---
  appreciateKicker: "One last thing",
  appreciateTitle: "I Appreciate You",
  appreciateSub: "Tap each card. These are just a few of the reasons.",
  reasons: [
    { front: "Reason #1", back: "You always make time for me, even on your busiest days." },
    { front: "Reason #2", back: "You make me laugh until my cheeks hurt." },
    { front: "Reason #3", back: "You listen, really listen." },
    { front: "Reason #4", back: "You're my calm when everything feels loud." },
    { front: "Reason #5", back: "You believe in me more than I believe in myself." },
    { front: "Reason #6", back: "You are simply, wonderfully, you." }
  ],
  // Framed photo near the end ("" src = hidden)
  finalPhoto: { src: "", caption: "Here's to us. Always.", focus: "50% 40%" },

  closingLine: "Happy Boyfriend's Day",
  footer: "Made with love",
  madeBy: "Emoly Creations"
};
