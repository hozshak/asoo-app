// Google-Play-Screenshots (1080 × 1920, 9:16) aus den App-Bildern für den App Store: dunkler Hintergrund im
// ToLobby-Look, Überschrift oben, das Handy-Bild mit runden Ecken darunter. Gezeichnet mit WebKit (Playwright).
//   node store/play/make-screens.mjs <ordner-mit-app-bildern> [sprache en|de]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { webkit } = createRequire('C:/install/billard-bonus/')('playwright');
const SRC = process.argv[2];
const LANG = process.argv[3] || 'en';
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), 'screenshots', LANG);
fs.mkdirSync(OUT, { recursive: true });
const SHOTS = [
  ['1-3d-raum.png', { en: ['Hang out in 3D rooms', 'With your anime avatar – dance, sit, watch together'], de: ['Abhängen in 3D-Räumen', 'Mit deinem Anime-Avatar – tanzen, chillen, zusammen schauen'] }],
  ['2-nachrichten.png', { en: ['All your chats in one place', 'Friends, groups and calls'], de: ['Alle Chats an einem Ort', 'Freunde, Gruppen und Anrufe'] }],
  ['3-server.png', { en: ['Your own servers', 'Channels, roles and voice rooms'], de: ['Deine eigenen Server', 'Kanäle, Rollen und Sprachräume'] }],
  ['4-chat.png', { en: ['Chat with your community', 'Pictures, GIFs and reactions'], de: ['Chatte mit deiner Community', 'Bilder, GIFs und Reaktionen'] }],
  ['5-avatar.png', { en: ['Create your avatar', 'Your look for every 3D room'], de: ['Gestalte deinen Avatar', 'Dein Look für jeden 3D-Raum'] }],
  ['7-mitspieler-match.png', { en: ['Find teammates', 'Match with people who play what you play'], de: ['Finde Mitspieler', 'Match mit Leuten, die dasselbe spielen'] }],
];
const html = (img, [title, sub]) => `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden}
body{font-family:'Segoe UI Variable Display','Segoe UI',system-ui,sans-serif;color:#fff;
 background:radial-gradient(900px 700px at 20% 0%,rgba(124,92,255,.38),transparent 70%),radial-gradient(800px 700px at 100% 100%,rgba(0,200,255,.16),transparent 70%),#0c0b14;
 display:flex;flex-direction:column;align-items:center}
h1{margin-top:108px;font-size:76px;font-weight:700;letter-spacing:-1.5px;text-align:center;line-height:1.05;padding:0 70px}
p{margin-top:22px;font-size:38px;font-weight:400;color:#bdb8d6;text-align:center;padding:0 90px;line-height:1.25}
.ph{margin-top:64px;height:1420px;aspect-ratio:1320/2868;border-radius:58px;overflow:hidden;
 box-shadow:0 40px 90px rgba(0,0,0,.6),0 0 0 3px rgba(255,255,255,.10),0 0 80px rgba(124,92,255,.25)}
.ph img{width:100%;height:100%;object-fit:cover;display:block}
</style></head><body><h1>${title}</h1><p>${sub}</p><div class="ph"><img src="data:image/png;base64,${img}"></div></body></html>`;
const b = await webkit.launch();
try {
  const page = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  for (const [file, txt] of SHOTS) {
    const f = path.join(SRC, file);
    if (!fs.existsSync(f)) { console.log('fehlt', file); continue; }
    await page.setContent(html(fs.readFileSync(f).toString('base64'), txt[LANG]), { waitUntil: 'load' });
    const out = path.join(OUT, file.replace(/^(\d)-.*$/, (m, n) => `${n}-` + txt.en[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '') + '.png'));
    await page.screenshot({ path: out });
    console.log('Bild', out);
  }
} finally { await b.close(); }
