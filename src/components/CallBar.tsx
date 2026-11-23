// Anruf-Leiste: Ist man in einem Anruf, Sprach- oder 3D-Raum und sieht ihn gerade nicht, steht oben eine Leiste –
// antippen führt zurück, rechts legt man auf. Dazu das Fenster für eingehende Anrufe (Annehmen / Ablehnen).
// Anrufe und Sprachräume laufen in der App selbst (calls.ts); 3D-Räume, Spiele und der Ersatzweg in der Web-Ansicht.
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { answerCall, declineCall, leaveCall, showWeb, useHost } from '@/lib/webhost';
import { answerRing, declineRing, openCallScreen, useCalls, useVoice, voice } from '@/lib/calls';
import { userOf } from '@/lib/store';
import { Avatar, Glass, T } from './ui';
import { Icon } from './Icon';
import { C } from '@/lib/theme';

export function CallBar() {
  const web = useHost((s) => s.voice);
  const visible = useHost((s) => s.visible);
  const room = useVoice((v) => v.room);
  const meta = useVoice((v) => v.meta);
  const video = useVoice((v) => v.video);
  const speaking = useVoice((v) => Object.keys(v.speaking).length > 0);
  const screenOpen = useCalls((c) => c.screenOpen);
  const ins = useSafeAreaInsets();
  const pulse = useSharedValue(1);
  useEffect(() => { pulse.value = withRepeat(withTiming(0.35, { duration: 900 }), -1, true); }, []);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const native = !!room && !!meta;
  if (native ? screenOpen : !web || visible) return null;
  const kind = native ? meta!.kind : web!.kind;
  const label = kind === 'voice3d' ? '3D-Raum' : kind === 'game' ? 'Spiel' : kind === 'voice' ? 'Sprachraum' : 'Anruf';
  const title = native ? meta!.title : web!.title;
  const back = () => { Haptics.selectionAsync().catch(() => {}); if (native) openCallScreen(); else showWeb(web!.path); };
  const hang = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); if (native) voice.leave(); else leaveCall(); };
  return (
    <Animated.View entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)} style={[s.wrap, { top: ins.top + 4 }]} pointerEvents="box-none">
      <View style={[s.bar, native && speaking && s.barTalk]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Zurück zum ${label}`} onPress={back} style={s.barMain}>
          <Animated.View style={[s.live, dot]} />
          <Icon name={kind === 'voice3d' ? 'cube' : kind === 'game' ? 'target' : kind === 'voice' ? 'volume' : (native ? video : web!.video) ? 'video' : 'phone'} size={15} color="#fff" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T style={s.title} numberOfLines={1}>{title || label}</T>
            <T style={s.sub} numberOfLines={1}>{label} läuft · zum Zurückkehren tippen</T>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Auflegen" hitSlop={8} onPress={hang} style={s.hang}>
          <Icon name="hang" size={16} color="#fff" stroke={2.4} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function IncomingCall() {
  const webRing = useHost((s) => s.ring);
  const appRing = useCalls((c) => c.ring);
  const ring = appRing || webRing;
  // Vibrieren, solange es klingelt (wie ein Anruf)
  useEffect(() => {
    if (!ring) return;
    const buzz = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    buzz();
    const t = setInterval(buzz, 1600);
    return () => clearInterval(t);
  }, [ring?.dm]);
  if (!ring) return null;
  const u = { ...userOf(ring.from), display: ring.name, avatar: ring.avatar ?? userOf(ring.from).avatar };
  const decline = () => (appRing ? declineRing() : declineCall());
  const answer = () => (appRing ? answerRing() : answerCall(ring.dm));
  return (
    <Modal visible transparent animationType="fade" onRequestClose={decline}>
      <View style={s.back}>
        <Glass style={s.card} intensity={50} tint="rgba(19,20,32,0.9)">
          <Avatar user={u as any} size={96} />
          <T style={s.who} numberOfLines={1}>{ring.name}</T>
          <T style={s.what}>{ring.title && ring.title !== ring.name ? `ruft dich an · ${ring.title}` : 'ruft dich an …'}</T>
          <View style={s.btns}>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Ablehnen" onPress={decline} style={[s.round, { backgroundColor: C.danger }]}><Icon name="hang" size={26} color="#fff" stroke={2.4} /></Pressable>
              <T style={s.btnText}>Ablehnen</T>
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Annehmen" onPress={answer} style={[s.round, { backgroundColor: C.ok }]}><Icon name="phone" size={26} color="#062b1b" stroke={2.4} /></Pressable>
              <T style={s.btnText}>Annehmen</T>
            </View>
          </View>
        </Glass>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 10, right: 10, zIndex: 60, elevation: 60 },
  barMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingLeft: 14, paddingRight: 6, borderRadius: 24, backgroundColor: '#1f8a5b', borderWidth: 2, borderColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  barTalk: { borderColor: '#b8ffd9' },
  live: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#b8ffd9' },
  title: { color: '#fff', fontWeight: '800', fontSize: 14 },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 11.5, marginTop: -3 },
  hang: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' },
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, borderRadius: 28, padding: 28, alignItems: 'center' },
  who: { fontSize: 24, fontWeight: '800', marginTop: 14 },
  what: { color: C.muted, marginTop: 2, textAlign: 'center' },
  btns: { flexDirection: 'row', gap: 56, marginTop: 28 },
  round: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: C.muted, fontSize: 12 },
});
