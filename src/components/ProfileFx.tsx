// Profil-Effekte wie in der Web-App (frames.js profileFx + .pfx-* in app.css): Teilchen über Profilkopf bzw. Karte.
// Lage und Tempo jedes Teilchens sind fest „gewürfelt“ (gleicher Startwert wie im Web) – bei jedem gleich.
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming, interpolate } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

export const EFFECTS: [string, string, number][] = [['petals', 'Blütenregen', 16], ['snow', 'Schnee', 22], ['stars', 'Sternenhimmel', 18], ['hearts', 'Herzen', 12], ['embers', 'Glut', 20], ['confetti', 'Konfetti', 24], ['aurora', 'Polarlicht', 3], ['fireflies', 'Glühwürmchen', 12]];
const COLORS = ['#7c5cff', '#ff5c8a', '#ffb02e', '#3ddc97', '#2ec5ff', '#ffe27a'];

type P = { x: number; y: number; d: number; t: number; s: number; dx: number; c: string; r: number };

function particles(id: string, n: number): P[] {
  let seed = 7 + id.length * 13;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed % 10000) / 10000; };
  return Array.from({ length: n }, (_, i) => {
    const t = 4 + rnd() * 5;
    return { x: rnd(), y: rnd(), d: rnd() * t, t, s: 0.6 + rnd() * 0.8, dx: Math.round(rnd() * 60 - 30), c: COLORS[i % COLORS.length], r: Math.round(rnd() * 360) };
  });
}

export function ProfileFx({ id, dense = 1 }: { id?: string | null; dense?: number }) {
  const def = EFFECTS.find((e) => e[0] === id);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const list = useMemo(() => (def ? particles(def[0], Math.max(2, Math.round(def[2] * dense))) : []), [def?.[0], dense]);
  if (!def) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {size.w > 0 ? <>
        {def[0] === 'embers' ? <View style={[StyleSheet.absoluteFill, { top: '60%', backgroundColor: 'rgba(255,90,20,0.12)' }]} /> : null}
        {list.map((p, i) => <Particle key={i} kind={def[0]} p={p} w={size.w} h={size.h} />)}
      </> : null}
    </View>
  );
}

function Particle({ kind, p, w, h }: { kind: string; p: P; w: number; h: number }) {
  const v = useSharedValue(0);
  const fall = kind === 'petals' || kind === 'snow' || kind === 'confetti';
  const rise = kind === 'hearts' || kind === 'embers';
  const dur = (fall ? (kind === 'snow' ? p.t * 1.3 : kind === 'confetti' ? p.t * 0.75 : p.t) : rise ? (kind === 'embers' ? p.t * 0.8 : p.t) : kind === 'stars' ? p.t * 0.5 : kind === 'aurora' ? p.t * 2.2 : p.t * 1.6) * 1000;
  useEffect(() => {
    const anim = withTiming(1, { duration: dur, easing: fall ? Easing.linear : rise ? Easing.in(Easing.quad) : Easing.inOut(Easing.sin) });
    // Endlosschleife; Sterne, Polarlicht, Glühwürmchen pendeln hin und zurück
    v.value = withDelay((p.d * 1000) % dur, withRepeat(anim, -1, !(fall || rise)));
  }, []);
  const a = useAnimatedStyle(() => {
    const k = v.value;
    if (fall) return { opacity: kind === 'snow' ? 0.88 : 0.92, transform: [{ translateX: p.x * w + p.dx * k }, { translateY: -0.06 * h + 1.12 * h * k }, { rotate: `${p.r + 420 * k}deg` }] };
    if (rise) return { opacity: interpolate(k, [0, 0.15, 1], [0, 0.95, 0]), transform: [{ translateX: p.x * w + p.dx * k }, { translateY: 1.04 * h - 1.12 * h * k }, { scale: 0.6 + 0.5 * k }] };
    if (kind === 'stars') return { opacity: 0.12 + 0.88 * k, transform: [{ translateX: p.x * w }, { translateY: p.y * h }, { scale: 0.5 + 0.5 * k }] };
    if (kind === 'aurora') return { opacity: 0.45, transform: [{ translateX: p.x * w - w * 0.35 + w * (-0.18 + 0.36 * k) }, { translateY: p.y * h - h * 0.3 + h * (-0.1 + 0.22 * k) }, { scale: 1 + 0.25 * k }] };
    // Glühwürmchen: leuchten auf und ab und schweben ein Stück
    return { opacity: 0.1 + 0.9 * Math.sin(k * Math.PI), transform: [{ translateX: p.x * w + p.dx * k }, { translateY: p.y * h - 30 * k }] };
  });
  const s = p.s;
  let body: React.ReactNode;
  switch (kind) {
    case 'petals': body = <View style={{ width: 10 * s, height: 13 * s, backgroundColor: '#ffb8d2', borderTopLeftRadius: 10, borderBottomRightRadius: 10, borderTopRightRadius: 2, borderBottomLeftRadius: 2 }} />; break;
    case 'snow': body = <View style={{ width: 6 * s, height: 6 * s, borderRadius: 4, backgroundColor: '#fff' }} />; break;
    case 'confetti': body = <View style={{ width: 7 * s, height: 11 * s, borderRadius: 2, backgroundColor: p.c }} />; break;
    case 'stars': body = <Animated.Text style={{ color: p.r % 3 === 0 ? '#ffe27a' : '#fff', fontSize: 12 * s }}>✦</Animated.Text>; break;
    case 'hearts': body = <Animated.Text style={{ color: '#ff5c8a', fontSize: 17 * s, textShadowColor: 'rgba(255,92,138,0.6)', textShadowRadius: 8 }}>♥</Animated.Text>; break;
    case 'embers': body = <View style={{ width: 4 * s, height: 4 * s, borderRadius: 3, backgroundColor: '#ffc15e', shadowColor: '#ff781e', shadowOpacity: 0.9, shadowRadius: 5 }} />; break;
    case 'fireflies': body = <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#f6ff8a', shadowColor: '#f0ff78', shadowOpacity: 1, shadowRadius: 6 }} />; break;
    case 'aurora': body = (
      <Svg width={w * 0.7} height={h * 0.6}>
        <Defs><RadialGradient id={'au' + p.r} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={p.c} stopOpacity="0.9" /><Stop offset="1" stopColor={p.c} stopOpacity="0" /></RadialGradient></Defs>
        <Rect width="100%" height="100%" fill={`url(#au${p.r})`} />
      </Svg>
    ); break;
    default: body = null;
  }
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, a]}>{body}</Animated.View>;
}
