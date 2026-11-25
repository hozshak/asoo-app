// Kamera- oder Bildschirm-Bild aus einem Anruf (iPhone: RTCView von react-native-webrtc).
import type { StyleProp, ViewStyle } from 'react-native';
import { RTCView } from 'react-native-webrtc';

export function RTCVideo({ stream, mirror = false, fit = 'cover', style }: { stream: any; mirror?: boolean; fit?: 'cover' | 'contain'; style?: StyleProp<ViewStyle> }) {
  if (!stream) return null;
  // Kommt die Videospur erst später in denselben Stream (oder wird ersetzt), zeigt RTCView sonst weiter nichts an
  const track = stream.getVideoTracks?.()[0];
  return <RTCView key={stream.id + ':' + (track?.id || 'none')} streamURL={stream.toURL()} objectFit={fit} mirror={mirror} zOrder={0} style={style as any} />;
}
