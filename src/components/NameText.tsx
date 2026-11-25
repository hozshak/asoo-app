// Name im gewählten Namens-Stil wie in der Web-App (.ns-* in app.css).
// Metall (Gold, Chrom, Roségold, Smaragd): heller Verlauf von oben nach unten wie poliertes Metall; mit live wandert ein
// Lichtstreifen darüber. Fließend (Königlich, Holo, Polarlicht, Lava …): der Verlauf läuft mit live langsam durch.
// Der Verlauf liegt per MaskedView in der Schrift. Ohne Stil: normale Schrift (bzw. Rollenfarbe).
// live nur dort setzen, wo ein einzelner Name groß zu sehen ist (Profil, Vorschau) – in Listen bleibt der Name ruhig.
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import MaskedViewRaw from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, cancelAnimation } from 'react-native-reanimated';
import { T } from './ui';
import { VerifiedMark } from './Verified';
import { C } from '@/lib/theme';

// die Typen des Pakets passen nicht zu React 19 – zur Laufzeit ist es ein normales Bauteil
const MaskedView = MaskedViewRaw as unknown as React.ComponentType<any>;

type Kind = 'plain' | 'flat' | 'metal' | 'flow' | 'glow' | 'glitch' | 'mono';
/** [Kennung, Name, Farben, Art] – Reihenfolge wie in der Auswahl (und wie NAME_STYLES in der Web-App) */
export const NAME_STYLES: [string, string, string[], Kind][] = [
  ['default', 'Standard', [], 'plain'],
  ['gold', 'Gold', ['#fff6c2', '#f6cf55', '#b07c1c', '#f8dd80', '#d19a2c'], 'metal'],
  ['chrome', 'Chrom', ['#ffffff', '#c9d2df', '#6d7889', '#e6ecf5', '#9aa6b8'], 'metal'],
  ['rosegold', 'Roségold', ['#ffe9df', '#f2a995', '#a8614f', '#f7c4b2', '#c98470'], 'metal'],
  ['emerald', 'Smaragd', ['#d6ffe9', '#3fd68f', '#0f7a47', '#7df0b7', '#1f9a5c'], 'metal'],
  ['royal', 'Königlich', ['#8a4dff', '#c86bff', '#ffd86b', '#fff3c2', '#ffd86b', '#c86bff', '#8a4dff'], 'flow'],
  ['holo', 'Holo', ['#a8fff0', '#a8c8ff', '#e0a8ff', '#ffa8d8', '#fff0a8', '#a8fff0'], 'flow'],
  ['aurora', 'Polarlicht', ['#3dffb0', '#2ec5ff', '#8f6bff', '#5ef0c8', '#3dffb0'], 'flow'],
  ['lava', 'Lava', ['#ffdd55', '#ff7a1a', '#d91a1a', '#7a0f0f', '#d91a1a', '#ff7a1a', '#ffdd55'], 'flow'],
  ['blood', 'Blutmond', ['#ff5a6a', '#c9102a', '#6b0010', '#c9102a', '#ff5a6a'], 'flow'],
  ['sunset', 'Sonnenuntergang', ['#ff7a45', '#ff3d77'], 'flat'],
  ['ocean', 'Ozean', ['#2ec5ff', '#3d6bff'], 'flat'],
  ['neon', 'Neon', ['#39ff14', '#00e5ff'], 'flat'],
  ['candy', 'Candy', ['#ff8ad8', '#b98bff'], 'flat'],
  ['toxic', 'Toxic', ['#b6ff00', '#00ff9d'], 'flat'],
  ['fire', 'Feuer', ['#ffdd00', '#ff6a00', '#ff0040'], 'flat'],
  ['ice', 'Eis', ['#e0f7ff', '#8fd3ff'], 'flat'],
  ['mint', 'Minze', ['#c8ffe8', '#5ee6b5', '#2ec5a0'], 'flat'],
  ['cotton', 'Zuckerwatte', ['#ffc2e2', '#c9b8ff', '#a8e0ff'], 'flat'],
  ['galaxy', 'Galaxie', ['#7c5cff', '#ff5c8a', '#2ec5ff'], 'flat'],
  ['rainbow', 'Regenbogen', ['#ff4d5e', '#ffb02e', '#ffe14d', '#3ddc97', '#2ec5ff', '#7c5cff', '#ff4d5e'], 'flow'],
  ['glow', 'Leuchten', [], 'glow'],
  ['glitch', 'Glitch', [], 'glitch'],
  ['mono', 'Code', [], 'mono'],
];
const METAL_AT = [0, 0.34, 0.53, 0.7, 1] as const;
const OUTER = ['flex', 'flexShrink', 'flexGrow', 'alignSelf', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'maxWidth'];

/** Name im Namens-Stil; verified = blauer Haken dahinter (verifiziertes Konto). */
export function NameText({ verified, ...p }: { name: string; styleId?: string | null; style?: StyleProp<TextStyle>; color?: string | null; numberOfLines?: number; onPress?: () => void; live?: boolean; verified?: boolean }) {
  if (!verified) return <NameInner {...p} />;
  const fs = (StyleSheet.flatten(p.style) as TextStyle | undefined)?.fontSize || 15;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, minWidth: 0 }}><View style={{ flexShrink: 1, minWidth: 0 }}><NameInner {...p} /></View><VerifiedMark size={Math.round(fs * 0.95)} /></View>;
}
function NameInner({ name, styleId, style, color, numberOfLines = 1, onPress, live = false }: { name: string; styleId?: string | null; style?: StyleProp<TextStyle>; color?: string | null; numberOfLines?: number; onPress?: () => void; live?: boolean }) {
  const def = NAME_STYLES.find((x) => x[0] === (styleId || 'default')) || NAME_STYLES[0];
  const [, , colors, kind] = def;
  if (kind === 'mono') return <T style={[style, { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), letterSpacing: -0.3 }]} numberOfLines={numberOfLines} onPress={onPress}>{name}</T>;
  if (kind === 'plain') return <T style={[style, color ? { color } : null]} numberOfLines={numberOfLines} onPress={onPress}>{name}</T>;
  if (kind === 'glow') return <T style={[style, { color: '#fff', textShadowColor: C.accent, textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } }]} numberOfLines={numberOfLines} onPress={onPress}>{name}</T>;
  if (kind === 'glitch') return <Glitch name={name} style={style} numberOfLines={numberOfLines} onPress={onPress} live={live} />;
  // Browser (nur Vorschau beim Entwickeln): dort kann die Schrift selbst den Verlauf tragen
  if (Platform.OS === 'web') {
    const img = kind === 'metal' ? `linear-gradient(180deg, ${colors.map((c, i) => `${c} ${METAL_AT[i] * 100}%`).join(', ')})` : `linear-gradient(90deg, ${colors.join(', ')})`;
    return <T style={[style, { color: 'transparent', backgroundImage: img, backgroundClip: 'text', WebkitBackgroundClip: 'text' } as any]} numberOfLines={numberOfLines} onPress={onPress}>{name}</T>;
  }
  const flat = (StyleSheet.flatten(style) || {}) as Record<string, any>;
  const outer: Record<string, any> = {}, textStyle: Record<string, any> = {};
  for (const [k, v] of Object.entries(flat)) (OUTER.includes(k) ? outer : textStyle)[k] = v;
  return (
    <View style={{ ...outer, flexShrink: outer.flexShrink ?? 1 }}>
      <MaskedView maskElement={<T style={[textStyle, { color: '#000' }]} numberOfLines={numberOfLines}>{name}</T>}>
        <Fill kind={kind} colors={colors} live={live}>
          <T style={[textStyle, { opacity: 0 }]} numberOfLines={numberOfLines} onPress={onPress}>{name}</T>
        </Fill>
      </MaskedView>
    </View>
  );
}

/** Füllung hinter der Schrift: Verlauf, bei Metall der wandernde Lichtstreifen, bei fließenden Stilen der laufende Verlauf. */
function Fill({ kind, colors, live, children }: { kind: Kind; colors: string[]; live: boolean; children: React.ReactNode }) {
  const [w, setW] = useState(0);
  const v = useSharedValue(0);
  const moving = live && w > 0 && (kind === 'metal' || kind === 'flow');
  useEffect(() => {
    if (!moving) { cancelAnimation(v); v.value = 0; return; }
    v.value = 0;
    v.value = kind === 'metal'
      ? withRepeat(withSequence(withDelay(2400, withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) })), withTiming(0, { duration: 0 })), -1, false)
      : withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(v);
  }, [moving, kind]);
  const sheen = useAnimatedStyle(() => ({ transform: [{ translateX: -0.6 * w + v.value * 2.2 * w }, { skewX: '-20deg' }] }));
  const flow = useAnimatedStyle(() => ({ transform: [{ translateX: -v.value * w * 1.2 }] }));
  if (kind === 'metal') {
    return (
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <LinearGradient colors={colors as any} locations={METAL_AT as any} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>{children}</LinearGradient>
        {moving ? <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: Math.max(18, w * 0.28) }, sheen]}>
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View> : null}
      </View>
    );
  }
  if (kind === 'flow') {
    // Verlauf 2,4-mal so breit wie der Name und am Ende wieder die Anfangsfarbe: um 1,2 Breiten verschieben = nahtlose Schleife
    return (
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ overflow: 'hidden' }}>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: (w || 1) * 2.4 }, flow]}>
          <LinearGradient colors={[...colors, ...colors.slice(1)] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {children}
      </View>
    );
  }
  return <LinearGradient colors={colors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>{children}</LinearGradient>;
}

/** Glitch: weiße Schrift mit versetzten Farbkanten; mit live zuckt sie alle paar Sekunden kurz. */
function Glitch({ name, style, numberOfLines, onPress, live }: { name: string; style?: StyleProp<TextStyle>; numberOfLines: number; onPress?: () => void; live: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (!live) { v.value = 0; return; }
    v.value = withRepeat(withSequence(withDelay(2600, withTiming(1, { duration: 70 })), withTiming(-1, { duration: 90 }), withTiming(0.6, { duration: 70 }), withTiming(0, { duration: 90 })), -1, false);
    return () => cancelAnimation(v);
  }, [live]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: 1.5 + v.value * 1.6 }] }));
  const b = useAnimatedStyle(() => ({ transform: [{ translateX: -1.5 - v.value * 1.6 }] }));
  const flat = (StyleSheet.flatten(style) || {}) as Record<string, any>;
  const outer: Record<string, any> = {}, textStyle: Record<string, any> = {};
  for (const [k, val] of Object.entries(flat)) (OUTER.includes(k) ? outer : textStyle)[k] = val;
  return (
    <View style={{ ...outer, flexShrink: outer.flexShrink ?? 1 }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, a]}><T style={[textStyle, { color: '#ff2fa0' }]} numberOfLines={numberOfLines}>{name}</T></Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, b]}><T style={[textStyle, { color: '#20d6ff' }]} numberOfLines={numberOfLines}>{name}</T></Animated.View>
      <T style={[textStyle, { color: '#fff' }]} numberOfLines={numberOfLines} onPress={onPress}>{name}</T>
    </View>
  );
}
