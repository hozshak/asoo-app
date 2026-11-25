// Live-Verbindung zum Server (WebSocket): neue Nachrichten, Tippen, Freundschaften, Kanäle … ohne Neuladen.
// Baut sich nach Abbrüchen selbst neu auf und lädt danach den Stand neu (bootstrap), damit nichts fehlt.
import { AppState, Platform } from 'react-native';
import { WS_BASE, api, getToken } from './api';
import { bootstrap, getState, putUsers, setState, mentionsMe, channelInfo, type Msg } from './store';
import { setBadge, showParty } from './match';

type Fn = (m: any) => void;
const listeners = new Set<Fn>();
export const onLive = (fn: Fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

let ws: WebSocket | null = null;
let want = false, backoff = 1000, retry: any = null, ping: any = null, lastMsg = 0, hadHello = false;
export let myCid: string | null = null;
let viewing: string | null = null; // Kanal, den man gerade offen hat (dort zählt nichts als ungelesen)
export const setViewing = (ch: string | null) => { viewing = ch; };

export function connect() {
  want = true;
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  const token = getToken();
  if (!token) return;
  // Im Browser beim Entwickeln kann WebSocket keine Kopfzeilen schicken – dort ergänzt der Entwicklungs-Proxy die Anmeldung
  const sock: WebSocket = Platform.OS === 'web'
    ? new WebSocket(`${WS_BASE}/api/ws`)
    : new (WebSocket as any)(`${WS_BASE}/api/ws`, null, { headers: { authorization: `Bearer ${token}`, 'x-client': 'asoo-app' } });
  ws = sock;
  sock.onopen = () => {
    if (sock !== ws) return;
    backoff = 1000; lastMsg = Date.now();
    setState(() => ({ online: true }));
    reportAct(true);
    clearInterval(ping);
    ping = setInterval(() => {
      if (sock !== ws) return;
      if (Date.now() - lastMsg > 50000) { try { sock.close(); } catch {} return; } // keine Antwort mehr: neu verbinden
      try { sock.send('ping'); } catch {}
    }, 20000);
  };
  sock.onmessage = (e) => {
    if (sock !== ws) return;
    lastMsg = Date.now();
    if (e.data === 'pong') return;
    let m: any;
    try { m = JSON.parse(String(e.data)); } catch { return; }
    if (m.t === 'hello') {
      myCid = m.cid;
      if (hadHello) bootstrap().catch(() => {}); // nach Unterbrechung: Verpasstes nachholen
      hadHello = true;
      return;
    }
    apply(m);
    for (const fn of listeners) fn(m);
  };
  sock.onclose = (e) => {
    if (sock !== ws) return;
    ws = null; myCid = null; clearInterval(ping);
    setState(() => ({ online: false }));
    if (e.code === 4001) return; // abgemeldet / Sitzung vorbei
    if (want) { clearTimeout(retry); retry = setTimeout(connect, backoff + Math.random() * 400); backoff = Math.min(backoff * 2, 15000); }
  };
  sock.onerror = () => {};
}
export function disconnect() {
  want = false; clearTimeout(retry); clearInterval(ping);
  const s = ws; ws = null; myCid = null;
  try { s?.close(); } catch {}
}
export function send(obj: unknown) { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch {} }

// Schaue ich gerade hin? Der Server schickt Pushs nur, wenn auf keinem Gerät jemand hinschaut. Geht die App in den
// Hintergrund, sofort „nein“ melden – sonst kämen keine Pushs, solange die Verbindung noch offen ist.
let lastAct: boolean | null = null;
function reportAct(force = false) {
  const on = AppState.currentState === 'active';
  if (!force && on === lastAct) return;
  lastAct = on;
  send({ t: 'act', on });
}
// App kommt zurück in den Vordergrund: Verbindung prüfen
AppState.addEventListener('change', (st) => {
  reportAct();
  if (st === 'active' && want) { if (!ws || ws.readyState > 1) { backoff = 500; connect(); } }
});

// ---------- Ereignisse in den Zustand übernehmen ----------
function apply(m: any) {
  const s = getState();
  switch (m.t) {
    case 'msg': {
      const msg: Msg = m.m;
      putUsers([m.author, ...(m.users ? Object.values(m.users) as any[] : [])]);
      setState((st) => {
        const cur = st.messages[msg.ch];
        const messages = cur ? { ...st.messages, [msg.ch]: { ...cur, list: cur.list.some((x) => x.id === msg.id || (msg.nonce && x.nonce === msg.nonce)) ? cur.list.map((x) => (x.id === msg.id || (msg.nonce && x.nonce === msg.nonce) ? { ...msg, attachments: msg.attachments?.length ? msg.attachments : x.attachments } : x)) : [...cur.list, msg] } } : st.messages;
        const info = channelInfo(msg.ch);
        // wer gerade etwas geschickt hat, tippt nicht mehr
        const tp = st.typing[msg.ch];
        const typing = tp && tp[msg.author_id] ? { ...st.typing, [msg.ch]: Object.fromEntries(Object.entries(tp).filter(([u]) => u !== msg.author_id)) } : st.typing;
        // Unterhaltungs-Liste: Vorschau der letzten Nachricht und nach oben (auch für eigene Nachrichten)
        const dms = info ? st.dms : st.dms.map((d) => (d.id === msg.ch ? { ...d, last_at: msg.created, last: { a: msg.author_id, c: (msg.content || '').slice(0, 120), att: !!msg.attachments?.length, k: msg.kind || 'default', t: msg.created } } : d)).sort((a, b) => b.last_at - a.last_at);
        if (msg.author_id === st.me?.id || viewing === msg.ch || st.blocks.includes(msg.author_id)) return { messages, dms, typing };
        const unread = { ...st.unread, [msg.ch]: (st.unread[msg.ch] || 0) + 1 };
        const ment = mentionsMe(msg.content || '', info?.server.id) || !info; // Direktnachrichten zählen immer
        const mentions = ment ? { ...st.mentions, [msg.ch]: (st.mentions[msg.ch] || 0) + 1 } : st.mentions;
        return { messages, unread, mentions, dms, typing };
      });
      return;
    }
    case 'msg_edit': setState((st) => { const cur = st.messages[m.m.ch]; if (!cur) return; return { messages: { ...st.messages, [m.m.ch]: { ...cur, list: cur.list.map((x) => (x.id === m.m.id ? { ...x, ...m.m, reactions: x.reactions } : x)) } } }; }); return;
    case 'msg_del': setState((st) => { const cur = st.messages[m.ch]; if (!cur) return; return { messages: { ...st.messages, [m.ch]: { ...cur, list: cur.list.filter((x) => x.id !== m.id) } } }; }); return;
    case 'react': setState((st) => {
      const cur = st.messages[m.ch]; if (!cur) return;
      const mine = m.uid === st.me?.id;
      const list = cur.list.map((x) => {
        if (x.id !== m.id) return x;
        const rs = [...(x.reactions || [])];
        const i = rs.findIndex((r) => r.emoji === m.emoji);
        if (m.on) { if (i >= 0) rs[i] = { ...rs[i], count: rs[i].count + 1, me: rs[i].me || mine }; else rs.push({ emoji: m.emoji, count: 1, me: mine }); }
        else if (i >= 0) { const c = rs[i].count - 1; if (c <= 0) rs.splice(i, 1); else rs[i] = { ...rs[i], count: c, me: mine ? false : rs[i].me }; }
        return { ...x, reactions: rs };
      });
      return { messages: { ...st.messages, [m.ch]: { ...cur, list } } };
    }); return;
    case 'typing': setState((st) => ({ typing: { ...st.typing, [m.ch]: { ...(st.typing[m.ch] || {}), [m.uid]: Date.now() + 8000 } } })); return;
    case 'read': setState((st) => { const unread = { ...st.unread }, mentions = { ...st.mentions }; delete unread[m.ch]; delete mentions[m.ch]; return { unread, mentions }; }); return;
    case 'user': case 'me': putUsers([m.user]); if (m.user?.id === s.me?.id) setState((st) => ({ me: { ...st.me!, ...m.user } })); return;
    case 'poll': {
      // Umfrage-Stand für alle; „mine“ nur übernehmen, wenn man selbst abgestimmt hat
      setState((st) => {
        const box = st.messages[m.ch];
        if (!box) return {};
        return { messages: { ...st.messages, [m.ch]: { ...box, list: box.list.map((x) => (x.id === m.id ? { ...x, poll: { ...m.poll, mine: m.by === st.me?.id ? m.mine : (x.poll?.mine || []) } } : x)) } } };
      });
      return;
    }
    case 'dm': putUsers(m.dm.members); setState((st) => ({ dms: [m.dm, ...st.dms.filter((d) => d.id !== m.dm.id)].sort((a, b) => b.last_at - a.last_at) })); return;
    case 'dm_remove': setState((st) => ({ dms: st.dms.filter((d) => d.id !== m.id) })); return;
    case 'notif': setState((st) => ({ notifUnread: st.notifUnread + 1 })); return;
    // Mitteilungs-Stufe eines Servers geändert (auch von einem anderen Gerät)
    case 'server_silence': setState((st) => ({ servers: st.servers.map((sv) => (sv.id === m.server ? { ...sv, silenced_until: m.silenced_until } : sv)) })); return;
    case 'server_notify': setState((st) => ({ servers: st.servers.map((sv) => (sv.id === m.server ? { ...sv, notify: m.notify, notify_raw: m.notify_raw } : sv)) })); return;
    // „Mitspieler finden“: Zähler der Einstiege; bei einem Match die Feier zeigen (ab jetzt mit Namen)
    case 'match_badge': case 'match_like': setBadge(m.badge); return;
    case 'match': setBadge(m.badge); if (m.user && m.dm) showParty({ user: m.user, dm: m.dm }); return;
    case 'voice': {
      const missing = (m.members || []).map((x: any) => x.uid).filter((uid: string) => !s.users[uid]);
      setState((st) => { const voice = { ...st.voice }; if (m.members?.length) voice[m.room] = m.members; else delete voice[m.room]; return { voice }; });
      for (const uid of missing) api<any>('GET', '/api/users/' + uid).then((d) => putUsers([d.user])).catch(() => {});
      return;
    }
    case 'friend': case 'blocked': case 'server': case 'server_update': case 'server_remove': case 'channel': case 'channel_remove':
    case 'category': case 'category_remove': case 'layout': case 'role': case 'role_remove': case 'member_role':
      // Seltene Änderungen an Servern und Freundschaften: einfach den Stand neu holen (klein und sicher richtig)
      refreshSoon();
      return;
  }
}
let refreshT: any = null;
function refreshSoon() { clearTimeout(refreshT); refreshT = setTimeout(() => bootstrap().catch(() => {}), 250); }
