# Privacy Policy — Shabd

_Effective: 2026-05-15. App package: `in.shabd.game`._

Shabd is a daily word-puzzle game. We keep your data exposure as small as we
possibly can. The short version:

> **By default, everything stays on your device.** If you choose to back up
> your progress via Google Sign-In, we store a small amount of game data on
> our servers under an opaque ID — never your name, email, contacts, location,
> or any tracking analytics.

---

## 1. What we collect — and only if you opt in

### Default mode (no sign-in)

If you simply play the game without signing in, **we collect nothing**. All
your stats, sessions, streaks, settings, and freezes live on your device's
local storage.

### Cloud backup mode (you tap "Back up progress" → sign in with Google)

If you choose to back up your progress, the following is sent to our servers
hosted on Cloudflare:

- **An opaque Google user identifier** (Google's "sub" claim from the ID token). We use this only to link your sign-in to your saved data. We do **not** store your email, name, or profile picture.
- **A nickname**, automatically derived from the local part of your Google email (e.g. `rahul@example.com` becomes "Rahul"). This is shown to your friends inside a Squad. You can change it later.
- **Game sessions**: for each puzzle you've played, the date, the language (English or Hindi), the words you guessed, whether you won, and how many attempts you took.
- **Streak freezes** that you've used or have available.
- **Preferences**: the language you play in, whether Hard Mode is on, and whether you've seen the tutorial.
- **Squads (private leaderboards)**: the name of any Squad you create, its 6-character invite code, the date you joined, and your rank for each day.

That's the complete list.

---

## 2. What we explicitly **do not** collect

- Your real name
- Your email address
- Your phone number
- Your contacts list
- Your photos or media
- Your location, IP address (beyond standard server logs that auto-delete within 7 days), or device identifier
- Your browsing or search history
- Any analytics on individual taps, screen views, or session length
- Any advertising or marketing identifiers

The app contains no ad SDK, no analytics SDK, and no tracking pixels of any kind.

---

## 3. How we use the data

The only purposes are:

1. **Restoring your progress** when you reinstall or switch devices.
2. **Showing your rank** to the friends you explicitly invited into your Squad.
3. **Verifying scores server-side** to prevent cheating on leaderboards. When you finish a puzzle, the app sends your guesses (not the score) to our server, and the server replays them against the day's target to compute your real win/loss state.

We **do not** use the data for advertising, profiling, training AI/ML models, or any kind of profile sale.

---

## 4. Who we share it with

**Nobody.** We do not sell, rent, or share the data with any third party.

Operationally, the data is stored on Cloudflare's Workers + D1 platform (a serverless edge compute platform with an SQLite-compatible database). Cloudflare may have technical access to the data necessary to operate the service, but they do not have product access or any independent right to use it. Their privacy policy is here: <https://www.cloudflare.com/privacypolicy/>.

We use Google Sign-In as the authentication method. Google's privacy policy applies to your interaction with Google's sign-in screen: <https://policies.google.com/privacy>.

---

## 5. How long we keep it

- **As long as you keep the cloud backup enabled.** Game sessions are stored indefinitely so you can see your full history.
- **Server access logs** are auto-deleted within 7 days. These logs do not include game contents — only HTTP status codes and timing.
- **Once you delete your account** (in-app: Settings → Back up progress → Delete cloud data), everything listed in Section 1 is removed within seconds via a cascading database delete. There is no soft-delete and no archival copy.

---

## 6. Your rights

You have the right to:

- **Access** the data we have on you — request via email (below).
- **Delete** the data — use the in-app button or request via email.
- **Stop using the cloud backup** at any time by signing out (your local game data on the device is unaffected).
- **Export** your data — request via email; we will reply with a JSON file within 7 business days.

See <https://github.com/dwiwediaman/Shabd/blob/main/docs/delete-account.md> for full deletion instructions.

---

## 7. Security

- All traffic between the app and our servers is encrypted with TLS (HTTPS).
- Your session token (a JSON Web Token issued by our server) is stored only in the app's local storage and is rotated when you sign in fresh.
- Our server verifies every API call against a cryptographic signature; tampering or replay is rejected.
- We do not store passwords — sign-in is handled entirely by Google.

---

## 8. Children's data

Shabd is rated 3+ in the Google Play store. We do not knowingly collect data from children. If you believe a child under 13 has signed in, contact us at the email below and we will delete the account.

---

## 9. Changes

We may update this policy as the app evolves. When we do, we'll update the **Effective** date at the top. Material changes will be announced inside the app via an in-app banner.

---

## 10. Contact

For any privacy questions or to exercise your rights, contact the developer at:

**Rahul Dwiwedi** · `dwiwediaman@gmail.com`

We aim to reply within 7 business days.
