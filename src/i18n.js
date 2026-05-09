const translations = {
  en: {
    // Main menu
    tagline:       'Daily Word · रोज़ पहेली',
    streak:        'Streak',
    played:        'Played',
    winRate:       'Win Rate',
    playToday:     "Play Today's Puzzle",
    badgeNew:      'New',
    practiceMode:  'Practice Mode',
    stats:         'Stats',
    settings:      'Settings',
    rules:         'Rules',
    footer:        'v1.0.0 · Made with ❤️ in India',

    // Puzzle
    dayLabel:      (n) => `Shabd · Day ${n}`,
    practice:      'Practice',
    notEnoughLetters: 'Not enough letters',
    notInWordList: 'Not in word list',
    brilliant:     'Brilliant! 🎉',
    answer:        (w) => `Answer: ${w}`,
    copied:        'Copied to clipboard!',

    // Stats
    yourStats:     'Your Stats',
    bestStreak:    'Best Streak',
    guessDist:     'Guess Distribution',
    nextPuzzle:    'Next Puzzle',
    hoursLeft:     'Hours until next word',
    shareResult:   "↗ Share Today's Result",

    // Settings
    settingsTitle: 'Settings',
    language:      'Language',
    hindiKb:       'Hindi Keyboard',
    soundEffects:  'Sound Effects',
    soundSub:      'Tile flip and win sounds',
    haptics:       'Haptics',
    hapticsSub:    'Vibration feedback on key press',

    // How to play
    howToPlayTitle:  'How to Play',
    howToPlayIntro:  'Guess the <strong>Shabd</strong> in 6 tries.',
    htpRule1:        'Each guess must be a valid word.',
    htpRule2:        'The color of the tiles will change to show how close your guess was.',
    htpExamples:     'Examples',
    htpEx1Letter:    'W',
    htpEx1Text:      '<strong>W</strong> is in the word and in the correct spot.',
    htpEx2Letter:    'I',
    htpEx2Text:      '<strong>I</strong> is in the word but in the wrong spot.',
    htpEx3Letter:    'U',
    htpEx3Text:      '<strong>U</strong> is not in the word in any spot.',
    htpFooter:       'A new word is available each day at midnight IST.',
    playNow:         'Play Now',

    // Hints
    hintRevealed:    (pos) => `Letter ${pos} revealed!`,
    noHints:         'No hints left',

    // Notifications
    notifications:   'Daily Reminder',
    notifSub:        'Get notified when today\'s puzzle is ready',
    notifTime:       'Reminder Time',
    imageSaved:      'Image saved!',

    // Hard mode
    hardMode:        'Hard Mode',
    hardModeSub:     'Revealed hints must be used in next guesses',
    hardModeCorrect: (pos, letter) => `Position ${pos} must be ${letter.toUpperCase()}`,
    hardModePresent: (letter) => `Must include ${letter.toUpperCase()}`,

    // Streak freeze
    streakFreezeAvail: '❄️ 1 freeze available this week',
    freezeUsed:        '❄️ Streak saved by freeze!',

    // Feedback
    feedbackTitle:   'Rate & Feedback',
    feedbackSub:     'Enjoying Shabd? Leave a review',

    // Result sheet
    nextWord:        'Next Word In',
    backToMenu:      'Back to Menu',
    lossTitle:       (w) => `The word was ${w}`,
    loadingDef:      'Looking up definition…',

    // Time Travel
    timeTravel:      'Time Travel',
    timeTravelSub:   'Relive your past puzzles',
    archiveDay:      (n) => `Shabd #${n}`,
  },

  hi: {
    // Main menu
    tagline:       'रोज़ पहेली · Daily Word',
    streak:        'स्ट्रीक',
    played:        'खेले',
    winRate:       'जीत दर',
    playToday:     'आज की पहेली खेलें',
    badgeNew:      'नया',
    practiceMode:  'अभ्यास करें',
    stats:         'आँकड़े',
    settings:      'सेटिंग्स',
    rules:         'नियम',
    footer:        'v1.0.0 · भारत में बनाया ❤️',

    // Puzzle
    dayLabel:      (n) => `शब्द · दिन ${n}`,
    practice:      'अभ्यास',
    notEnoughLetters: 'पर्याप्त अक्षर नहीं',
    notInWordList: 'शब्द सूची में नहीं',
    brilliant:     'शानदार! 🎉',
    answer:        (w) => `उत्तर: ${w}`,
    copied:        'कॉपी हो गया!',

    // Stats
    yourStats:     'आपके आँकड़े',
    bestStreak:    'सर्वश्रेष्ठ स्ट्रीक',
    guessDist:     'अनुमान वितरण',
    nextPuzzle:    'अगली पहेली',
    hoursLeft:     'अगले शब्द तक के घंटे',
    shareResult:   '↗ आज का परिणाम साझा करें',

    // Settings
    settingsTitle: 'सेटिंग्स',
    language:      'भाषा',
    hindiKb:       'हिंदी कीबोर्ड',
    soundEffects:  'ध्वनि प्रभाव',
    soundSub:      'टाइल और जीत की आवाज़',
    haptics:       'कंपन',
    hapticsSub:    'कुंजी दबाने पर कंपन',

    // How to play
    howToPlayTitle:  'कैसे खेलें',
    howToPlayIntro:  '<strong>शब्द</strong> को 6 प्रयासों में खोजें।',
    htpRule1:        'हर अनुमान एक मान्य शब्द होना चाहिए।',
    htpRule2:        'टाइल का रंग बताएगा कि आपका अनुमान कितना सही था।',
    htpExamples:     'उदाहरण',
    htpEx1Letter:    'क',
    htpEx1Text:      '<strong>क</strong> शब्द में है और सही जगह पर है।',
    htpEx2Letter:    'म',
    htpEx2Text:      '<strong>म</strong> शब्द में है लेकिन गलत जगह पर है।',
    htpEx3Letter:    'ग',
    htpEx3Text:      '<strong>ग</strong> शब्द में कहीं भी नहीं है।',
    htpFooter:       'हर रात 12 बजे (IST) नया शब्द आता है।',
    playNow:         'खेलें',

    // Hints
    hintRevealed:    (pos) => `अक्षर ${pos} दिखाया!`,
    noHints:         'कोई संकेत नहीं बचा',

    // Notifications
    notifications:   'दैनिक अनुस्मारक',
    notifSub:        'आज की पहेली तैयार होने पर सूचना पाएं',
    notifTime:       'अनुस्मारक समय',
    imageSaved:      'चित्र सेव हुआ!',

    // Hard mode
    hardMode:        'कठिन मोड',
    hardModeSub:     'मिले संकेतों का उपयोग अगले अनुमान में करें',
    hardModeCorrect: (pos, letter) => `स्थान ${pos} पर ${letter} होना चाहिए`,
    hardModePresent: (letter) => `${letter} शामिल होना चाहिए`,

    // Streak freeze
    streakFreezeAvail: '❄️ इस सप्ताह 1 फ्रीज़ उपलब्ध',
    freezeUsed:        '❄️ फ्रीज़ से स्ट्रीक बची!',

    // Feedback
    feedbackTitle:   'रेटिंग और प्रतिक्रिया',
    feedbackSub:     'Shabd पसंद है? समीक्षा दें',

    // Result sheet
    nextWord:        'अगला शब्द',
    backToMenu:      'मेनू पर जाएं',
    lossTitle:       (w) => `उत्तर था: ${w}`,
    loadingDef:      'शब्द का अर्थ ढूंढ रहे हैं…',

    // Time Travel
    timeTravel:      'समय यात्रा',
    timeTravelSub:   'पुरानी पहेलियाँ फिर से खेलें',
    archiveDay:      (n) => `शब्द #${n}`,
  },
};

export function t(lang) {
  return translations[lang] ?? translations.en;
}
