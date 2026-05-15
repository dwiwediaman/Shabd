#!/usr/bin/env node
// Regenerate workers/src/data/pool_{en,hi}.js from the client's word DB.
// Run from the repo root or from workers/ — auto-detects.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = resolve(__dirname, '../..');
const dataIn    = (lang) => resolve(repoRoot, 'public/data/words_' + lang + '.json');
const dataOut   = (lang) => resolve(__dirname, '../src/data/pool_' + lang + '.js');

mkdirSync(resolve(__dirname, '../src/data'), { recursive: true });

for (const lang of ['en', 'hi']) {
  const data = JSON.parse(readFileSync(dataIn(lang), 'utf8'));
  const pools = { common: [], mid: [], challenge: [] };
  for (const e of data) {
    if (e.in_daily_pool === 1) {
      const t = e.tier || 'common';
      if (pools[t]) pools[t].push(e.word);
    }
  }
  const out = `// AUTO-GENERATED from public/data/words_${lang}.json — do not hand-edit.
// Regenerate with: npm --prefix workers run regen-pools

export const POOL = {
  common:    ${JSON.stringify(pools.common)},
  mid:       ${JSON.stringify(pools.mid)},
  challenge: ${JSON.stringify(pools.challenge)},
};
`;
  writeFileSync(dataOut(lang), out);
  console.log(`✓ ${dataOut(lang)} — ${out.length} bytes (` +
              `${pools.common.length} common, ${pools.mid.length} mid, ${pools.challenge.length} challenge)`);
}
