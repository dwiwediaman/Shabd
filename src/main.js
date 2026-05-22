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
import { squadsScreen }      from './screens/squads.js';
import { setupNotifications, scheduleDailyReminder } from './notifications.js';
import { checkForUpdate } from './updateCheck.js';
import { isSignedIn } from './cloud/auth.js';
import { ensureBackfilled } from './cloud/sync.js';
import { consumePendingDeepLink, createDeepLinkHandler } from './deepLink.js';
import { migrateLegacyArchiveSessions } from './migrations.js';
import { App as CapApp } from '@capacitor/app';

// Register all screens
register('menu',     mainMenuScreen);
register('puzzle',   dailyPuzzleScreen);
register('stats',    statsScreen);
register('settings', settingsScreen);
register('howToPlay', howToPlayScreen);
register('archive',   archiveScreen);
register('squads',    squadsScreen);

// ── Deep-link listener (registered BEFORE boot so cold-start URLs aren't
//    lost between the launch intent and screen registration) ───────────
// The handler is constructed via the factory so the dedupe state stays
// scoped (and is testable in deepLink.test.js).
const handleIncomingDeepLink = createDeepLinkHandler({
  navigate,
  isAppReady: () => document.getElementById('app')?.classList.contains('visible'),
});

try {
  // Capture any deep link the OS handed us at launch
  CapApp.getLaunchUrl?.()
    .then(res => handleIncomingDeepLink(res?.url))
    .catch(() => {});
  // Warm-start: app already running, OS delivers a new URL
  CapApp.addListener?.('appUrlOpen', (event) => handleIncomingDeepLink(event?.url));
} catch (e) {
  // Capacitor not available (running in browser/dev) — silently ignore
}

async function boot() {
  loadState();
  await Promise.all([
    loadWordDB(),
    loadTransliterator(),
    new Promise(r => setTimeout(r, 1500)), // minimum splash time
  ]);

  // Data migrations need wordDb loaded so target lookups work. Awaited
  // before the UI shows so stale-target cells can't be tapped during the
  // brief migration window.
  await migrateLegacyArchiveSessions();

  const loader = document.getElementById('loader');
  loader.classList.add('hiding');
  await new Promise(r => setTimeout(r, 400)); // wait for fade-out
  loader.style.display = 'none';

  const app = document.getElementById('app');
  app.classList.add('visible');

  // If we got a deep link at cold start, route to it instead of menu/tutorial
  const pending = consumePendingDeepLink();
  if (pending?.kind === 'squad') {
    navigate('squads', { joinCode: pending.code });
    // skip the regular landing logic — user wants to handle this invite now
    return scheduleBackgroundWork();
  }

  const flags = get().flags;
  if (!flags.seenTutorial) {
    navigate('howToPlay', { firstTime: true });
  } else {
    navigate('menu');
  }

  scheduleBackgroundWork();
}

function scheduleBackgroundWork() {
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

  // If signed in, push local-only sessions to the cloud (once per 24h max),
  // then pull anything the server has. Failures are non-fatal — the app
  // remains fully usable on local data. The throttle inside ensureBackfilled
  // means warm starts still pull, but skip the full push every time.
  if (isSignedIn()) {
    ensureBackfilled().catch(e => console.warn('[boot] sync failed:', e));
  }
}

boot().catch(console.error);
