import { register, navigate } from './components/router.js';
import { loadWordDB } from './game/wordDb.js';
import { loadTransliterator } from './game/transliterator.js';
import { load as loadState, get } from './game/gameState.js';
import { mainMenuScreen }   from './screens/mainMenu.js';
import { dailyPuzzleScreen } from './screens/dailyPuzzle.js';
import { statsScreen }       from './screens/stats.js';
import { settingsScreen }    from './screens/settings.js';
import { howToPlayScreen }   from './screens/howToPlay.js';
import { archiveScreen }     from './screens/archive.js';
import { setupNotifications, scheduleDailyReminder } from './notifications.js';
import { checkForUpdate } from './updateCheck.js';

// Register all screens
register('menu',     mainMenuScreen);
register('puzzle',   dailyPuzzleScreen);
register('stats',    statsScreen);
register('settings', settingsScreen);
register('howToPlay', howToPlayScreen);
register('archive',   archiveScreen);

async function boot() {
  loadState();
  await Promise.all([
    loadWordDB(),
    loadTransliterator(),
    new Promise(r => setTimeout(r, 1500)), // minimum splash time
  ]);

  const loader = document.getElementById('loader');
  loader.classList.add('hiding');
  await new Promise(r => setTimeout(r, 400)); // wait for fade-out
  loader.style.display = 'none';

  const app = document.getElementById('app');
  app.classList.add('visible');

  const flags = get().flags;
  if (!flags.seenTutorial) {
    navigate('howToPlay', { firstTime: true });
  } else {
    navigate('menu');
  }

  // Re-schedule daily reminder on each launch (keeps it alive)
  const s = get().settings;
  if (s.notifications) {
    setupNotifications().then(granted => {
      if (granted) scheduleDailyReminder(s.notifHour);
    });
  }

  // Check for app update on launch (Android only — silent no-op elsewhere).
  // Fire-and-forget — don't block boot.
  checkForUpdate();
}

boot().catch(console.error);
