// Profilkopf für „Ich“ und die Profilkarte: Banner (Bild oder Farbverlauf), Profil-Effekt über Banner und Bild,
// Profilbild mit Rahmen und Leuchten in der Akzentfarbe, Name im Namens-Stil, @Name, Status als Zeile, Status-Text.
// Status-Punkt und Kamera-Symbol liegen bewusst NICHT auf dem Bild – sie verdeckten den Rahmen.
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { mediaSource } from '@/lib/api';
import { Avatar, T } from './ui';
import { NameText } from './NameText';
import { ProfileFx } from './ProfileFx';
import { Icon } from './Icon';
import { C, statusColor } from '@/lib/theme';

const STATUS_TEXT: Record<string, string> = { online: 'Online', idle: 'Abwesend', dnd: 'Bitte nicht stören', invisible: 'Unsichtbar', offline: 'Offline' };

export function ProfileHead({ u, status, topLeft, topRight, onAvatar, children }: { u: any; status?: string; topLeft?: React.ReactNode; topRight?: React.ReactNode; onAvatar?: () => void; children?: React.ReactNode }) {
  const banner = mediaSource(u.banner);
  const accent = u.accent || C.accent;
  const st = status || u.status || 'offline';
  const av = <Avatar user={u} size={96} live />;
  return (
    <View>
      <View style={s.banner}>
        {banner ? <Image source={banner} style={StyleSheet.absoluteFill} contentFit="cover" />
          : <LinearGradient colors={[u.banner_color || accent, '#ff5c9a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
        <LinearGradient colors={['transparent', 'rgba(7,7,13,0.92)']} style={StyleSheet.absoluteFill} />
      </View>
      <Animated.View entering={FadeInDown.duration(320)} style={s.head}>
        <View style={[s.glow, { shadowColor: accent, backgroundColor: accent + '26' }]} />
        {onAvatar ? <Pressable accessibilityLabel="Profilbild ändern" onPress={onAvatar}>{av}</Pressable> : av}
        <NameText name={u.display || u.username} styleId={u.name_style} style={s.name} />
        <T style={s.handle} numberOfLines={1}>@{u.username}{u.pronouns ? ' · ' + u.pronouns : ''}</T>
        <View style={s.statusLine}>
          <View style={[s.dot, { backgroundColor: st === 'invisible' ? C.faint : statusColor(st) }]} />
          <T style={s.statusText}>{STATUS_TEXT[st] || 'Offline'}</T>
          {onAvatar ? <Pressable accessibilityLabel="Profilbild ändern" onPress={onAvatar} style={s.edit}><Icon name="image" size={12} color={C.text2} /><T style={s.editText}>Bild ändern</T></Pressable> : null}
        </View>
        {u.custom_status ? <View style={s.bubble}><T style={{ color: C.text2, textAlign: 'center', fontSize: 14 }} numberOfLines={3}>{u.custom_status}</T></View> : null}
        {children}
      </Animated.View>
      {/* Effekt über Banner und Kopf, wie die Profilkarte im Web */}
      <ProfileFx id={u.effect} />
      {topLeft ? <View style={[s.corner, { left: 12 }]}>{topLeft}</View> : null}
      {topRight ? <View style={[s.corner, { right: 12 }]}>{topRight}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  banner: { height: 120, overflow: 'hidden' },
  head: { alignItems: 'center', marginTop: -58, paddingHorizontal: 20, paddingBottom: 4 },
  glow: { position: 'absolute', top: 6, width: 96, height: 96, borderRadius: 48, shadowOpacity: 0.9, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } },
  name: { fontSize: 24, fontWeight: '800', marginTop: 12, letterSpacing: -0.3, maxWidth: '100%', textAlign: 'center' },
  handle: { color: C.muted, fontSize: 14, marginTop: -1 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { color: C.text2, fontSize: 13, fontWeight: '700' },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8, paddingHorizontal: 8, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  editText: { color: C.text2, fontSize: 12, fontWeight: '700' },
  bubble: { marginTop: 10, backgroundColor: C.bg3, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: C.line, maxWidth: '100%' },
  corner: { position: 'absolute', top: 14 },
});
