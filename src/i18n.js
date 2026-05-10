const translations = {
  en: {
    // Main menu
    tagline:       'Daily Word · रोज़ पहेली',
    streak:        'Streak',
    played:        'Played',
    winRate:       'Win Rate',
    playToday:     "Play Today's Puzzle",
    playContinue:  'Continue Today',
    playDone:      "View Today's Result",
    badgeNew:      'New',
    badgeActive:   'In Progress',
    badgeDone:     '✓ Solved',
    badgeFailed:   '✕ Try tomorrow',
    practiceMode:  'Practice Mode',
    practiceSub:   'Unlimited words · no streak',
    stats:         'Stats',
    settings:      'Settings',
    rules:         'How to Play',
    freezeTapHint: 'A streak freeze auto-saves your streak if you miss a day. Resets weekly.',
    timeTravelSubMenu: 'Play any past puzzle',
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
    howToPlayIntro:  'Guess the hidden <strong>5-letter word</strong> in 6 tries.',
    htpDemoLabel:    '▶ Live Demo — watch a game unfold',
    htpDemoCaption:  'Auto-playing · loops every few seconds',
    htpStepsTitle:   'How to Play',
    htpStep1:        'Type any valid 5-letter word using the on-screen keyboard.',
    htpStep2:        'Press <strong>ENTER ↵</strong> to submit your guess.',
    htpStep3:        'Tiles flip and change color to show how close you were.',
    htpStep4:        'Use the color clues to narrow down the answer in 6 guesses.',
    htpColorTitle:   'What the colors mean',
    htpEx1Letter:    'W',
    htpEx1Heading:   '🟩 Correct spot',
    htpEx1Text:      '<strong>W</strong> is in the word <em>and</em> in the right position. Keep it there!',
    htpEx2Letter:    'I',
    htpEx2Heading:   '🟨 Wrong spot',
    htpEx2Text:      '<strong>I</strong> is in the word but in a <em>different</em> position. Move it!',
    htpEx3Letter:    'U',
    htpEx3Heading:   '⬛ Not in word',
    htpEx3Text:      '<strong>U</strong> does not appear anywhere in the word.',
    htpKeyboardTitle:'Keyboard colors update too',
    htpKeyboardText: 'Every key you press gets colored — green, yellow, or gray. Use this to avoid letters you already know are wrong.',
    htpFeaturesTitle:'Special Features',
    htpHardModeTitle:'🔴 Hard Mode',
    htpHardModeText: 'Revealed hints must be used in every following guess. Turn it on in <strong>Settings</strong> before you start.',
    htpHintsTitle:   '🔍 Hints',
    htpHintsText:    'Tap the <strong>🔍</strong> button during a game to reveal one letter for free. You get 1 hint per week — use it wisely!',
    htpArchiveTitle: '⏰ Time Travel',
    htpArchiveText:  'Missed a day? Tap <strong>Time Travel</strong> on the main menu to play any past puzzle.',
    htpTipsTitle:    'Quick Tips',
    htpTip1:         'Start with common letters: <strong>S, T, R, A, E</strong>',
    htpTip2:         'Yellow = right letter, wrong place. Try it in a different spot.',
    htpTip3:         'A new word drops every day at midnight IST.',
    htpExamples:     'Examples',
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

    // Invite
    inviteBtn:  'Invite a Friend',
    inviteText: `🔤 I'm playing Shabd — a daily word puzzle (English + हिन्दी)!\nToday's challenge is live. Think you can solve it? 👉 https://play.google.com/store/apps/details?id=in.shabd.game`,
  },

  hi: {
    // Main menu
    tagline:       'रोज़ पहेली · Daily Word',
    streak:        'स्ट्रीक',
    played:        'खेले',
    winRate:       'जीत दर',
    playToday:     'आज की पहेली खेलें',
    playContinue:  'खेल जारी रखें',
    playDone:      'आज का परिणाम देखें',
    badgeNew:      'नया',
    badgeActive:   'जारी है',
    badgeDone:     '✓ हल कर लिया',
    badgeFailed:   '✕ कल फिर कोशिश',
    practiceMode:  'अभ्यास करें',
    practiceSub:   'असीमित शब्द · स्ट्रीक नहीं',
    stats:         'आँकड़े',
    settings:      'सेटिंग्स',
    rules:         'कैसे खेलें',
    freezeTapHint: 'एक दिन छूटने पर फ्रीज़ अपने आप आपकी स्ट्रीक बचा लेगा। साप्ताहिक रिसेट।',
    timeTravelSubMenu: 'पुरानी कोई भी पहेली खेलें',
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
    howToPlayIntro:  '6 प्रयासों में छुपे <strong>5 अक्षर के शब्द</strong> को खोजें।',
    htpDemoLabel:    '▶ लाइव डेमो — देखें एक पूरा खेल',
    htpDemoCaption:  'अपने आप चलता है · कुछ सेकंड बाद दोबारा',
    htpStepsTitle:   'कैसे खेलें',
    htpStep1:        'ऑन-स्क्रीन कीबोर्ड से कोई भी 5 अक्षर का शब्द टाइप करें।',
    htpStep2:        '<strong>ENTER ↵</strong> दबाएं और अनुमान जमा करें।',
    htpStep3:        'टाइल पलटकर रंग बदलती हैं — देखें कितना सही था।',
    htpStep4:        'रंगों के संकेत से 6 प्रयासों में शब्द सुलझाएं।',
    htpColorTitle:   'रंगों का मतलब',
    htpEx1Letter:    'क',
    htpEx1Heading:   '🟩 सही जगह',
    htpEx1Text:      '<strong>क</strong> शब्द में है <em>और</em> सही जगह पर है। इसे वहीं रखें!',
    htpEx2Letter:    'म',
    htpEx2Heading:   '🟨 गलत जगह',
    htpEx2Text:      '<strong>म</strong> शब्द में है लेकिन <em>अलग</em> जगह पर। इसे हटाएं!',
    htpEx3Letter:    'ग',
    htpEx3Heading:   '⬛ शब्द में नहीं',
    htpEx3Text:      '<strong>ग</strong> इस शब्द में कहीं भी नहीं है।',
    htpKeyboardTitle:'कीबोर्ड भी रंग बदलता है',
    htpKeyboardText: 'हर दबाया गया अक्षर कीबोर्ड पर हरा, पीला या धूसर हो जाता है — ताकि गलत अक्षर दोबारा न लगाएं।',
    htpFeaturesTitle:'विशेष सुविधाएं',
    htpHardModeTitle:'🔴 कठिन मोड',
    htpHardModeText: 'मिले हर संकेत को अगले अनुमान में उपयोग करना ज़रूरी है। शुरू करने से पहले <strong>Settings</strong> में चालू करें।',
    htpHintsTitle:   '🔍 संकेत (Hints)',
    htpHintsText:    'खेल के दौरान <strong>🔍</strong> बटन दबाएं और एक अक्षर मुफ़्त देखें। सप्ताह में 1 बार मिलता है — सोचकर इस्तेमाल करें!',
    htpArchiveTitle: '⏰ समय यात्रा',
    htpArchiveText:  'कोई दिन छूट गया? मुख्य मेनू से <strong>समय यात्रा</strong> में जाकर पुरानी पहेलियाँ खेलें।',
    htpTipsTitle:    'सुझाव',
    htpTip1:         'आम अक्षरों से शुरू करें: <strong>क, म, र, स, ल</strong>',
    htpTip2:         'पीला = सही अक्षर, गलत जगह। उसे दूसरी जगह लगाएं।',
    htpTip3:         'हर रात 12 बजे (IST) नया शब्द आता है।',
    htpExamples:     'उदाहरण',
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

    // Invite
    inviteBtn:  'दोस्त को बुलाएं',
    inviteText: `🔤 मैं Shabd खेल रहा हूँ — रोज़ एक नया शब्द (English + हिन्दी)!\nआज की पहेली तैयार है। क्या आप सुलझा सकते हैं? 👉 https://play.google.com/store/apps/details?id=in.shabd.game`,
  },
};

export function t(lang) {
  return translations[lang] ?? translations.en;
}
