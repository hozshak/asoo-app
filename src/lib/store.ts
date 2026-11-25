// Zustand der App: Konto, Server mit Kanälen/Kategorien/Rollen, Direktnachrichten, Freunde, Ungelesenes, Nachrichten je Kanal.
// Geladen mit /api/me, danach live über die Verbindung (live.ts) aktuell gehalten – wie in der Web-App (zuno-app/public/js/state.js).
import { useSyncExternalStore } from 'react';
import { api } from './api';

export type User = { id: string; username: string; display: string; avatar?: string | null; banner?: string | null; banner_color?: string | null; accent?: string; status?: string; custom_status?: string; pronouns?: string; bio?: string; deleted?: boolean; badges?: string[]; created?: number };
export type Channel = { id: string; server_id: string; name: string; type: 'text' | 'voice' | 'voice3d' | 'game'; topic?: string | null; position: number; created: number; parent?: string | null; view_role?: string; post_role?: string; user_limit?: number; theme?: string };
export type Category = { id: string; server_id: string; name: string; position: number; created: number };
export type Role = { id: string; server_id: string; name: string; color?: string | null; rank?: string; hoist?: number; position: number; mentionable?: number };
export type Server = { id: string; name: string; icon?: string | null; icon_emoji?: string | null; color?: string | null; banner?: string | null; description?: string; owner_id: string; role: string; member_count?: number; notify?: 'all' | 'mentions' | 'none'; notify_raw?: 'all' | 'mentions' | 'none' | null; channels: Channel[]; categories?: Category[]; roles?: Role[]; my_roles?: string[] };
/** Letzte Nachricht einer Unterhaltung (Vorschau in der Liste): a = Absender, c = Text, att = hat Bild, k = Art, t = Zeit */
export type LastMsg = { a: string; c: string; att: boolean; k: string; t: number };
export type DM = { id: string; kind: 'dm' | 'group'; name?: string | null; owner_id?: string | null; last_at: number; last?: LastMsg | null; members: User[] };
export type Msg = { id: string; ch: string; author_id: string; content: string; created: number; edited?: number | null; reply_to?: string | null; reply?: any; attachments: { key: string; w?: number; h?: number; name?: string; spoiler?: boolean; local?: string; type?: string; size?: number; voice?: boolean; dur?: number; sticker?: string }[]; poll?: { q: string; multi: boolean; options: { t: string; n: number }[]; voters: number; mine: number[] }; reactions: { emoji: string; count: number; me: boolean }[]; kind: string; pinned?: boolean; nonce?: string; pending?: boolean; failed?: boolean };
export type Notif = { id: string; kind: string; actor?: User | null; ref?: string; url?: string; text?: string; created: number; read: number };

export type State = {
  ready: boolean;
  me: (User & { status_raw?: string }) | null;
  servers: Server[];
  dms: DM[];
  users: Record<string, User>;
  unread: Record<string, number>;
  mentions: Record<string, number>;
  friends: { friends: User[]; incoming: User[]; outgoing: User[] };
  blocks: string[];
  notifUnread: number;
  messages: Record<string, { list: Msg[]; hasMore: boolean; loaded: boolean }>;
  typing: Record<string, Record<string, number>>; // Kanal → Person → bis wann
  online: boolean;
  /** Wer gerade in welchem Sprach-/3D-Raum oder Anruf ist (Raum → Personen), wie S.voice der Web-App. */
  voice: Record<string, VoiceMember[]>;
  /** „Mitspieler finden“: Zähler für die Einstiege (neue Likes, Besucher, Matches); has = Gamer-Profil vorhanden */
  match: MatchBadge;
};
export type MatchBadge = { has: boolean; likes: number; views: number; matches: number };
const NO_MATCH: MatchBadge = { has: false, likes: 0, views: 0, matches: 0 };
export type VoiceMember = { uid: string; cid?: string; muted?: boolean; deaf?: boolean; video?: boolean; screen?: boolean; smute?: boolean; sdeaf?: boolean };

let state: State = { ready: false, me: null, servers: [], dms: [], users: {}, unread: {}, mentions: {}, friends: { friends: [], incoming: [], outgoing: [] }, blocks: [], notifUnread: 0, messages: {}, typing: {}, online: true, voice: {}, match: NO_MATCH };
const subs = new Set<() => void>();
export const getState = () => state;
export function setState(fn: (s: State) => Partial<State> | void) {
  const patch = fn(state);
  state = patch ? { ...state, ...patch } : { ...state };
  for (const s of subs) s();
}
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => sel(state), () => sel(state));
}

export const putUsers = (list: (User | null | undefined)[] | Record<string, User>) => {
  const arr = Array.isArray(list) ? list : Object.values(list);
  if (!arr.length) return;
  setState((s) => { const users = { ...s.users }; for (const u of arr) if (u && u.id) users[u.id] = { ...users[u.id], ...u }; return { users }; });
};
export const userOf = (id: string): User => state.users[id] || (state.me?.id === id ? state.me : null) || { id, username: '…', display: '…' };

const sortServer = (s: Server) => {
  s.channels = [...(s.channels || [])].sort((a, b) => a.position - b.position || a.created - b.created);
  s.categories = [...(s.categories || [])].sort((a, b) => a.position - b.position || a.created - b.created);
  s.roles = [...(s.roles || [])].sort((a, b) => a.position - b.position);
  return s;
};

/** Alles neu laden (Start, nach dem Anmelden, nach einer Unterbrechung). */
export async function bootstrap() {
  const d = await api<any>('GET', '/api/me');
  if (!d.user) { setState(() => ({ me: null, ready: true })); return null; }
  const users: Record<string, User> = { ...state.users };
  for (const dm of d.dms) for (const u of dm.members) users[u.id] = u;
  for (const k of ['friends', 'incoming', 'outgoing']) for (const u of d.friends?.[k] || []) users[u.id] = u;
  users[d.user.id] = d.user;
  setState(() => ({
    ready: true, me: d.user, servers: d.servers.map(sortServer), dms: d.dms, users, unread: d.unread || {}, mentions: d.mentions || {},
    friends: d.friends || { friends: [], incoming: [], outgoing: [] }, blocks: d.blocks || [], notifUnread: d.notif_unread || 0, voice: d.voice || {}, match: d.match || NO_MATCH,
  }));
  return d.user;
}
export function clearState() {
  setState(() => ({ ready: true, me: null, servers: [], dms: [], users: {}, unread: {}, mentions: {}, messages: {}, typing: {}, notifUnread: 0, friends: { friends: [], incoming: [], outgoing: [] }, blocks: [], voice: {}, match: NO_MATCH }));
}

// ---------- Nachrichten ----------
export async function loadMessages(ch: string, older = false) {
  const cur = state.messages[ch];
  if (older && (!cur || !cur.hasMore || !cur.list.length)) return;
  const q = older ? `?before=${cur!.list[0].id}&limit=50` : '?limit=50';
  const d = await api<any>('GET', `/api/channels/${ch}/messages${q}`);
  putUsers(d.users);
  setState((s) => {
    const prev = s.messages[ch];
    const list = older && prev ? [...d.messages, ...prev.list] : [...d.messages, ...(prev?.list.filter((m) => m.pending) || [])];
    return { messages: { ...s.messages, [ch]: { list, hasMore: d.has_more, loaded: true } } };
  });
}
function patchList(ch: string, fn: (list: Msg[]) => Msg[]) {
  setState((s) => { const cur = s.messages[ch]; if (!cur) return; return { messages: { ...s.messages, [ch]: { ...cur, list: fn(cur.list) } } }; });
}
export const addPending = (ch: string, m: Msg) => patchList(ch, (l) => [...l, m]);
export const replaceMsg = (ch: string, id: string, m: Msg | null) => patchList(ch, (l) => (m ? l.map((x) => (x.id === id || (m.nonce && x.nonce === m.nonce) ? { ...m, attachments: m.attachments?.length ? m.attachments : x.attachments } : x)) : l.filter((x) => x.id !== id)));
export const markFailed = (ch: string, nonce: string) => patchList(ch, (l) => l.map((x) => (x.nonce === nonce ? { ...x, pending: false, failed: true } : x)));

export function markRead(ch: string) {
  if (!state.unread[ch] && !state.mentions[ch]) return;
  setState((s) => { const unread = { ...s.unread }, mentions = { ...s.mentions }; delete unread[ch]; delete mentions[ch]; return { unread, mentions }; });
  api('POST', `/api/channels/${ch}/read`, {}).catch(() => {});
}

// ---------- Hilfen ----------
export const serverOf = (sid?: string | null) => state.servers.find((s) => s.id === sid) || null;
export const channelInfo = (id: string) => {
  for (const s of state.servers) { const c = s.channels.find((x) => x.id === id); if (c) return { server: s, channel: c }; }
  return null;
};
export const dmTitle = (dm: DM, meId?: string) => dm.name || dm.members.filter((u) => u.id !== meId).map((u) => u.display).join(', ') || 'Gruppe';
export const RANK: Record<string, number> = { owner: 4, admin: 3, mod: 2, member: 1 };
export const can = (sid: string, min: string) => RANK[serverOf(sid)?.role || 'member'] >= RANK[min];
/** Erwähnt mich diese Nachricht (Name, eine meiner Rollen, @everyone/@here auf Servern)? */
export function mentionsMe(content: string, sid?: string | null) {
  const me = state.me;
  if (!me || !content) return false;
  if (new RegExp('@' + me.username.replace(/\./g, '\\.') + '\\b', 'i').test(content)) return true;
  if (sid && /(^|[^\w@])@(everyone|here)\b/.test(content)) return true;
  const mine = sid ? serverOf(sid)?.my_roles : null;
  return !!mine?.some((id) => content.includes(`<@&${id}>`));
}
export const roleColor = (sid: string | null | undefined, uid: string) => {
  // Farbe der höchsten eigenen Rolle – nur für mich bekannt ohne Mitgliederliste; andere über members (später)
  const s = serverOf(sid); if (!s || !s.roles?.length) return null;
  const ids = uid === state.me?.id ? s.my_roles || [] : memberRoles[sid!]?.[uid] || [];
  return s.roles.find((r) => r.color && ids.includes(r.id))?.color || null;
};
export const memberRoles: Record<string, Record<string, string[]>> = {};
export async function loadMembers(sid: string) {
  const d = await api<any>('GET', `/api/servers/${sid}/members`);
  putUsers(d.members);
  memberRoles[sid] = Object.fromEntries(d.members.map((m: any) => [m.id, m.roles || []]));
  setState(() => ({}));
  return d.members as (User & { role: string; base?: string; roles?: string[]; nick?: string | null })[];
}
