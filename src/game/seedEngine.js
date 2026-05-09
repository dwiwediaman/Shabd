// IST-keyed deterministic daily seed — mirrors SeedEngine.gd
const IST_OFFSET_MS = 19800 * 1000; // +5:30
const SEED_VERSION = 'shabd-v1';
const LAUNCH_EPOCH_MS = new Date('2026-01-01T00:00:00Z').getTime();

export function getISTDate(ts = Date.now()) {
  const ist = new Date(ts + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getPuzzleIndex(istDate = getISTDate()) {
  const epoch = LAUNCH_EPOCH_MS;
  const date = new Date(istDate + 'T00:00:00Z').getTime();
  const days = Math.floor((date - epoch) / 86400000);
  return days + 1;
}

export async function getDailySeed(istDate, lang) {
  const raw = `${istDate}|${SEED_VERSION}|${lang}`;
  const buf = new TextEncoder().encode(raw);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(hashBuf);
  // First 8 bytes as unsigned 64-bit (JS BigInt), then mod to safe int
  let seed = 0n;
  for (let i = 0; i < 8; i++) seed |= BigInt(bytes[i]) << BigInt(i * 8);
  return Number(seed & 0x7FFFFFFFFFFFFFFFn);
}

export async function today(lang) {
  const date = getISTDate();
  return {
    date,
    index: getPuzzleIndex(date),
    seed: await getDailySeed(date, lang),
    lang,
  };
}

export async function forDate(date, lang) {
  return {
    date,
    index: getPuzzleIndex(date),
    seed: await getDailySeed(date, lang),
    lang,
  };
}
