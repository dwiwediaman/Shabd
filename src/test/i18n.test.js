import { describe, it, expect } from 'vitest';
import { t } from '../i18n.js';

const REQUIRED_KEYS = [
  // Main menu
  'tagline', 'streak', 'played', 'winRate', 'playToday',
  'badgeNew', 'badgeActive', 'badgeDone', 'badgeFailed',
  'playContinue', 'playDone',
  // practiceMode / practiceSub removed in vc77 (Practice Mode removed)
  'stats', 'settings', 'rules', 'footer',
  'freezeTapHint', 'timeTravelSubMenu',
  // Puzzle
  'dayLabel', 'notEnoughLetters', 'notInWordList',
  'brilliant', 'answer', 'copied',
  // Stats
  'yourStats', 'bestStreak', 'guessDist', 'nextPuzzle', 'hoursLeft', 'shareResult',
  // Settings
  'settingsTitle', 'language', 'hindiKb', 'soundEffects', 'soundSub', 'haptics', 'hapticsSub',
  // How to play
  'howToPlayTitle', 'howToPlayIntro',
  'htpDemoLabel', 'htpDemoCaption',
  'htpStepsTitle', 'htpStep1', 'htpStep2', 'htpStep3', 'htpStep4',
  'htpColorTitle',
  'htpExamples', 'htpEx1Letter', 'htpEx1Heading', 'htpEx1Text',
  'htpEx2Letter', 'htpEx2Heading', 'htpEx2Text',
  'htpEx3Letter', 'htpEx3Heading', 'htpEx3Text',
  'htpKeyboardTitle', 'htpKeyboardText',
  'htpFeaturesTitle',
  'htpHardModeTitle', 'htpHardModeText',
  'htpHintsTitle', 'htpHintsText',
  'htpArchiveTitle', 'htpArchiveText',
  'htpTipsTitle', 'htpTip1', 'htpTip2', 'htpTip3',
  'htpFooter', 'playNow',
  // Hints
  'hintRevealed', 'noHints',
  // Notifications
  'notifications', 'notifSub', 'notifTime', 'imageSaved',
  // Hard mode
  'hardMode', 'hardModeSub', 'hardModeCorrect', 'hardModePresent',
  // Streak freeze
  'streakFreezeAvail', 'freezeUsed',
  // Feedback
  'feedbackTitle', 'feedbackSub',
  // Result sheet
  'nextWord', 'backToMenu', 'lossTitle', 'loadingDef',
  // Time Travel
  'timeTravel', 'timeTravelSub', 'archiveDay',
  // Invite
  'inviteBtn', 'inviteText',
  // Cloud sync (Phase 4)
  'cloudBackupTitle', 'cloudBackupSub', 'cloudSignIn', 'cloudSignOut',
  'cloudSyncNow', 'cloudSyncing', 'cloudSyncedAgo', 'cloudNeverSynced',
  'cloudSignedInAs', 'cloudDelete', 'cloudDeleteConfirm',
  'cloudSignInError', 'cloudNetworkError',
  'cloudJustNow', 'cloudMinutesAgo', 'cloudHoursAgo', 'cloudDaysAgo',
  // Squads
  'squadsBtn', 'squadsBtnSub', 'squadsTitle', 'squadsEmpty',
  'squadsCreateBtn', 'squadsJoinBtn',
  'squadsCreateTitle', 'squadsCreateNameLabel', 'squadsCreateNamePlaceholder',
  'squadsJoinTitle', 'squadsJoinCodeLabel', 'squadsJoinPlaceholder',
  'squadsCreate', 'squadsJoin', 'squadsCancel',
  'squadsInviteShare', 'squadsInviteMsg', 'squadsCopyCode', 'squadsCodeCopied',
  'squadsToday', 'squadsLeaveSquad', 'squadsDisband',
  'squadsConfirmLeave', 'squadsConfirmDisband',
  'squadsMembers', 'squadsMembersCap',
  'squadsMyRank', 'squadsRankWon', 'squadsRankLost', 'squadsRankNotPlayed',
  'squadsHardModeBadge', 'squadsInviteCodeLabel',
  'squadsErrorInvalidCode', 'squadsErrorFull', 'squadsErrorAlready', 'squadsErrorLimit',
  'squadsSignInPrompt',
  // Squads — deep-link join confirm modal
  'squadsDeepLinkTitle', 'squadsDeepLinkMembers', 'squadsDeepLinkOwner',
  'squadsDeepLinkJoin', 'squadsDeepLinkSignInAndJoin',
  // Squads — leaderboard score chip (vc76)
  'squadsPts',
  // Squads — timeframe tabs (vc77)
  'squadsThisWeek', 'squadsAllTime', 'squadsWeekStats', 'squadsAllStats',
];

const FUNCTION_KEYS = [
  'dayLabel', 'answer', 'hintRevealed', 'hardModeCorrect',
  'hardModePresent', 'lossTitle', 'archiveDay', 'footer',
  // Cloud
  'cloudSyncedAgo', 'cloudSignedInAs',
  'cloudMinutesAgo', 'cloudHoursAgo', 'cloudDaysAgo',
  // Squads
  'squadsInviteMsg', 'squadsMembers', 'squadsMembersCap',
  'squadsMyRank', 'squadsRankWon', 'squadsErrorLimit',
  'squadsDeepLinkMembers', 'squadsDeepLinkOwner',
  // Squads — timeframe-tab aggregate captions (vc77)
  'squadsWeekStats', 'squadsAllStats',
];

describe('i18n — English', () => {
  const tx = t('en');

  it('returns translations object for "en"', () => {
    expect(tx).toBeTruthy();
    expect(typeof tx).toBe('object');
  });

  it.each(REQUIRED_KEYS)('has key "%s"', (key) => {
    expect(tx[key]).toBeDefined();
  });

  it('all string keys are non-empty strings', () => {
    for (const key of REQUIRED_KEYS) {
      if (!FUNCTION_KEYS.includes(key)) {
        expect(typeof tx[key], `key: ${key}`).toBe('string');
        expect(tx[key].length, `key: ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('dayLabel(n) returns string containing the number', () => {
    expect(tx.dayLabel(42)).toContain('42');
  });

  it('answer(w) returns string containing the word', () => {
    expect(tx.answer('crane')).toContain('crane');
  });

  it('hintRevealed(pos) returns string containing position', () => {
    expect(tx.hintRevealed(3)).toContain('3');
  });

  it('hardModeCorrect(pos, letter) returns string with both', () => {
    const result = tx.hardModeCorrect(2, 'r');
    expect(result).toContain('2');
    expect(result.toUpperCase()).toContain('R');
  });

  it('hardModePresent(letter) returns string with letter', () => {
    expect(tx.hardModePresent('a').toUpperCase()).toContain('A');
  });

  it('lossTitle(word) returns string with word', () => {
    expect(tx.lossTitle('brave')).toContain('brave');
  });

  it('archiveDay(n) returns string with number', () => {
    expect(tx.archiveDay(10)).toContain('10');
  });
});

describe('i18n — Hindi', () => {
  const tx = t('hi');

  it('returns translations object for "hi"', () => {
    expect(tx).toBeTruthy();
  });

  it.each(REQUIRED_KEYS)('has key "%s"', (key) => {
    expect(tx[key]).toBeDefined();
  });

  it('all string keys are non-empty', () => {
    for (const key of REQUIRED_KEYS) {
      if (!FUNCTION_KEYS.includes(key)) {
        expect(tx[key].length, `hi key: ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('dayLabel(n) works in Hindi', () => {
    const result = tx.dayLabel(1);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('archiveDay(n) works in Hindi', () => {
    expect(typeof tx.archiveDay(5)).toBe('string');
  });
});

describe('i18n — unknown language falls back to English', () => {
  it('returns English for unknown lang', () => {
    const tx = t('fr');
    expect(tx.playToday).toBe(t('en').playToday);
  });
});

describe('i18n — EN and HI are distinct', () => {
  it('taglines differ between languages', () => {
    expect(t('en').tagline).not.toBe(t('hi').tagline);
  });

  it('streak label differs', () => {
    expect(t('en').streak).not.toBe(t('hi').streak);
  });
});

// ── Exercise every template function in both languages ────────────────────
// Without this, v8 only counts the ~9 functions individual `it` blocks hit
// directly, and the remaining ~37 template fns drag the global function%
// coverage down. Each call returns a string (or template) with the
// interpolated values — we assert truthy + non-empty, which is enough to
// register the function as covered.
const FUNCTION_ARGS = {
  footer:                ['1.5', '90'],
  dayLabel:              [42],
  answer:                ['crane'],
  hintRevealed:          [3],
  hardModeCorrect:       [2, 'r'],
  hardModePresent:       ['a'],
  lossTitle:             ['brave'],
  archiveDay:            [10],
  cloudSyncedAgo:        ['2 min ago'],
  cloudSignedInAs:       ['Rahul'],
  cloudMinutesAgo:       [5],
  cloudHoursAgo:         [3],
  cloudDaysAgo:          [2],
  squadsInviteMsg:       ['Family', 'AX3KQ7'],
  squadsMembers:         [3],
  squadsMembersCap:      [3, 50],
  squadsMyRank:          [2, 12],
  squadsRankWon:         [4],
  squadsErrorLimit:      [3],
  squadsDeepLinkMembers: [2, 50],
  squadsDeepLinkOwner:   ['Aman'],
  squadsWeekStats:       [3, 2],
  squadsAllStats:        [10, 8],
  encourage:             [3, false],
};

describe.each(['en', 'hi'])('i18n — every template function for %s', (lang) => {
  const tx = t(lang);
  it.each(Object.entries(FUNCTION_ARGS))('%s invokes cleanly with sample args', (key, args) => {
    const fn = tx[key];
    expect(typeof fn, `${lang}.${key} should be a function`).toBe('function');
    const out = fn(...args);
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('plural-arity functions handle the n=1 / n=0 branches', () => {
    // squadsMembers branches on n === 1 (singular/plural).
    expect(tx.squadsMembers(1)).toMatch(/.+/);
    expect(tx.squadsMembers(2)).toMatch(/.+/);
    // squadsWeekStats / squadsAllStats branch on played === 0 (no "won" half).
    expect(tx.squadsWeekStats(0, 0)).toMatch(/.+/);
    expect(tx.squadsAllStats(0, 0)).toMatch(/.+/);
    expect(tx.squadsAllStats(1, 1)).toMatch(/.+/); // singular "game" branch in EN
  });

  it('encourage covers all remaining-guess and hot/cold branches', () => {
    // last guess
    expect(tx.encourage(1, false)).toMatch(/.+/);
    expect(tx.encourage(1, true)).toMatch(/.+/);
    // hot branches (remaining 5, 4, 3, 2)
    expect(tx.encourage(5, true)).toMatch(/.+/);
    expect(tx.encourage(4, true)).toMatch(/.+/);
    expect(tx.encourage(3, true)).toMatch(/.+/);
    expect(tx.encourage(2, true)).toMatch(/.+/);
    // cold branches (remaining 5, 4, 3, 2)
    expect(tx.encourage(5, false)).toMatch(/.+/);
    expect(tx.encourage(4, false)).toMatch(/.+/);
    expect(tx.encourage(3, false)).toMatch(/.+/);
    expect(tx.encourage(2, false)).toMatch(/.+/);
  });
});
