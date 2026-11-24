// „Mitspieler finden“ (Gamer-Matching): Gamer-Profil, anonyme Karten, Like/Überspringen, Match, „Mag dich“, Besucher, Boost.
// Server: zuno-app/src/worker.js (Abschnitt „src/api/match.js“). Vor einem Match kennt die App weder Namen noch
// Nutzer-Kennung – nur die zufällige Karten-Kennung `pid`.
import { useSyncExternalStore } from 'react';
import { api, ApiError, errText } from './api';
import { getState, putUsers, setState, type DM, type MatchBadge, type User } from './store';

export type { MatchBadge };
export type MatchGame = { n: string; c: boolean };
export type MatchCard = {
  pid: string | null; avatar: string | null; banner: string | null; banner_color: string | null; accent: string; deco: string; effect: string;
  games: MatchGame[]; platforms: string[]; langs: string[]; style: string; mic: boolean; looking: string[]; about: string;
  times: number; overlap: number; score: number | null; boost: boolean; active: 'now' | 'today' | 'week' | 'old';
  at?: number; fresh?: boolean; liked?: boolean;
};
export type MatchProfile = { games: string[]; platforms: string[]; langs: string[]; looking: string[]; times: number; tz: number; style: string; mic: boolean; about: string; visible: boolean; created?: number };
export type MatchSelf = {
  profile: MatchProfile | null; preview: MatchCard | null; badge: MatchBadge;
  boost: { until: number; next: number; minutes: number }; likes_left: number; likes_day: number; hidden_cards: number;
  catalog: { games: string[]; platforms: string[]; looking: string[]; styles: string[]; langs: string[] };
};
export type MatchResult = { user: User; dm: DM };
export type MatchPair = { user: User; dm: string; created: number; fresh: boolean; games: string[] };

export const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const SLOTS = ['Morgens', 'Nachmittags', 'Abends', 'Nachts'];
export const SLOT_HINT = ['6–12 Uhr', '12–18 Uhr', '18–24 Uhr', '0–6 Uhr'];
export const PLATFORM: Record<string, string> = { pc: 'PC', ps: 'PlayStation', xbox: 'Xbox', switch: 'Switch', mobile: 'Handy' };
export const LOOKING: Record<string, string> = { duo: 'Duo-Partner', team: 'Ein Team', clan: 'Einen Clan', chat: 'Leute zum Quatschen' };
export const STYLE: Record<string, string> = { casual: 'Locker', ranked: 'Ehrgeizig (Ranked)', both: 'Locker & Ranked' };
export const ACTIVE: Record<string, string> = { now: 'Jetzt online', today: 'Heute aktiv', week: 'Diese Woche aktiv' };
export const LANG_NAME: Record<string, string> = { en: 'English', de: 'Deutsch', tr: 'Türkçe', ku: 'Kurdî', ar: 'العربية', fr: 'Français', es: 'Español', it: 'Italiano', pt: 'Português', nl: 'Nederlands', pl: 'Polski', ru: 'Русский' };
export const REASONS: [string, string][] = [['spam', 'Spam oder Werbung'], ['harassment', 'Belästigung oder Mobbing'], ['hate', 'Hass oder Hetze'], ['sexual', 'Sexuelle Inhalte'],
  ['minor_safety', 'Gefahr für Minderjährige'], ['impersonation', 'Gibt sich als jemand anderes aus'], ['other', 'Etwas anderes']];

const MSG: Record<string, string> = {
  like_limit: 'Für heute sind deine Likes aufgebraucht. Morgen geht es weiter.', boost_wait: 'Du hast dein Profil heute schon gepusht.',
  need_game: 'Wähle mindestens ein Spiel aus.', no_profile: 'Richte zuerst dein Gamer-Profil ein.', profile_paused: 'Dein Profil ist pausiert – schalte es erst wieder sichtbar.',
  nothing_to_undo: 'Es gibt nichts zum Zurückholen.', not_found: 'Diese Karte gibt es nicht mehr.',
};
export const matchErr = (e: unknown) => (e instanceof ApiError && MSG[e.code] ? MSG[e.code] : errText(e));

/** Farbe und Buchstaben der Spiel-Kachel (eigene Kacheln statt fremder Logos) */
export function gameTile(name: string): { a: string; b: string; t: string } {
  let x = 0;
  for (const c of String(name)) x = (x * 31 + (c.codePointAt(0) || 0)) % 360;
  const w = String(name).replace(/[^A-Za-z0-9À-ɏЀ-ӿ؀-ۿ ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const t = ((w[0] || '?')[0] + (w[1] ? w[1][0] : (w[0] || '')[1] || '')).toUpperCase();
  return { a: `hsl(${x}, 78%, 56%)`, b: `hsl(${(x + 48) % 360}, 80%, 44%)`, t };
}
export const mins = (ms: number) => { const m = Math.max(1, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} Std. ${m % 60} Min.` : `${m} Min.`; };
/** „vor 5 Min.“, „vor 3 Std.“, „vor 2 T.“ */
export function agoShort(t?: number) {
  if (!t) return '';
  const d = Date.now() - t;
  if (d < 60000) return 'gerade eben';
  if (d < 3600000) return `vor ${Math.floor(d / 60000)} Min.`;
  if (d < 86400000) return `vor ${Math.floor(d / 3600000)} Std.`;
  return `vor ${Math.floor(d / 86400000)} T.`;
}

// ---------- Zähler (im gemeinsamen Zustand, damit die Einstiege mitzeichnen) ----------
export const EMPTY_BADGE: MatchBadge = { has: false, likes: 0, views: 0, matches: 0 };
export const setBadge = (b?: MatchBadge | null) => { if (b) setState(() => ({ match: b })); };
/** Zahl am Einstieg: neue Likes + neue Matches */
export const matchNew = (b?: MatchBadge | null) => (b ? (b.likes || 0) + (b.matches || 0) : 0);

// ---------- Feier nach einem Match (überall in der App, components/MatchBits → <MatchParty />) ----------
let party: MatchResult | null = null;
const subs = new Set<() => void>();
export function showParty(m: MatchResult | null) {
  if (m) {
    putUsers([m.user, ...(m.dm?.members || [])]);
    // das neue Gespräch gleich in die Liste (falls die Live-Meldung „dm“ noch unterwegs ist)
    if (m.dm && !getState().dms.some((d) => d.id === m.dm.id)) setState((s) => ({ dms: [m.dm, ...s.dms] }));
  }
  party = m; subs.forEach((f) => f());
}
export function useParty() { return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => party, () => party); }

// ---------- Schnittstelle ----------
export const loadSelf = async () => { const d = await api<MatchSelf>('GET', '/api/match/me'); setBadge(d.badge); return d; };
export const saveProfile = async (p: Omit<MatchProfile, 'tz' | 'created'>) => { const d = await api<MatchSelf>('PUT', '/api/match/me', { ...p, tz: -new Date().getTimezoneOffset() }); setBadge(d.badge); return d; };
export const setVisible = async (on: boolean) => api<MatchSelf>('POST', '/api/match/visible', { on });
export const deleteProfile = async () => { await api('DELETE', '/api/match/me'); setBadge(EMPTY_BADGE); };
export const loadDeck = (f: { game?: string; platform?: string }, skip: string[] = []) => {
  const q = [f.game ? 'game=' + encodeURIComponent(f.game) : '', f.platform ? 'platform=' + f.platform : '', skip.length ? 'skip=' + skip.join(',') : ''].filter(Boolean).join('&');
  return api<{ cards: MatchCard[]; more: boolean; total: number; filtered: boolean }>('GET', '/api/match/deck' + (q ? '?' + q : ''));
};
export const viewCard = (pid: string) => api('POST', '/api/match/view', { pid }).catch(() => {});
export const likeCard = (pid: string) => api<{ ok?: boolean; left?: number; match?: MatchResult }>('POST', '/api/match/like', { pid });
export const passCard = (pid: string) => api('POST', '/api/match/pass', { pid });
export const undoPass = () => api<{ card: MatchCard }>('POST', '/api/match/undo', {});
export const loadLikes = () => api<{ likes: MatchCard[]; views: MatchCard[] }>('GET', '/api/match/likes');
export const loadMatches = () => api<{ matches: MatchPair[] }>('GET', '/api/match/matches');
export const unmatch = (uid: string) => api('POST', '/api/match/unmatch', { user_id: uid });
export const boost = () => api<MatchSelf>('POST', '/api/match/boost', {});
export const reportCard = (pid: string, reason: string, details = '') => api('POST', '/api/match/report', { pid, reason, details });
export const blockCard = (pid: string) => api('POST', '/api/match/block', { pid });
export const unblockAll = () => api<MatchSelf>('POST', '/api/match/unblock-all', {});
