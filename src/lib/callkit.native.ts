// Eingehende Anrufe wie am Telefon (iPhone): Apples Anruf-Bildschirm über das eigene Modul modules/tolobby-call
// (CallKit + PushKit). Ohne das Modul (Browser-Vorschau, ältere App) bleibt alles beim Fenster in der App (CallBar).
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { RTCAudioSession } from 'react-native-webrtc';

type CallEvent =
  | { type: 'token'; token: string }
  | { type: 'incoming'; id: string; dm: string; from: string; name: string }
  | { type: 'answer'; id: string; dm: string }
  | { type: 'end'; id: string; dm: string; answered: boolean }
  | { type: 'mute'; id: string; muted: boolean }
  | { type: 'audio'; active: boolean }
  | { type: 'reset' };

type Native = {
  voipToken(): string;
  activeCalls(): { id: string; dm: string; from: string; name: string; answered: boolean }[];
  reportIncoming(id: string, dm: string, from: string, name: string, video: boolean): void;
  endCall(id: string, reason: string): void;
  endCallsFor(dm: string, reason: string): void;
  setRingtone?(file: string): void;
  addListener(name: 'onCall', fn: (e: CallEvent) => void): { remove(): void };
};

const N: Native | null = Platform.OS === 'ios' ? (requireOptionalNativeModule('TolobbyCall') as Native | null) : null;
/** Gibt es Apples Anruf-Bildschirm in dieser App-Fassung? */
export const hasCallKit = !!N;

/** dm → Kennung des Anrufs, der gerade klingelt oder läuft */
const byDm = new Map<string, { id: string; answered: boolean }>();

export function voipToken() { try { return N?.voipToken() || ''; } catch { return ''; } }

/** Anruf über die offene Verbindung: bei iOS melden (dieselbe Kennung wie im Anruf-Push → klingelt nur einmal). */
export function reportIncoming(id: string, dm: string, from: string, name: string) {
  if (!N || !id) return false;
  try { N.reportIncoming(id, dm, from, name, false); return true; } catch { return false; }
}
/** Klingeln/Anruf für dieses Gespräch beenden. reason: remote | elsewhere | declined | unanswered */
export function endCallKit(dm: string, reason = 'remote') {
  if (!N) return;
  byDm.delete(dm);
  try { N.endCallsFor(dm, reason); } catch {}
}
export const callKitState = (dm: string) => byDm.get(dm) || null;
/** Klingelton von Apples Anruf-Bildschirm (Datei im App-Paket: ring_<name>.wav) */
export function setCallKitRingtone(name: string) { try { N?.setRingtone?.('ring_' + name + '.wav'); } catch {} }

export type CallKitHandlers = {
  token(token: string): void;
  incoming(dm: string, from: string, name: string): void;
  answer(dm: string): void;
  /** answered=false: abgelehnt, bevor man abgenommen hat */
  end(dm: string, answered: boolean): void;
  mute(muted: boolean): void;
};

/** Ereignisse vom Anruf-Bildschirm abonnieren (einmal beim Start). Holt auch Ereignisse nach, die vor dem Start kamen. */
export function startCallKit(h: CallKitHandlers) {
  if (!N) return () => {};
  const sub = N.addListener('onCall', (e) => {
    switch (e.type) {
      case 'token': h.token(e.token); break;
      case 'incoming': byDm.set(e.dm, { id: e.id, answered: false }); h.incoming(e.dm, e.from, e.name); break;
      case 'answer': byDm.set(e.dm, { id: e.id, answered: true }); h.answer(e.dm); break;
      case 'end': byDm.delete(e.dm); h.end(e.dm, e.answered); break;
      case 'mute': h.mute(e.muted); break;
      case 'audio':
        try { if (e.active) RTCAudioSession.audioSessionDidActivate(); else RTCAudioSession.audioSessionDidDeactivate(); } catch {}
        break;
      case 'reset': byDm.clear(); break;
    }
  });
  // Anrufe, die schon liefen, bevor JavaScript bereit war
  try { for (const c of N.activeCalls()) byDm.set(c.dm, { id: c.id, answered: !!c.answered }); } catch {}
  const tok = voipToken();
  if (tok) h.token(tok);
  return () => sub.remove();
}
