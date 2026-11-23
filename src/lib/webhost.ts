// EIN dauerhaftes Web-Fenster für alles, was aus der Web-App kommt (3D- und Sprachräume, Anrufe, Feed, Einstellungen …).
// Es bleibt geladen, auch wenn man es schließt: Ein Anruf läuft weiter (oben erscheint die Anruf-Leiste), und die
// nächste Web-Seite öffnet sofort, ohne Neuladen. Gegenstück in der Web-App: embedBridge() in public/js/app.js.
import { useSyncExternalStore } from 'react';
import { isSharing, stopScreenShare } from './screenshare';

export type VoiceInfo = { room: string; title: string; path: string; kind: string; video: boolean };
export type RingInfo = { dm: string; from: string; name: string; title: string; avatar?: string | null };
type S = { started: boolean; path: string; visible: boolean; busy: boolean; loaded: boolean; voice: VoiceInfo | null; ring: RingInfo | null; muted: boolean; deaf: boolean };

let st: S = { started: false, path: '/channels/@me', visible: false, busy: false, loaded: false, voice: null, ring: null, muted: false, deaf: false };
const subs = new Set<() => void>();
const set = (p: Partial<S>) => { st = { ...st, ...p }; subs.forEach((f) => f()); };
export const getHost = () => st;
export function useHost<T>(sel: (s: S) => T): T {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => sel(st), () => sel(st));
}
export const subscribeHost = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
// Anrufe laufen in der App selbst (calls.ts): dann klingelt die App selbst, das Klingeln der Web-Ansicht zählt nicht
let ignoreRing = false;
export const setIgnoreWebRing = (on: boolean) => { ignoreRing = on; if (on && st.ring) set({ ring: null }); };

// Der WebView meldet sich hier an, damit wir Befehle hineinschicken können
let inject: ((js: string) => void) | null = null;
export function attachInject(fn: ((js: string) => void) | null) { inject = fn; }
const run = (js: string) => { if (inject && st.loaded) inject(`try{${js}}catch(e){};true;`); };

/** Stumm / Ton aus (Leiste unten, wie bei Discord). Gilt sofort im Anruf, sonst für den nächsten. false = Fenster noch nicht bereit. */
export function toggleVoice(what: 'mute' | 'deaf'): boolean {
  if (!inject || !st.loaded) return false;
  // sofort anzeigen, die Web-App bestätigt kurz danach
  if (what === 'mute') set({ muted: !st.muted, deaf: false }); else set({ deaf: !st.deaf });
  run(`window.__asooVoice(${JSON.stringify(what)})`);
  return true;
}
/** Seite der Web-App zeigen (z. B. '/feed', '/channels/<server>/<raum>'). */
export function showWeb(path: string) {
  if (!st.started) { set({ started: true, path, visible: true, busy: true }); return; }
  set({ path, visible: true, busy: true });
  run(`window.__asooGo(${JSON.stringify(path)})`);
}
/** Fenster schließen – ein laufender Anruf bleibt (Anruf-Leiste). */
export function hideWeb() {
  set({ visible: false, busy: false });
  run('window.__asooPark()');
}
/** Nach dem Anmelden im Hintergrund schon laden, damit die erste Web-Seite sofort da ist. */
export function prewarmWeb() { if (!st.started) set({ started: true, path: '/channels/@me', visible: false, busy: false }); }
export function resetWeb() { st = { started: false, path: '/channels/@me', visible: false, busy: false, loaded: false, voice: null, ring: null, muted: false, deaf: false }; subs.forEach((f) => f()); }

export const leaveCall = () => run('window.__asooLeave()');
export function answerCall(dm: string) { set({ ring: null }); run(`window.__asooAnswer(${JSON.stringify(dm)})`); showWeb(`/channels/@me/${dm}`); }
export function declineCall() { const r = st.ring; set({ ring: null }); if (r) run(`window.__asooDecline(${JSON.stringify(r.dm)})`); }

/** Nachrichten aus der Web-App. Rückgabe: was die App zusätzlich tun soll. */
export function onWebMessage(m: any): { open?: string; auth?: boolean; share?: boolean } {
  switch (m?.t) {
    case 'ready': {
      const first = !st.loaded;
      set({ loaded: true, busy: false });
      // vor dem ersten „ready“ gewünschte Seite nachholen (der Start lief noch mit der ersten Adresse)
      if (first && st.visible) run(`window.__asooGo(${JSON.stringify(st.path)})`);
      else if (first && !st.visible) run('window.__asooPark()');
      return {};
    }
    case 'close': hideWeb(); return {};
    case 'voice':
      // Sprachraum verlassen: auch das Bildschirm-Teilen beenden
      if (!m.room && isSharing()) stopScreenShare();
      else if (m.room && isSharing() && getHost().voice && getHost().voice!.room !== m.room) stopScreenShare();
      if (typeof m.muted === 'boolean') set({ muted: m.muted, deaf: !!m.deaf });
      set({ voice: m.room ? { room: m.room, title: m.title || '', path: m.path || '/channels/@me', kind: m.kind || 'call', video: !!m.video } : null }); return {};
    case 'ring': if (ignoreRing) return {}; set({ ring: { dm: m.dm, from: m.from, name: m.name, title: m.title, avatar: m.avatar } }); return {};
    case 'ringstop': if (st.ring?.dm === m.dm) set({ ring: null }); return {};
    case 'open': hideWeb(); return { open: typeof m.ch === 'string' ? m.ch : undefined };
    case 'auth': return { auth: true };
    case 'screenshare': return { share: true };
  }
  return {};
}
