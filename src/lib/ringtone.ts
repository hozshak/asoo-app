// Klingeltöne (eigene Töne aus zuno-app/tools/make-ringtone.mjs, assets/sounds/ring-<name>.wav, je ca. 28 s).
// Welcher klingelt, steht beim Konto (Einstellungen → Sprache & Anrufe, gilt auch für Web/Windows). Apples
// Anruf-Bildschirm bekommt ihn über applyRingtone; die Mitteilung bei geschlossener App nennt der Server (sound).
// Der Stumm-Schalter des iPhones gilt: ist er an, nur Vibration (wie bei WhatsApp).
import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { setCallKitRingtone } from './callkit';
import { getState } from './store';

export const RINGTONES: [string, string][] = [['marimba', 'Marimba'], ['glocken', 'Glocken'], ['harfe', 'Harfe'], ['klassik', 'Klassisch'], ['puls', 'Puls']];
const FILES: Record<string, number> = {
  marimba: require('../../assets/sounds/ring-marimba.wav'),
  glocken: require('../../assets/sounds/ring-glocken.wav'),
  harfe: require('../../assets/sounds/ring-harfe.wav'),
  klassik: require('../../assets/sounds/ring-klassik.wav'),
  puls: require('../../assets/sounds/ring-puls.wav'),
};
const current = () => { const r = (getState().me as any)?.ringtone; return FILES[r] ? r : 'marimba'; };

let player: AudioPlayer | null = null;
let want = false;
let previewTimer: any = null;

async function play(name: string, loop: boolean, silentToo: boolean) {
  stopRingtone();
  want = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: silentToo });
    if (!want || player) return; // inzwischen angenommen oder abgelehnt
    const p = createAudioPlayer(FILES[name] || FILES.marimba);
    p.loop = loop;
    p.volume = 1;
    player = p;
    p.play();
  } catch { player = null; }
}
export async function startRingtone() {
  if (Platform.OS === 'web' || player) return;
  await play(current(), true, false);
}
/** Einstellungen: Ton etwa 4 Sekunden anspielen (auch bei Stumm-Schalter, man will ihn ja hören) */
export function previewRingtone(name: string) {
  if (Platform.OS === 'web') return;
  clearTimeout(previewTimer);
  play(name, false, true);
  previewTimer = setTimeout(stopRingtone, 4500);
}
export function stopRingtone() {
  want = false;
  clearTimeout(previewTimer);
  const p = player;
  player = null;
  if (!p) return;
  try { p.pause(); } catch {}
  try { p.remove(); } catch {}
}
/** Gewählten Ton auch für Apples Anruf-Bildschirm setzen (beim Start und nach dem Ändern) */
export function applyRingtone(name = current()) { setCallKitRingtone(FILES[name] ? name : 'marimba'); }
