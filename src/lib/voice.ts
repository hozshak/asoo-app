// Browser (Entwicklungs-Vorschau am PC): derselbe Sprach-Kern wie am iPhone, nur mit dem WebRTC des Browsers.
// So lassen sich echte Anrufe zwischen „App“ und Web-App hier automatisch testen.
import { createVoice } from './voicecore';

const audios = new Map<string, HTMLAudioElement>();
const g: any = globalThis as any;

export const voice = createVoice({
  RTCPeerConnection: g.RTCPeerConnection,
  getUserMedia: (c) => g.navigator.mediaDevices.getUserMedia(c),
  playAudio(cid, stream) {
    let a = audios.get(cid);
    if (!a) { a = new g.Audio() as HTMLAudioElement; a.autoplay = true; audios.set(cid, a); }
    a.srcObject = stream;
    a.play().catch(() => {});
  },
  stopAudio(cid) { const a = audios.get(cid); if (a) { a.srcObject = null; audios.delete(cid); } },
});
