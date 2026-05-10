import { describe, it, expect } from 'vitest';
import { t } from '../i18n.js';

const REQUIRED_KEYS = [
  // Main menu
  'tagline', 'streak', 'played', 'winRate', 'playToday',
  'badgeNew', 'badgeActive', 'badgeDone', 'badgeFailed',
  'playContinue', 'playDone',
  'practiceMode', 'practiceSub',
  'stats', 'settings', 'rules', 'footer',
  'freezeTapHint', 'timeTravelSubMenu',
  // Puzzle
  'dayLabel', 'practice', 'notEnoughLetters', 'notInWordList',
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
];

const FUNCTION_KEYS = [
  'dayLabel', 'answer', 'hintRevealed', 'hardModeCorrect',
  'hardModePresent', 'lossTitle', 'archiveDay', 'footer',
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
