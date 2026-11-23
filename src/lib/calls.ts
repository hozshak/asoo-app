// Anrufe und Sprachräume in der App selbst (voicecore.ts) – Starten, Annehmen, Klingeln, Anruf-Bildschirm.
// 3D-Räume und Spiele bleiben in der Web-Ansicht (dort laufen Figuren/Positionen über dieselbe Verbindung).
// Ersatzweg: In den Einstellungen lassen sich Anrufe wieder über die Web-Ansicht führen (wie bisher).
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { voice } from './voice';
import type { CallMeta, VoiceState } from './voicecore';
import { onLive } from './live';
import { bootstrap, channelInfo, dmTitle, getState, userOf } from './store';
import { getHost, leaveCall as leaveWebCall, setIgnoreWebRing, subscribeHost } from './webhost';

export { voice };
// Entwicklungs-Vorschau im Browser: für automatische Tests von außen erreichbar
if (__DEV__ && Platform.OS === 'web') (globalThis as any).__asooCalls = { voice, getCalls: () => ex };
export type Ring = { dm: string; from: string; name: string; avatar?: string | null; title: string };
type Extra = { webCalls: boolean; ring: Ring | null; screenOpen: boolean };

let ex: Extra = { webCalls: false, ring: null, screenOpen: false };
const subs = new Set<() => void>();
const set = (p: Partial<Extra>) => { ex = { ...ex, ...p }; subs.forEach((f) => f()); };
const sub = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
export const getCalls = () => ex;
export function useCalls<T>(sel: (s: Extra) => T): T { return useSyncExternalStore(sub, () => sel(ex), () => sel(ex)); }
/** Zustand des Anrufs (nur einfache Werte oder unveränderte Listen auswählen). */
export function useVoice<T>(sel: (s: VoiceState) => T): T { return useSyncExternalStore(voice.subscribe, () => sel(voice.get()), () => sel(voice.get())); }

// ---------- Ersatzweg (Einstellung) ----------
const KEY = 'asoo.webcalls';
export const nativeCalls = () => !ex.webCalls;
export async function loadCallMode() {
  try {
    const v = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    set({ webCalls: v === '1' });
  } catch {}
  setIgnoreWebRing(nativeCalls());
}
export async function setWebCalls(on: boolean) {
  if (on && voice.get().room) voice.leave(true);
  set({ webCalls: on });
  setIgnoreWebRing(!on);
  try {
    if (Platform.OS === 'web') { if (on) globalThis.localStorage?.setItem(KEY, '1'); else globalThis.localStorage?.removeItem(KEY); }
    else if (on) await SecureStore.setItemAsync(KEY, '1'); else await SecureStore.deleteItemAsync(KEY);
  } catch {}
}
setIgnoreWebRing(true);

// ---------- Beitreten / Verlassen ----------
function metaFor(room: string): CallMeta {
  const info = channelInfo(room);
  if (info) return { kind: 'voice', title: info.channel.name, path: `/channels/${info.server.id}/${room}`, sid: info.server.id };
  const s = getState(), dm = s.dms.find((d) => d.id === room);
  return { kind: 'call', title: dm ? dmTitle(dm, s.me?.id) : 'Anruf', path: `/channels/@me/${room}`, sid: null };
}
/** Anruf (Direktnachricht/Gruppe) oder Sprachraum betreten und den Anruf-Bildschirm zeigen. */
export async function joinCall(room: string, opts: { video?: boolean; open?: boolean } = {}) {
  if (ex.ring?.dm === room) stopRing();
  if (voice.get().room === room) { if (opts.open !== false) openCallScreen(); return; }
  // läuft noch etwas in der Web-Ansicht (z. B. ein 3D-Raum)? Dort zuerst raus – sonst wirft der Server eines hinaus
  if (getHost().voice) leaveWebCall();
  if (opts.open !== false) openCallScreen();
  await voice.join(room, metaFor(room), { video: opts.video });
}
export function leaveCall() { voice.leave(); }
export function openCallScreen() { if (!ex.screenOpen) router.push('/call'); }
export const setCallScreenOpen = (on: boolean) => { if (ex.screenOpen !== on) set({ screenOpen: on }); };
/** Kanal-Typen, die die App selbst kann (Text sowieso) – 3D-Räume und Spiele laufen in der Web-Ansicht. */
export const nativeRoom = (type: string) => type === 'voice' && nativeCalls();
/** Vor dem Öffnen eines 3D-Raums/Spiels in der Web-Ansicht: den Anruf in der App beenden. */
export function leaveForWeb() { if (voice.get().room) voice.leave(true); }

// Tritt die Web-Ansicht selbst einem Raum bei (z. B. 3D-Raum), endet der Anruf in der App
let lastWebRoom: string | null = null;
subscribeHost(() => {
  const r = getHost().voice?.room || null;
  if (r && r !== lastWebRoom && voice.get().room) voice.leave(true);
  lastWebRoom = r;
});

// ---------- Klingeln ----------
let ringTimer: any = null;
function stopRing() { clearTimeout(ringTimer); if (ex.ring) set({ ring: null }); }
export function answerRing() { const r = ex.ring; if (!r) return; stopRing(); joinCall(r.dm); }
export function declineRing() { stopRing(); }
function onRing(m: any, retried = false) {
  if (!nativeCalls()) return;
  const s = getState();
  if (voice.get().room === m.dm || s.me?.status_raw === 'dnd') return;
  const dm = s.dms.find((d) => d.id === m.dm);
  // Gespräch noch nicht bekannt (neu): einmal nachladen
  if (!dm) { if (!retried) bootstrap().then(() => onRing(m, true)).catch(() => {}); return; }
  const u = userOf(m.from);
  clearTimeout(ringTimer);
  set({ ring: { dm: dm.id, from: m.from, name: u.display, avatar: u.avatar || null, title: dmTitle(dm, s.me?.id) } });
  ringTimer = setTimeout(stopRing, 60000);
}
onLive((m: any) => {
  if (m.t === 'ring') onRing(m);
  else if (m.t === 'voice' && ex.ring && m.room === ex.ring.dm) {
    // aufgelegt, bevor man annahm – oder auf einem anderen eigenen Gerät angenommen
    const me = getState().me?.id;
    if (!m.members?.length || m.members.some((x: any) => x.uid === me)) stopRing();
  }
});
