// Übernimmt die Linien-Symbole der Web-App (zuno-app/public/js/ui.js, Objekt P) nach src/components/icon-paths.ts,
// damit App und Web genau dieselben Symbole zeigen. Nach Änderungen an den Web-Symbolen erneut ausführen.
import fs from 'node:fs';
const src = fs.readFileSync('C:/install/zuno-app/public/js/ui.js', 'utf8');
const start = src.indexOf('const P = {');
const end = src.indexOf('\n};', start);
const body = src.slice(start + 'const P = {'.length, end);
const out = {};
for (const m of body.matchAll(/^\s*([A-Za-z0-9_]+):\s*'([^']*)'/gm)) out[m[1]] = m[2];
const lines = Object.entries(out).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`);
fs.writeFileSync(new URL('../src/components/icon-paths.ts', import.meta.url), `// Automatisch aus der Web-App übernommen (scripts/sync-icons.mjs) – nicht von Hand ändern.\nexport const P = {\n${lines.join('\n')}\n} as const;\nexport type IconName = keyof typeof P;\n`);
console.log(Object.keys(out).length + ' Symbole übernommen');
