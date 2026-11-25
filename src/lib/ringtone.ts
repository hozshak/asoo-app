// Klingelton für eingehende Anrufe in der offenen App (assets/sounds/ring.wav, eigener Ton, 26 s, läuft in Schleife).
// Derselbe Ton klingelt auch in der Anruf-Mitteilung, wenn die App zu ist (Server: pushApps → sound "ring.wav").
// Der Stumm-Schalter des iPhones gilt: ist er an, nur Vibration (wie bei WhatsApp).
import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;
let want = false;

export async function startRingtone() {
  if (Platform.OS === 'web' || player) return;
  want = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: false });
    if (!want || player) return; // inzwischen angenommen oder abgelehnt
    const p = createAudioPlayer(require('../../assets/sounds/ring.wav'));
    p.loop = true;
    p.volume = 1;
    player = p;
    p.play();
  } catch { player = null; }
}

export function stopRingtone() {
  want = false;
  const p = player;
  player = null;
  if (!p) return;
  try { p.pause(); } catch {}
  try { p.remove(); } catch {}
}
