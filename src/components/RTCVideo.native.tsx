// Kamera- oder Bildschirm-Bild aus einem Anruf (iPhone: RTCView von react-native-webrtc).
import type { StyleProp, ViewStyle } from 'react-native';
import { RTCView } from 'react-native-webrtc';

export function RTCVideo({ stream, mirror = false, fit = 'cover', style }: { stream: any; mirror?: boolean; fit?: 'cover' | 'contain'; style?: StyleProp<ViewStyle> }) {
  if (!stream) return null;
  return <RTCView streamURL={stream.toURL()} objectFit={fit} mirror={mirror} zOrder={0} style={style as any} />;
}
