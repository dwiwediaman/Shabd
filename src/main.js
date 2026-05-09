import { register, navigate } from './components/router.js';
import { loadWordDB } from './game/wordDb.js';
import { loadTransliterator } from './game/transliterator.js';
import { load as loadState, get } from './game/gameState.js';
import { mainMenuScreen }   from './screens/mainMenu.js';
import { dailyPuzzleScreen } from './screens/dailyPuzzle.js';
import { statsScreen }       from './screens/stats.js';
import { settingsScreen }    from './screens/settings.js';
import { howToPlayScreen }   from './screens/howToPlay.js';
import { setupNotifications, scheduleDailyReminder } from './notifications.js';

// Register all screens
register('menu',     mainMenuScreen);
register('puzzle',   dailyPuzzleScreen);
register('stats',    statsScreen);
register('settings', settingsScreen);
register('howToPlay', howToPlayScreen);

async function boot() {
  loadState();
  await Promise.all([loadWordDB(), loadTransliterator()]);
  document.getElementById('loader').style.display = 'none';
  navigate('menu');

  // Re-schedule daily reminder on each launch (keeps it alive)
  const s = get().settings;
  if (s.notifications) {
    setupNotifications().then(granted => {
      if (granted) scheduleDailyReminder(s.notifHour);
    });
  }
}

boot().catch(console.error);
