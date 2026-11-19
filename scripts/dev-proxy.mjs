// Nur zum Entwickeln: Die App im Browser (Expo web) und der lokale Asoo-Server (wrangler dev, Port 8787) unter EINER Adresse,
// damit der Browser kein CORS braucht. /api/* und /media/* gehen an den Server, alles andere an Expo (Port 8081, mit Websocket).
// Zum Server hin sieht die Anfrage aus wie vom Handy: ohne Origin, ohne Cookies – die App meldet sich mit ihrem Schlüssel an.
// Im Browser können <img> und WebSocket keine Kopfzeilen schicken: Das Cookie `dev_media_token` (setzt die App beim
// Anmelden, nur im Entwicklungsmodus) wird hier in „Authorization: Bearer …“ umgesetzt.
// Start: node scripts/dev-proxy.mjs [port=8091]  ·  env BACKEND, EXPO
import http from 'node:http';
import net from 'node:net';

const PORT = Number(process.argv[2] ?? 8091);
const BACKEND = new URL(process.env.BACKEND ?? 'http://127.0.0.1:8787');
const EXPO = new URL(process.env.EXPO ?? 'http://127.0.0.1:8081');
const DROP_TO_BACKEND = ['origin', 'referer', 'cookie', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest', 'sec-fetch-user'];
const toBackend = (url) => url.startsWith('/api/') || url.startsWith('/media/');
const devToken = (req) => /(?:^|;\s*)dev_media_token=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];

const server = http.createServer((req, res) => {
  const target = toBackend(req.url ?? '/') ? BACKEND : EXPO;
  const headers = { ...req.headers, host: target.host };
  if (target === BACKEND) {
    const tok = devToken(req);
    if (tok && !headers.authorization) { headers.authorization = `Bearer ${tok}`; headers['x-client'] = 'asoo-app'; }
    for (const h of DROP_TO_BACKEND) delete headers[h];
  }
  const out = http.request({ host: target.hostname, port: target.port, path: req.url, method: req.method, headers }, (up) => {
    res.writeHead(up.statusCode ?? 502, up.headers);
    up.pipe(res);
  });
  out.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`Proxy: ${target.host} nicht erreichbar (${err.message})`);
  });
  req.pipe(out);
});

// Websockets: /api/ws an den Server (mit Anmeldung aus dem Cookie), alles andere an Expo (Neuladen, Logs)
server.on('upgrade', (req, socket, head) => {
  const back = (req.url ?? '').startsWith('/api/ws');
  const target = back ? BACKEND : EXPO;
  const h = { ...req.headers, host: target.host };
  if (back) {
    const tok = devToken(req);
    if (tok) h.authorization = `Bearer ${tok}`;
    for (const k of DROP_TO_BACKEND) delete h[k];
  }
  const up = net.connect(Number(target.port), target.hostname, () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`, ...Object.entries(h).map(([k, v]) => `${k}: ${v}`)];
    up.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head?.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

server.listen(PORT, '127.0.0.1', () => console.log(`dev-proxy http://localhost:${PORT} → api ${BACKEND.host}, app ${EXPO.host}`));
