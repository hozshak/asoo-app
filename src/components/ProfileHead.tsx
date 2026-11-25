// Profilkopf für „Ich“ und die Profilkarte – aufgebaut wie bei Discord: großes Banner über die ganze Breite (auf „Ich“
// bis unter die Statusleiste), Profilbild links, halb auf dem Banner, mit Rahmen; darunter Name, @Name, Status.
// Der Profil-Effekt liegt NICHT hier (er wurde hier am unteren Rand abgeschnitten): Die Seite legt ihn über den ganzen
// Bildschirm (siehe me.tsx / user/[id].tsx). Status-Punkt und Kamera liegen bewusst neben dem Bild – sie verdeckten den Rahmen.
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mediaSource } from '@/lib/api';
import { Avatar, T } from './ui';
import { NameText } from './NameText';
import { isVerified } from './Verified';
import { Icon } from './Icon';
import { C, statusColor } from '@/lib/theme';
import { t } from '@/lib/i18n';

const STATUS_TEXT: Record<string, string> = { online: t("Online"), idle: t("Abwesend"), dnd: t("Bitte nicht stören"), invisible: t("Unsichtbar"), offline: t("Offline") };
const AV = 92;       // Profilbild
const BANNER = 150;  // Banner-Höhe unterhalb der Statusleiste

export function ProfileHead({ u, status, topLeft, topRight, bannerRight, onAvatar, onName, ring = C.bg0, safeTop = false, children }: { u: any; status?: string; topLeft?: React.ReactNode; topRight?: React.ReactNode; bannerRight?: React.ReactNode; onAvatar?: () => void; onName?: () => void; ring?: string; safeTop?: boolean; children?: React.ReactNode }) {
  const ins = useSafeAreaInsets();
  const top = safeTop ? ins.top : 0;
  const banner = mediaSource(u.banner);
  const accent = u.accent || C.accent;
  const st = status || u.status || 'offline';
  const av = (
    <View style={[s.avRing, { backgroundColor: ring }]}>
      <Avatar user={u} size={AV} live />
      {onAvatar ? <View style={[s.cam, { borderColor: ring }]}><Icon name="image" size={13} color="#fff" /></View> : null}
    </View>
  );
  return (
    <View>
      <View style={[s.banner, { height: BANNER + top }]}>
        {banner ? <Image source={banner} style={StyleSheet.absoluteFill} contentFit="cover" />
          : <LinearGradient colors={[u.banner_color || accent, '#ff5c9a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
        {/* nur oben leicht abdunkeln, damit Uhrzeit und Knöpfe lesbar bleiben – das Banner selbst bleibt ganz zu sehen */}
        <LinearGradient colors={['rgba(0,0,0,0.38)', 'transparent']} style={[s.shade, { height: top + 56 }]} pointerEvents="none" />
      </View>
      <Animated.View entering={FadeInDown.duration(320)} style={s.head}>
        <View style={s.avRow}>
          {onAvatar ? <Pressable accessibilityLabel={t("Profilbild ändern")} onPress={onAvatar}>{av}</Pressable> : av}
        </View>
        {/* eigenes Profil: Name mit Pfeil, antippen = Status ändern (wie bei Discord) */}
        {onName ? <Pressable accessibilityRole="button" accessibilityLabel={t("Status ändern")} onPress={onName} style={s.nameRow}>
            <NameText name={u.display || u.username} styleId={u.name_style} style={s.name} verified={isVerified(u)} />
            <View style={{ marginTop: 12 }}><Icon name="chevron" size={18} color={C.text2} stroke={2.4} /></View>
          </Pressable>
          : <NameText name={u.display || u.username} styleId={u.name_style} style={s.name} verified={isVerified(u)} />}
        <T style={s.handle} numberOfLines={1}>@{u.username}{u.pronouns ? ' · ' + u.pronouns : ''}</T>
        <View style={s.statusLine}>
          <View style={[s.dot, { backgroundColor: st === 'invisible' ? C.faint : statusColor(st) }]} />
          <T style={s.statusText}>{STATUS_TEXT[st] || t("Offline")}</T>
        </View>
        {u.custom_status ? <View style={s.bubble}><T style={{ color: C.text2, fontSize: 14 }} numberOfLines={3}>{u.custom_status}</T></View> : null}
        {children}
      </Animated.View>
      {topLeft ? <View style={[s.corner, { left: 12, top: top + 10 }]}>{topLeft}</View> : null}
      {topRight ? <View style={[s.corner, { right: 12, top: top + 10 }]}>{topRight}</View> : null}
      {/* rechts unten am Banner (wie das Zahnrad bei Discord), auf Höhe des Profilbilds */}
      {bannerRight ? <View style={[s.corner, { right: 14, top: top + BANNER + 10 }]}>{bannerRight}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  banner: { overflow: 'hidden', backgroundColor: C.bg2 },
  shade: { position: 'absolute', top: 0, left: 0, right: 0 },
  head: { alignItems: 'flex-start', marginTop: -(AV / 2 + 6), paddingHorizontal: 16, paddingBottom: 4 },
  avRow: { overflow: 'visible' },
  // Ring in der Hintergrundfarbe um das Bild (wie bei Discord); der Rahmen ragt darüber hinaus und wird nicht beschnitten
  avRing: { width: AV + 12, height: AV + 12, borderRadius: (AV + 12) / 2, backgroundColor: C.bg0, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  cam: { position: 'absolute', right: 2, bottom: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.bg0 },
  name: { fontSize: 24, fontWeight: '800', marginTop: 10, letterSpacing: -0.3, maxWidth: '100%' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  handle: { color: C.muted, fontSize: 14, marginTop: -1 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { color: C.text2, fontSize: 13, fontWeight: '700' },
  bubble: { marginTop: 10, backgroundColor: C.bg3, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: C.line, maxWidth: '100%' },
  corner: { position: 'absolute' },
});
