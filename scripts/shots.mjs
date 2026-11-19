// Bilder der App im Browser (WebKit, iPhone-Größe) – nur zum Entwickeln. Meldet sich mit einem lokalen Test-Schlüssel an.
// Aufruf: node scripts/shots.mjs <ausgabeordner> [schlüsseldatei]
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { webkit } = createRequire('C:/install/billard-bonus/')('playwright');
const OUT = process.argv[2] || '.';
const token = process.argv[3] ? fs.readFileSync(process.argv[3], 'utf8').trim() : null;
const BASE = 'http://localhost:8091';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await webkit.launch();
try {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('Seitenfehler:', String(e).slice(0, 200)));
  const shot = async (name, url, wait = 3500, before) => {
    await page.goto(BASE + url, { waitUntil: 'domcontentloaded' }); await sleep(wait);
    if (before) { await before(); await sleep(800); }
    await page.screenshot({ path: `${OUT}/app-${name}.png` });
    console.log('Bild', name);
  };
  await shot('login', '/login', 5000);
  if (token) {
    await page.evaluate((t) => { localStorage.setItem('asoo.token', t); document.cookie = `dev_media_token=${t}; path=/`; }, token);
    await shot('start', '/', 6000);
    await shot('server', '/', 5000, async () => { await page.mouse.click(36, 105); });
    const ch = await page.evaluate(() => fetch('/api/me', { headers: { 'x-zuno': '1', 'x-client': 'asoo-app', authorization: 'Bearer ' + localStorage.getItem('asoo.token') } }).then((r) => r.json()).then((d) => d.servers[0]?.channels.find((c) => c.type === 'text')?.id));
    if (ch) await shot('chat', '/chat/' + ch, 5000);
    await shot('freunde', '/friends', 4000);
    await shot('mitteilungen', '/notifications', 4000);
    await shot('ich', '/me', 4000);
    await shot('einstellungen', '/settings', 4000);
  }
} finally { await b.close(); }
