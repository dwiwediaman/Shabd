import { LocalNotifications } from '@capacitor/local-notifications';

const NOTIF_ID = 1;
const CHANNEL_ID = 'shabd-daily';

export async function setupNotifications() {
  try {
    // Create Android notification channel
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Daily Puzzle',
      description: 'Daily Shabd puzzle reminder',
      importance: 3, // DEFAULT
      visibility: 1, // PUBLIC
      sound: 'default',
      vibration: true,
    });

    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted';
  } catch (_) {
    return false;
  }
}

export async function scheduleDailyReminder(hourIST = 20) {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] });

    // Convert IST hour to UTC (IST = UTC+5:30)
    const nowIST = new Date(Date.now() + 19800000);
    const target = new Date(nowIST);
    target.setHours(hourIST, 0, 0, 0);

    // If the time has already passed today, schedule for tomorrow
    if (target <= nowIST) target.setDate(target.getDate() + 1);

    // Convert back to UTC for scheduling
    const scheduleAt = new Date(target.getTime() - 19800000);

    await LocalNotifications.schedule({
      notifications: [{
        id: NOTIF_ID,
        channelId: CHANNEL_ID,
        title: '🟩 शब्द · Shabd',
        body: "Today's puzzle is waiting — can you guess it? 🤔",
        schedule: {
          at: scheduleAt,
          repeats: true,
          every: 'day',
        },
        actionTypeId: '',
        extra: null,
      }],
    });
  } catch (_) {}
}

export async function cancelReminder() {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] });
  } catch (_) {}
}
