// Übersetzungen aus i18n-out/<code>.json in src/lang/<code>.json übernehmen und prüfen:
// gleiche Platzhalter ({0}, {n} …), gleiche Leerzeichen am Anfang/Ende. Fehlerhafte Einträge werden NICHT übernommen.
// Aufruf: node scripts/i18n-merge.mjs [sprachen…]
import fs from 'node:fs';
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ['en', 'ar', 'es', 'fr', 'it', 'ku', 'nl', 'pl', 'pt', 'ru', 'tr'];
const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const edge = (s) => [/^\s*/.exec(s)[0].length > 0, /\s*$/.exec(s)[0].length > 0].join();
for (const l of LANGS) {
  const outF = `i18n-out/${l}.json`;
  if (!fs.existsSync(outF)) { console.log(l, 'noch keine Übersetzung'); continue; }
  const add = JSON.parse(fs.readFileSync(outF, 'utf8'));
  const file = `src/lang/${l}.json`;
  const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
  const missing = JSON.parse(fs.readFileSync(`i18n-missing/${l}.json`, 'utf8'));
  let ok = 0; const bad = [];
  for (const k of missing) {
    const v = add[k];
    if (typeof v !== 'string' || !v.trim()) { bad.push(['fehlt', k]); continue; }
    if (ph(k) !== ph(v)) { bad.push(['Platzhalter', k, v]); continue; }
    if (edge(k) !== edge(v)) { bad.push(['Rand', k, v]); continue; }
    cur[k] = v; ok++;
  }
  const sorted = Object.fromEntries(Object.keys(cur).sort().map((k) => [k, cur[k]]));
  fs.writeFileSync(file, JSON.stringify(sorted, null, 1) + '\n');
  console.log(`${l}: ${ok} übernommen, ${bad.length} abgelehnt`);
  for (const b of bad.slice(0, 6)) console.log('   ', b.map((x) => JSON.stringify(x)).join(' → '));
}
