// App-Symbol für den App Store: 1024 × 1024, ohne Transparenz und ohne eigene runde Ecken (die rundet iOS selbst ab).
// Aufruf: node scripts/make-icon.mjs  → assets/images/icon.png
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { webkit } = createRequire('C:/install/billard-bonus/')('playwright');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#ff5c8a"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><g transform="translate(50 50) scale(0.82) translate(-50 -50)"><path fill-rule="evenodd" d="M44 27h12l20 46H64l-3.9-9H39.9L36 73H24zM50 40.8L44.26 54h11.48z" fill="#fff"/><circle cx="78" cy="24" r="5" fill="#fff" opacity=".85"/></g></svg>`;
const b = await webkit.launch();
try {
  const p = await b.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  await p.setContent(`<html><body style="margin:0;background:#7c5cff">${svg}</body></html>`);
  await p.screenshot({ path: path.join(root, 'assets/images/icon.png'), omitBackground: false, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
  console.log('icon.png geschrieben');
} finally { await b.close(); }
