// Links in Nachrichten: Links auf Asoo selbst (Einladung, Kanal, Profil, Beitrag) öffnen IN der App,
// alles andere im Browser der App (nicht in Safari, damit man nicht aus der App fällt).
import * as WebBrowser from 'expo-web-browser';
import type { useRouter } from 'expo-router';
import { BASE } from './api';
import { channelInfo, getState } from './store';
import { openWeb } from './web';
type Router = ReturnType<typeof useRouter>;

const HOSTS = ['tolobby.com', 'www.tolobby.com', 'zuno-app.altraex.workers.dev'];
const own = (u: URL) => HOSTS.includes(u.host) || (!!BASE && u.origin === new URL(BASE).origin);

/** Einladungs-Codes aus einem Text (Links der Form …/i/<Code> auf Asoo), höchstens drei. */
export function inviteCodes(text: string) {
  const out: string[] = [];
  for (const m of String(text || '').matchAll(/https?:\/\/[^\s/]+\/i\/([A-Za-z0-9]{6,12})\b/g)) {
    try { if (own(new URL(m[0])) && !out.includes(m[1])) out.push(m[1]); } catch {}
    if (out.length >= 3) break;
  }
  return out;
}

export function openLink(router: Router, raw: string) {
  let u: URL;
  try { u = new URL(raw); } catch { return; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return; // keine javascript:/file:/andere Schemata
  if (!own(u)) { WebBrowser.openBrowserAsync(raw).catch(() => {}); return; }
  const p = u.pathname.replace(/\/+$/, '');
  let m: RegExpMatchArray | null;
  if ((m = p.match(/^\/i\/([A-Za-z0-9]{6,12})$/))) return router.push({ pathname: '/invite/[code]', params: { code: m[1] } });
  if ((m = p.match(/^\/channels\/@me\/([\w-]+)$/))) return router.push({ pathname: '/chat/[id]', params: { id: m[1] } });
  if ((m = p.match(/^\/channels\/([\w-]+)\/([\w-]+)$/))) {
    const info = channelInfo(m[2]);
    if (info && info.channel.type === 'text') return router.push({ pathname: '/chat/[id]', params: { id: m[2] } });
    if (info) return openWeb(router, `/channels/${m[1]}/${m[2]}`);
    return openWeb(router, p);
  }
  if ((m = p.match(/^\/u\/([\w.-]+)$/))) {
    const st = getState();
    const id = Object.values(st.users).find((x) => x.id === m![1] || x.username === m![1])?.id || m[1];
    return router.push({ pathname: '/user/[id]', params: { id } });
  }
  if ((m = p.match(/^\/post\/([\w-]+)$/))) return router.push({ pathname: '/post/[id]', params: { id: m[1] } });
  if (p === '/feed') return router.push('/feed');
  if (/^\/(discover|settings)/.test(p)) return openWeb(router, p + u.search);
  WebBrowser.openBrowserAsync(raw).catch(() => {});
}
