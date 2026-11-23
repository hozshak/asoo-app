// Kamera- oder Bildschirm-Bild aus einem Anruf (Browser-Vorschau: <video>). Ton läuft getrennt (voice.ts), daher stumm.
import { useEffect, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export function RTCVideo({ stream, mirror = false, fit = 'cover', style }: { stream: any; mirror?: boolean; fit?: 'cover' | 'contain'; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null; }, [stream]);
  if (!stream) return null;
  return (
    <View style={style}>
      <video ref={ref} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: fit, transform: mirror ? 'scaleX(-1)' : undefined, background: '#000' }} />
    </View>
  );
}
