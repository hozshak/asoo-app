// Sammelt alle t('…')-Texte der App, übernimmt vorhandene Übersetzungen aus der Web-App (zuno-app/public/js/lang*)
// und schreibt src/lang/<code>.json. Fehlende Übersetzungen landen in i18n-missing/<code>.json (zum Übersetzen).
// Aufruf: node scripts/i18n-extract.mjs
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve('src');
const WEB = 'C:/install/zuno-app/public/js/';
const LANGS = ['en', 'ar', 'es', 'fr', 'it', 'ku', 'nl', 'pl', 'pt', 'ru', 'tr'];
const keys = new Set();
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(tsx?)$/.test(f)) {
  const s = fs.readFileSync(p, 'utf8');
  for (const m of s.matchAll(/\b(?:t|tr)\(("(?:[^"\\]|\\.)*")/g)) keys.add(JSON.parse(m[1]));
  for (const m of s.matchAll(/\b(?:t|tr)\('((?:[^'\\]|\\.)*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
} } };
walk(ROOT);
const web = {};
const { EN, AR } = await import('file:///' + WEB + 'lang-data.js');
web.en = EN; web.ar = AR;
for (const l of LANGS.filter((x) => !web[x])) { try { web[l] = (await import('file:///' + WEB + 'lang/' + l + '.js')).default; } catch { web[l] = {}; } }
fs.mkdirSync('i18n-missing', { recursive: true });
const stats = [];
for (const l of LANGS) {
  const file = path.join(ROOT, 'lang', l + '.json');
  const cur = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const out = {}, missing = [];
  // In der spanischen Web-Datei standen versehentlich kurdische Sätze – die nicht übernehmen
  const wrongKu = (k, v) => l !== 'ku' && v && web.ku[k] === v && /[êîûçş]/.test(v);
  for (const k of [...keys].sort()) {
    const v = [cur[k], web[l][k]].find((x) => x && !wrongKu(k, x));
    if (v) out[k] = v; else missing.push(k);
  }
  fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join('i18n-missing', l + '.json'), JSON.stringify(missing, null, 1) + '\n');
  stats.push(`${l}: ${Object.keys(out).length} da, ${missing.length} fehlen`);
}
console.log('Texte:', keys.size);
console.log(stats.join('\n'));
