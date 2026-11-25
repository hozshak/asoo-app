// Bild groß ansehen (Chat-Bilder, GIFs) mit Knöpfen oben: Speichern und Schließen.
// Speichern lädt das Bild herunter und öffnet das Teilen-Menü von iOS – dort „Bild sichern“ legt es in die Fotos-App
// (dafür braucht die App keine Foto-Berechtigung). Im Browser (Vorschau) öffnet es das Bild in einem neuen Fenster.
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { mediaSource } from '@/lib/api';
import { Icon } from './Icon';

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic', 'video/mp4': 'mp4' };
const sourceOf = (src: string) => (src.startsWith('http') || src.startsWith('/') ? { uri: src } : (mediaSource(src) as any)) as { uri: string; headers?: Record<string, string> };

/** Bild aufs Gerät: herunterladen, dann Teilen-Menü (mit „Bild sichern“). */
export async function saveImageToDevice(src: string) {
  const s = sourceOf(src);
  if (Platform.OS === 'web') { window.open(s.uri, '_blank'); return; }
  const FS = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const guess = (s.uri.split('?')[0].match(/\.(jpe?g|png|webp|gif|heic)$/i) || [])[1]?.toLowerCase().replace('jpeg', 'jpg') || 'jpg';
  const base = FS.cacheDirectory! + 'tolobby-' + Date.now();
  const r = await FS.downloadAsync(s.uri, base + '.' + guess, { headers: s.headers || {} });
  if (r.status !== 200) throw new Error('download ' + r.status);
  // Endung passend zum echten Bildtyp, sonst erkennt iOS es nicht als Bild
  const type = String((r.headers as any)['Content-Type'] || (r.headers as any)['content-type'] || '').split(';')[0].trim();
  let uri = r.uri;
  const ext = EXT[type];
  if (ext && ext !== guess) { const to = base + '.' + ext; await FS.moveAsync({ from: r.uri, to }); uri = to; }
  await Sharing.shareAsync(uri, { mimeType: type || 'image/jpeg', UTI: type === 'image/gif' ? 'com.compuserve.gif' : 'public.image', dialogTitle: 'Bild speichern' });
}

export function ImageViewer({ src, onClose }: { src: string | null; onClose: () => void }) {
  const ins = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!src || busy) return;
    Haptics.selectionAsync().catch(() => {});
    setBusy(true);
    try { await saveImageToDevice(src); } catch { Alert.alert('Bild speichern', 'Das Bild konnte nicht geladen werden.'); }
    setBusy(false);
  };
  return (
    <Modal visible={!!src} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.back} onPress={onClose} accessibilityLabel="Schließen">
        {src ? <Image source={sourceOf(src)} style={{ width: '100%', height: '80%' }} contentFit="contain" /> : null}
      </Pressable>
      <View style={[s.bar, { top: ins.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Bild speichern" onPress={save} hitSlop={6} style={({ pressed }) => [s.btn, pressed && { opacity: 0.7 }]}>
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="download" size={20} color="#fff" />}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Schließen" onPress={onClose} hitSlop={6} style={({ pressed }) => [s.btn, pressed && { opacity: 0.7 }]}>
          <Icon name="x" size={20} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', right: 14, flexDirection: 'row', gap: 10 },
  btn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
});
