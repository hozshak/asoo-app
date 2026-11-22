// Anruf-Leiste: Ist man in einem Anruf, Sprach- oder 3D-Raum und hat das Fenster geschlossen, steht oben eine Leiste –
// antippen führt zurück, rechts legt man auf. Dazu das Fenster für eingehende Anrufe (Annehmen / Ablehnen).
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { answerCall, declineCall, leaveCall, showWeb, useHost } from '@/lib/webhost';
import { userOf } from '@/lib/store';
import { Avatar, Glass, T } from './ui';
import { Icon } from './Icon';
import { C } from '@/lib/theme';

export function CallBar() {
  const voice = useHost((s) => s.voice);
  const visible = useHost((s) => s.visible);
  const ins = useSafeAreaInsets();
  const pulse = useSharedValue(1);
  useEffect(() => { pulse.value = withRepeat(withTiming(0.35, { duration: 900 }), -1, true); }, []);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));
  if (!voice || visible) return null;
  const label = voice.kind === 'voice3d' ? '3D-Raum' : voice.kind === 'game' ? 'Spiel' : voice.kind === 'voice' ? 'Sprachraum' : 'Anruf';
  return (
    <Animated.View entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)} style={[s.wrap, { top: ins.top + 4 }]} pointerEvents="box-none">
      <Pressable accessibilityRole="button" accessibilityLabel={`Zurück zum ${label}`} onPress={() => { Haptics.selectionAsync().catch(() => {}); showWeb(voice.path); }} style={s.bar}>
        <Animated.View style={[s.live, dot]} />
        <Icon name={voice.kind === 'voice3d' ? 'cube' : voice.kind === 'game' ? 'target' : voice.video ? 'video' : 'phone'} size={15} color="#fff" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T style={s.title} numberOfLines={1}>{voice.title || label}</T>
          <T style={s.sub} numberOfLines={1}>{label} läuft · zum Zurückkehren tippen</T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Auflegen" hitSlop={8} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); leaveCall(); }} style={s.hang}>
          <Icon name="hang" size={16} color="#fff" stroke={2.4} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export function IncomingCall() {
  const ring = useHost((s) => s.ring);
  useEffect(() => { if (ring) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); }, [ring?.dm]);
  if (!ring) return null;
  const u = { ...userOf(ring.from), display: ring.name, avatar: ring.avatar ?? userOf(ring.from).avatar };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={declineCall}>
      <View style={s.back}>
        <Glass style={s.card} intensity={50} tint="rgba(19,20,32,0.9)">
          <Avatar user={u as any} size={96} />
          <T style={s.who} numberOfLines={1}>{ring.name}</T>
          <T style={s.what}>ruft dich an …</T>
          <View style={s.btns}>
            <Pressable accessibilityRole="button" accessibilityLabel="Ablehnen" onPress={declineCall} style={[s.round, { backgroundColor: C.danger }]}><Icon name="hang" size={26} color="#fff" stroke={2.4} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Annehmen" onPress={() => answerCall(ring.dm)} style={[s.round, { backgroundColor: C.ok }]}><Icon name="phone" size={26} color="#062b1b" stroke={2.4} /></Pressable>
          </View>
        </Glass>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 10, right: 10, zIndex: 60, elevation: 60 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingLeft: 14, paddingRight: 6, borderRadius: 24, backgroundColor: '#1f8a5b', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  live: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#b8ffd9' },
  title: { color: '#fff', fontWeight: '800', fontSize: 14 },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 11.5, marginTop: -3 },
  hang: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' },
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, borderRadius: 28, padding: 28, alignItems: 'center' },
  who: { fontSize: 24, fontWeight: '800', marginTop: 14 },
  what: { color: C.muted, marginTop: 2 },
  btns: { flexDirection: 'row', gap: 48, marginTop: 28 },
  round: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
});
