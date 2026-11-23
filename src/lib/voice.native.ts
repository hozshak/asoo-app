// iPhone: Sprach-Kern (voicecore.ts) mit der iPhone-Technik – WebRTC von react-native-webrtc, Gesprächs-Ton über
// InCallManager (Audio-Sitzung wie bei einem Telefonat, Lautsprecher/Hörmuschel, Bildschirm bleibt an).
// Den Ton der anderen spielt react-native-webrtc selbst ab, sobald ihre Spur ankommt.
import { mediaDevices, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import * as Haptics from 'expo-haptics';
import { createVoice } from './voicecore';
import { prepScreen, tuneScreen } from './screenshare';

export const voice = createVoice({
  RTCPeerConnection, RTCSessionDescription, RTCIceCandidate,
  getUserMedia: (c) => mediaDevices.getUserMedia(c),
  prepScreen, tuneScreen,
  startSession(speaker, video) {
    try {
      InCallManager.start({ media: video ? 'video' : 'audio', auto: true });
      InCallManager.setForceSpeakerphoneOn(speaker);
      InCallManager.setKeepScreenOn(true);
    } catch {}
  },
  stopSession() { try { InCallManager.setKeepScreenOn(false); InCallManager.stop(); } catch {} },
  setSpeaker(on) { try { InCallManager.setForceSpeakerphoneOn(on); } catch {} },
  // Kurze Rückmeldung zum Fühlen statt Töne (eigene Töne bräuchten Tondateien im App-Paket)
  tone(kind) {
    if (kind === 'join') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else if (kind === 'leave') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    else Haptics.selectionAsync().catch(() => {});
  },
});
