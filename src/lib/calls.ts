// Anrufe und Sprachräume in der App selbst (voicecore.ts) – Starten, Annehmen, Klingeln, Anruf-Bildschirm.
// 3D-Räume und Spiele bleiben in der Web-Ansicht (dort laufen Figuren/Positionen über dieselbe Verbindung).
// Ersatzweg: In den Einstellungen lassen sich Anrufe wieder über die Web-Ansicht führen (wie bisher).
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { voice } from './voice';
import type { CallMeta, VoiceState } from './voicecore';
import { onLive, send as liveSend } from './live';
import { hasCallKit, reportIncoming, endCallKit, callKitState, startCallKit } from './callkit';
import { api } from './api';
import { bootstrap, channelInfo, dmTitle, getState, userOf } from './store';
import { getHost, leaveCall as leaveWebCall, setIgnoreWebRing, subscribeHost } from './webhost';
import { t } from './i18n';

export { voice };
// Entwicklungs-Vorschau im Browser: für automatische Tests von außen erreichbar
if (__DEV__ && Platform.OS === 'web') (globalThis as any).__asooCalls = { voice, getCalls: () => ex };
export type Ring = { dm: string; from: string; name: string; avatar?: string | null; title: string };
type Extra = { webCalls: boolean; ring: Ring | null; screenOpen: boolean; pendingAnswer: string | null };

let ex: Extra = { webCalls: false, ring: null, screenOpen: false, pendingAnswer: null };
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
  return { kind: 'call', title: dm ? dmTitle(dm, s.me?.id) : t("Anruf"), path: `/channels/@me/${room}`, sid: null };
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
/** Abweisen: Der Anrufer bekommt Bescheid, die eigenen anderen Geräte hören auf zu klingeln (Server: vdecline). */
export function declineRing(dm?: string) { const d = dm || ex.ring?.dm; stopRing(); if (d) liveSend({ t: 'vdecline', dm: d }); }
function onRing(m: any, retried = false) {
  if (!nativeCalls()) return;
  const s = getState();
  if (voice.get().room === m.dm || s.me?.status_raw === 'dnd') return;
  const dm = s.dms.find((d) => d.id === m.dm);
  // Gespräch noch nicht bekannt (neu): einmal nachladen
  if (!dm) { if (!retried) bootstrap().then(() => onRing(m, true)).catch(() => {}); return; }
  const u = userOf(m.from);
  // iPhone mit Apples Anruf-Bildschirm: dort klingeln lassen (gleiche Kennung wie der Anruf-Push → nur ein Anruf)
  if (hasCallKit && m.id && reportIncoming(m.id, dm.id, m.from, u.display || dmTitle(dm, s.me?.id))) return;
  clearTimeout(ringTimer);
  set({ ring: { dm: dm.id, from: m.from, name: u.display, avatar: u.avatar || null, title: dmTitle(dm, s.me?.id) } });
  ringTimer = setTimeout(stopRing, 60000);
}
/**
 * App wurde über eine Anruf-Mitteilung geöffnet: Läuft der Anruf noch (jemand anderes ist im Gespräch), klingelt es in
 * der App weiter (Fenster „ruft dich an“). answer = in der Mitteilung schon „Annehmen“ gedrückt → gleich beitreten.
 */
export async function ringFromPush(dm: string, answer = false) {
  if (!dm || voice.get().room === dm) return;
  let s = getState();
  if (!s.dms.some((d) => d.id === dm)) { try { await bootstrap(); } catch {} s = getState(); }
  const me = s.me?.id;
  const others = (s.voice?.[dm] || []).filter((m) => m.uid !== me);
  if (answer) { joinCall(dm); return; }
  if (others.length) onRing({ dm, from: others[0].uid });
}
onLive((m: any) => {
  if (m.t === 'ring') onRing(m);
  else if (m.t === 'ringstop') {
    if (ex.ring?.dm === m.dm) stopRing();
    const ck = callKitState(m.dm);
    if (ck && !ck.answered) endCallKit(m.dm, m.why === 'answered' ? 'elsewhere' : m.why === 'declined' ? 'declined' : 'remote');
  } else if (m.t === 'declined') {
    // Die angerufene Person hat abgewiesen: allein im Anruf → auflegen
    const st = voice.get(), me = getState().me?.id;
    if (st.room === m.dm && !(getState().voice?.[m.dm] || []).some((x) => x.uid !== me)) voice.leave();
  } else if (m.t === 'voice') {
    const me = getState().me?.id;
    const gone = !m.members?.length, mine = m.members?.some((x: any) => x.uid === me);
    // aufgelegt, bevor man annahm – oder auf einem anderen eigenen Gerät angenommen
    if (ex.ring && m.room === ex.ring.dm && (gone || mine)) stopRing();
    const ck = callKitState(m.room);
    if (ck && !ck.answered && (gone || (mine && voice.get().room !== m.room))) endCallKit(m.room, gone ? 'remote' : 'elsewhere');
  }
});
// Anruf in der App beendet (aufgelegt oder die anderen sind weg) → auch Apples Anruf-Anzeige beenden
let lastRoom: string | null = null;
voice.subscribe(() => {
  const r = voice.get().room;
  if (lastRoom && r !== lastRoom && callKitState(lastRoom)?.answered) endCallKit(lastRoom, 'remote');
  lastRoom = r;
});

// ---------- Apples Anruf-Bildschirm (iPhone) ----------
let voipTok = '', voipSent = '';
/** Anruf-Schlüssel des Geräts beim Server melden (zusammen mit dem Mitteilungs-Schlüssel, damit keine zweite Mitteilung kommt). */
export async function registerVoip(expo?: string | null) {
  if (!voipTok || !getState().me) return;
  const key = voipTok + '|' + (expo || '');
  if (key === voipSent) return;
  try { await api('POST', '/api/push/voip', { token: voipTok, expo: expo || null, sandbox: __DEV__ }); voipSent = key; } catch {}
}
let ckStarted = false;
/** Einmal nach dem Anmelden: Ereignisse vom Anruf-Bildschirm verarbeiten. */
export function initCallKit(expo: () => string | null) {
  if (!hasCallKit || ckStarted) return;
  ckStarted = true;
  import('./ringtone').then((r) => r.applyRingtone()).catch(() => {});
  startCallKit({
    token(tok) { voipTok = tok; voipSent = ''; registerVoip(expo()); },
    incoming(dm) {
      // Von einem Anruf-Push geweckt: sobald die Verbindung steht prüfen, ob der Anruf noch läuft
      const check = async () => {
        const ck = callKitState(dm);
        if (!ck || ck.answered) return;
        if (!getState().dms.some((d) => d.id === dm)) { try { await bootstrap(); } catch { return; } }
        const me = getState().me?.id;
        const others = (getState().voice?.[dm] || []).filter((m) => m.uid !== me);
        if (getState().me && !others.length) endCallKit(dm, 'remote');
      };
      setTimeout(check, 7000);
      setTimeout(check, 16000);
    },
    answer(dm) { set({ pendingAnswer: dm }); },
    end(dm, answered) {
      if (answered) { if (voice.get().room === dm) voice.leave(); }
      else declineRing(dm);
    },
    mute(muted) { const st = voice.get(); if (st.room && st.muted !== muted) voice.toggleMute(); },
  });
}
// Anruf (Direktnachricht/Gruppe) endet von selbst, wenn man eine Minute allein darin ist – niemand hat abgenommen
// oder die anderen sind gegangen. Sprachräume auf Servern bleiben offen (wie im Web).
let aloneSince = 0;
setInterval(() => {
  const st = voice.get(), s = getState();
  if (!st.room || !s.dms.some((d) => d.id === st.room)) { aloneSince = 0; return; }
  const others = (s.voice?.[st.room] || []).filter((m) => m.uid !== s.me?.id);
  if (others.length) { aloneSince = 0; return; }
  if (!aloneSince) { aloneSince = Date.now(); return; }
  if (Date.now() - aloneSince > 60000) { aloneSince = 0; voice.leave(); }
}, 5000);
/** _layout.tsx: angenommenen Anruf ausführen, sobald Anmeldung, Daten und Navigation stehen. */
export function takePendingAnswer() { const d = ex.pendingAnswer; if (d) { set({ pendingAnswer: null }); joinCall(d); } }
/** Beim Abmelden: Dieses iPhone bekommt keine Anrufe mehr für das Konto. */
export async function unregisterVoip() {
  if (!voipTok) return;
  voipSent = '';
  try { await api('POST', '/api/push/voip/remove', { token: voipTok }); } catch {}
}
