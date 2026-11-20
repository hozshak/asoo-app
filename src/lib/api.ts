// Verbindung zum Asoo-Server. Die App meldet sich mit einem Schlüssel an (Kopfzeile „Authorization: Bearer …“),
// nicht mit einem Cookie wie der Browser; der Server erkennt sie an „X-Client: asoo-app“ (zuno-app/src/worker.js, sessionReply).
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** Server-Adresse. Im Browser beim Entwickeln: dieselbe Adresse wie die App (scripts/dev-proxy.mjs leitet /api weiter). */
export const BASE = process.env.EXPO_PUBLIC_API ?? (Platform.OS === 'web' && __DEV__ ? '' : 'https://zuno-app.altraex.workers.dev');
export const WS_BASE = BASE ? BASE.replace(/^http/, 'ws') : (typeof location !== 'undefined' ? location.origin.replace(/^http/, 'ws') : '');

const KEY = 'asoo.token';
let token: string | null = null;

export async function loadToken() {
  try {
    token = Platform.OS === 'web' ? localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  } catch { token = null; }
  return token;
}
export async function saveToken(t: string | null) {
  token = t;
  try {
    if (Platform.OS === 'web') { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); }
    else if (t) await SecureStore.setItemAsync(KEY, t);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {}
  // Im Browser beim Entwickeln: private Bilder (<img> kann keine Kopfzeilen schicken) – der Entwicklungs-Proxy ergänzt sie
  if (Platform.OS === 'web' && __DEV__) document.cookie = t ? `dev_media_token=${t}; path=/` : 'dev_media_token=; path=/; max-age=0';
}
export const getToken = () => token;

export class ApiError extends Error {
  code: string; status: number; data: any;
  constructor(status: number, code: string, data: any) { super(code); this.status = status; this.code = code; this.data = data; }
}

export function headers(extra: Record<string, string> = {}) {
  return { 'x-zuno': '1', 'x-client': 'asoo-app', ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra };
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, { method, headers: headers(body !== undefined ? { 'content-type': 'application/json' } : {}), body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch { throw new ApiError(0, 'offline', null); }
  let data: any = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new ApiError(res.status, data?.error || 'server_error', data);
  return data as T;
}

/** Bild hochladen (kind: attachment | avatar | banner | icon). uri: lokale Datei aus der Bildauswahl. */
export async function upload(kind: string, uri: string, mime = 'image/jpeg'): Promise<{ key: string; url: string; type: string; size: number }> {
  const blob = await (await fetch(uri)).blob();
  const res = await fetch(`${BASE}/api/upload?kind=${encodeURIComponent(kind)}`, { method: 'POST', headers: headers({ 'content-type': blob.type || mime }), body: blob });
  let data: any = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new ApiError(res.status, data?.error || 'server_error', data);
  return data;
}

/** Adresse eines Bildes vom Server; private Bilder (Anhänge) brauchen die Anmeldung als Kopfzeile. */
export const mediaUrl = (key?: string | null) => (key ? `${BASE}/media/${key}` : null);
export const mediaSource = (key?: string | null) => {
  const uri = mediaUrl(key);
  if (!uri) return null;
  return key!.startsWith('attachment/') && token && Platform.OS !== 'web' ? { uri, headers: { authorization: `Bearer ${token}` } } : { uri };
};

const MSG: Record<string, string> = {
  offline: 'Keine Verbindung zum Server. Bist du online?',
  bad_login: 'Benutzername oder Passwort stimmt nicht.',
  username_taken: 'Dieser Benutzername ist schon vergeben.',
  bad_username: 'Benutzername: 3–20 Zeichen, nur a–z, 0–9, Punkt und Unterstrich.',
  weak_password: 'Das Passwort braucht mindestens 8 Zeichen.',
  bad_email: 'Das sieht nicht nach einer E-Mail-Adresse aus.',
  email_taken: 'Diese E-Mail gehört schon zu einem anderen Konto.',
  bad_code: 'Der Code stimmt nicht oder ist abgelaufen.',
  mail_off: 'E-Mails sind gerade nicht eingerichtet.',
  mail_failed: 'Die E-Mail konnte nicht verschickt werden. Bitte versuch es gleich noch einmal.',
  age_required: 'Asoo ist ab 16 Jahren.',
  terms_required: 'Bitte stimme den Regeln und der Datenschutzerklärung zu.',
  rate_limited: 'Zu viele Versuche. Warte kurz und versuch es nochmal.',
  not_friends: 'Ihr müsst erst befreundet sein, um euch zu schreiben.',
  blocked: 'Das geht nicht – einer von euch hat den anderen blockiert.',
  timed_out: 'Du bist auf diesem Server gerade stummgeschaltet (Timeout).',
  slowmode: 'Langsamer Modus: bitte kurz warten.',
  too_large: 'Die Datei ist zu groß.',
  bad_type: 'Nur Bilder (PNG, JPG, WEBP, GIF) sind erlaubt.',
  quota: 'Dein Speicherplatz ist voll.',
  bad_password: 'Das Passwort ist falsch.',
  user_not_found: 'Nutzer nicht gefunden.',
  forbidden: 'Dafür fehlen dir die Rechte.',
  not_found: 'Nicht gefunden.',
  banned: 'Dein Konto ist gesperrt.',
  empty: 'Bitte schreib etwas.',
};
export const errText = (e: unknown) => (e instanceof ApiError ? MSG[e.code] || 'Da ist etwas schiefgelaufen. Bitte versuch es nochmal.' : 'Da ist etwas schiefgelaufen. Bitte versuch es nochmal.');
