// Bausteine im Stil der Web-App: Schrift (Cairo), Farbverlauf-Knöpfe, Glasflächen, Leuchten im Hintergrund,
// Profilbilder mit animierten Rahmen, Server-Symbole, Menü von unten.
import React, { useEffect } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text as RNText, View, ActivityIndicator, type TextProps, type ViewStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, GRAD, GRAD_POS, R, F, fontFor, statusColor } from '@/lib/theme';
import { mediaSource } from '@/lib/api';
import { FRAMES, frameMin } from '@/lib/frames';
import type { Server, User } from '@/lib/store';
import { Icon, type IconName } from './Icon';

import { HAS_LOTTIE, LottieFrame } from './LottieFrame';

/** Text in der Schrift der Web-App. fontWeight wird auf den passenden Cairo-Schnitt abgebildet. */
export function T({ style, ...p }: TextProps) {
  const flat = StyleSheet.flatten(style) || {};
  return <RNText {...p} style={[{ color: C.text, fontSize: 15, fontFamily: fontFor(flat.fontWeight as any) }, style, { fontWeight: undefined }]} />;
}

/** Leuchten im Hintergrund wie im Web (lila oben links, rosa unten rechts). */
export function Glow({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="g1" cx="0%" cy="0%" r="75%"><Stop offset="0" stopColor="#8468ff" stopOpacity="0.28" /><Stop offset="1" stopColor="#8468ff" stopOpacity="0" /></RadialGradient>
          <RadialGradient id="g2" cx="100%" cy="100%" r="70%"><Stop offset="0" stopColor="#ff5c9a" stopOpacity="0.16" /><Stop offset="1" stopColor="#ff5c9a" stopOpacity="0" /></RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={C.bg0} />
        <Rect width="100%" height="100%" fill="url(#g1)" />
        <Rect width="100%" height="100%" fill="url(#g2)" />
      </Svg>
    </View>
  );
}

/** Glasfläche (unscharfer Hintergrund) mit feiner Kante – wie die schwebenden Flächen der Web-App. */
export function Glass({ style, children, intensity = 30, tint = 'rgba(19,20,32,0.72)' }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode; intensity?: number; tint?: string }) {
  return (
    <View style={[{ overflow: 'hidden', borderWidth: 1, borderColor: C.line }, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
      {children}
    </View>
  );
}

/** Drücken: leicht kleiner werden (wie :active in der Web-App). */
export function Press({ onPress, onLongPress, style, children, disabled, label, role = 'button', scale = 0.96 }: { onPress?: () => void; onLongPress?: () => void; style?: StyleProp<ViewStyle>; children?: React.ReactNode; disabled?: boolean; label?: string; role?: any; scale?: number }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable accessibilityRole={role} accessibilityLabel={label} disabled={disabled} onPress={onPress} onLongPress={onLongPress} delayLongPress={300}
      onPressIn={() => { s.value = withSpring(scale, { damping: 18, stiffness: 400 }); }} onPressOut={() => { s.value = withSpring(1, { damping: 14, stiffness: 300 }); }}>
      <Animated.View style={[style, a, disabled && { opacity: 0.5 }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Btn({ title, onPress, kind = 'primary', icon, disabled, busy, style, small }: { title: string; onPress?: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'ghost'; icon?: IconName; disabled?: boolean; busy?: boolean; style?: StyleProp<ViewStyle>; small?: boolean }) {
  const h = small ? 38 : 50;
  const inner = busy ? <ActivityIndicator color="#fff" /> : <>
    {icon ? <Icon name={icon} size={small ? 16 : 18} color={kind === 'ghost' ? C.text2 : '#fff'} /> : null}
    <T style={{ color: kind === 'ghost' ? C.text2 : '#fff', fontWeight: '700', fontSize: small ? 14 : 16 }}>{title}</T>
  </>;
  return (
    <Press onPress={onPress} disabled={disabled || busy} label={title} style={[{ height: h, borderRadius: R.md, overflow: 'hidden' }, kind === 'primary' && s.btnShadow, style]}>
      {kind === 'primary' ? <LinearGradient colors={GRAD as any} locations={GRAD_POS as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
      <View style={[s.btnIn, { backgroundColor: kind === 'secondary' ? C.bg4 : kind === 'danger' ? C.danger : 'transparent' }, kind === 'primary' && s.btnShine]}>{inner}</View>
    </Press>
  );
}

/** Profilbild mit Status und – wenn die Person einen hat – animiertem Rahmen wie in der Web-App. */
export function Avatar({ user, size = 40, status = false, frame = true, live = false, ring, force = false }: { user?: (User & { deco?: string }) | null; size?: number; status?: boolean; frame?: boolean; live?: boolean; ring?: string; force?: boolean }) {
  const src = mediaSource(user?.avatar);
  const f = frame && user && (user as any).deco ? FRAMES[(user as any).deco] : null;
  const showFrame = f && (force || size >= frameMin(f));
  const dot = size * 0.3;
  return (
    <View style={{ width: size, height: size }}>
      {src ? <Image source={src} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={150} />
        : <LinearGradient colors={[user?.accent || C.accent, shade(user?.accent || C.accent)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4, lineHeight: size * 0.55 }}>{initials(user?.display || user?.username)}</T>
          </LinearGradient>}
      {ring ? <View pointerEvents="none" style={{ position: 'absolute', inset: -3, borderRadius: size, borderWidth: 2.5, borderColor: ring }} /> : null}
      {showFrame ? (() => {
        const w = f!.w * size, h = f!.h * size, left = size / 2 - f!.x * size, top = size / 2 - f!.y * size;
        return <View pointerEvents="none" style={{ position: 'absolute', left, top, width: w, height: h }}>
          {live && HAS_LOTTIE ? <LottieFrame source={f!.json} width={w} height={h} /> : <Image source={f!.still} style={{ width: w, height: h }} contentFit="contain" />}
        </View>;
      })() : null}
      {status ? <View style={{ position: 'absolute', right: -1, bottom: -1, width: dot, height: dot, borderRadius: dot, backgroundColor: statusColor(user?.status), borderWidth: Math.max(2, size * 0.06), borderColor: C.bg1 }} /> : null}
    </View>
  );
}
const initials = (s?: string) => String(s || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
function shade(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) return '#ff5c9a';
  const n = parseInt(m[1], 16), r = Math.max(0, (n >> 16) - 60), g = Math.max(0, ((n >> 8) & 255) - 60), b = Math.min(255, (n & 255) + 30);
  return `rgb(${r},${g},${b})`;
}

/** Server-Symbol: rund, beim aktiven Server abgerundetes Quadrat im Farbverlauf (wie die Leiste der Web-App). */
export function ServerIcon({ server, size = 48, active = false }: { server: Server; size?: number; active?: boolean }) {
  const src = mediaSource(server.icon);
  const r = useSharedValue(active ? 16 : size / 2);
  useEffect(() => { r.value = withTiming(active ? 16 : size / 2, { duration: 180 }); }, [active]);
  const a = useAnimatedStyle(() => ({ borderRadius: r.value }));
  return (
    <Animated.View style={[{ width: size, height: size, overflow: 'hidden', borderWidth: 1, borderColor: active ? 'transparent' : C.line }, a, active && s.activeGlow]}>
      {src ? <Image source={src} style={{ width: size, height: size }} contentFit="cover" />
        : <>
          {active ? <LinearGradient colors={GRAD as any} locations={GRAD_POS as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: server.color || C.bg3 }]} />}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ color: '#fff', fontWeight: '800', fontSize: server.icon_emoji ? size * 0.46 : size * 0.34 }}>{server.icon_emoji || initials(server.name)}</T>
          </View>
        </>}
    </Animated.View>
  );
}

export const Badge = ({ n, style }: { n: number; style?: StyleProp<ViewStyle> }) => (
  <View style={[s.badge, style]}><T style={s.badgeText}>{n > 99 ? '99+' : String(n)}</T></View>
);

export type SheetItem = { label: string; icon?: IconName; danger?: boolean; onPress: () => void } | null | false;
/** Menü von unten (lange drücken auf Nachricht, Person …) als Glasfläche. */
export function Sheet({ open, onClose, title, items, header }: { open: boolean; onClose: () => void; title?: string; items: SheetItem[]; header?: React.ReactNode }) {
  const ins = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Schließen" />
      <Glass style={[s.sheet, { paddingBottom: ins.bottom + 12 }]} intensity={50} tint="rgba(19,20,32,0.86)">
        <View style={s.grab} />
        {header}
        {title ? <T style={s.sheetTitle}>{title}</T> : null}
        {items.filter(Boolean).map((it, i) => {
          const x = it as Exclude<SheetItem, null | false>;
          return (
            <Pressable key={i} accessibilityRole="button" onPress={() => { onClose(); setTimeout(x.onPress, 50); }} style={({ pressed }) => [s.item, pressed && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              {x.icon ? <Icon name={x.icon} size={20} color={x.danger ? C.danger : C.text2} /> : null}
              <T style={[s.itemText, x.danger && { color: C.danger }]}>{x.label}</T>
            </Pressable>
          );
        })}
      </Glass>
    </Modal>
  );
}

export const Empty = ({ icon, title, text }: { icon: IconName; title: string; text?: string }) => (
  <View style={{ alignItems: 'center', padding: 36, gap: 10 }}>
    <View style={s.emptyIcon}><Icon name={icon} size={30} color={C.accent} /></View>
    <T style={{ fontSize: 18, fontWeight: '800', textAlign: 'center' }}>{title}</T>
    {text ? <T style={{ color: C.muted, textAlign: 'center', lineHeight: 21 }}>{text}</T> : null}
  </View>
);

/** Überschrift einer Liste („KATEGORIE“, „ANFRAGEN – 2“) wie .side-section der Web-App. */
export const Section = ({ children, style }: { children: React.ReactNode; style?: any }) => <T style={[s.section, style]}>{children}</T>;

const s = StyleSheet.create({
  btnIn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  btnShine: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)', borderRadius: R.md },
  btnShadow: { shadowColor: '#8468ff', shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  activeGlow: { shadowColor: '#8468ff', shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: C.accent2, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg0 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', lineHeight: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 10, paddingTop: 8, borderBottomWidth: 0 },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.bg5, marginBottom: 8 },
  sheetTitle: { color: C.faint, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 12, paddingVertical: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12, minHeight: 52, borderRadius: 12 },
  itemText: { fontSize: 16, fontWeight: '600' },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.accentLine },
  section: { color: C.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1 },
});
export { F };
