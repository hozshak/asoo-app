// Profil-Effekte wie in der Web-App (public/js/fx.js): Ebenen aus gerenderten Teilchen-Bildern (assets/fx) in
// verschiedener Tiefe – fern klein und blass, nah groß und unscharf. Die Beschreibung (lib/fx-data.ts) und die Bilder
// (lib/fx-sprites.ts) erzeugt tools/build-fx.mjs der Web-App; dort ändern, dann neu bauen – nicht hier.
// Lage und Tempo jedes Teilchens sind fest „gewürfelt“ (gleicher Zufall wie im Web) – bei jedem gleich.
import { memo, useEffect, useMemo, useState } from 'react';
import { Image as RNImage, Platform, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, interpolate } from 'react-native-reanimated';
import { FX } from '@/lib/fx-data';
import { SPRITES } from '@/lib/fx-sprites';

/** [Kennung, Name] – Reihenfolge wie in der Auswahl der Web-App */
export const EFFECTS: [string, string][] = FX.map((e) => [e.id, e.name]);
const REF_W = 300, REF_H = 380; // Größe, für die Anzahl und Maße in fx-data gedacht sind
const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (r: number, range: number[]) => range[0] + (range[1] - range[0]) * r;

type P = { i: number; x: number; y: number; size: number; dur: number; delay: number; sway: number; swayDur: number; phase: number; drift: number; spin: number; flip: number; rock: number; op: number; r0: number; sprite: string; tint: string | null };
/** fester Zufall je Effekt und Ebene – genau wie fxRand/fxParticles in public/js/fx.js */
function fxRand(key: string) {
  let seed = 7;
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) % 2147483647;
  seed = seed || 7;
  return () => { seed = (seed * 16807) % 2147483647; return (seed % 100000) / 100000; };
}
function fxParticles(def: any, li: number, count: number): P[] {
  const L = def.layers[li], rnd = fxRand(def.id + ':' + li);
  return Array.from({ length: count }, (_, i) => {
    const p: P = { i, x: rnd(), y: rnd(), size: lerp(rnd(), L.size || [10, 10]), dur: lerp(rnd(), L.dur), delay: rnd(), sway: lerp(rnd(), L.sway || [0, 0]), swayDur: lerp(rnd(), L.swayDur || [3, 3]), phase: rnd(), drift: lerp(rnd(), L.drift || [0, 0]),
      spin: lerp(rnd(), L.spin || [0, 0]), flip: lerp(rnd(), L.flip || [0, 0]), rock: lerp(rnd(), L.rock || [0, 0]), op: lerp(rnd(), L.op || [1, 1]), r0: rnd() * 360, sprite: L.s[Math.floor(rnd() * L.s.length) % L.s.length], tint: null };
    const tr = rnd();
    if (L.tint) p.tint = L.tint[Math.floor(tr * L.tint.length) % L.tint.length];
    if (L.y) p.y = L.y[0] + (L.y[1] - L.y[0]) * p.y;
    return p;
  });
}

export function ProfileFx({ id, dense = 1 }: { id?: string | null; dense?: number }) {
  const def = FX.find((e) => e.id === id);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const quiet = useReducedMotion();
  const W = size.w, H = size.h;
  const layers = useMemo(() => {
    if (!def || !W || !H) return [];
    const f = clamp(((W * H) / (REF_W * REF_H)) * dense, 0.3, 1.3);
    return def.layers.map((L: any, li: number) => ({ L, li, list: fxParticles(def, li, L.m === 'scroll' ? 1 : Math.max(1, Math.round(L.n * f))) }));
  }, [def?.id, W, H, dense]);
  if (!def) return null;
  const k = clamp(W / REF_W, 0.5, 1.25);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, def.blend === 'screen' ? ({ mixBlendMode: 'screen' } as any) : null]} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (Math.abs(width - W) > 2 || Math.abs(height - H) > 2) setSize({ w: width, h: height }); }}>
      {W > 0 && def.amb ? <LinearGradient colors={def.amb.side === 'top' ? [`rgba(${def.amb.rgb},${def.amb.a})`, `rgba(${def.amb.rgb},0)`] : [`rgba(${def.amb.rgb},0)`, `rgba(${def.amb.rgb},${def.amb.a})`]}
        style={{ position: 'absolute', left: 0, right: 0, height: def.amb.size * H, ...(def.amb.side === 'top' ? { top: 0 } : { bottom: 0 }) }} /> : null}
      {layers.map(({ L, li, list }: any) => list.map((p: P) => (L.m === 'scroll'
        ? <Strip key={def.id + li} L={L} p={p} W={W} H={H} k={k} quiet={quiet} />
        : <Particle key={def.id + li + '-' + p.i} L={L} p={p} W={W} H={H} k={k} quiet={quiet} />)))}
    </View>
  );
}

/** Teilchen-Bild. Weiße Bilder werden eingefärbt: am iPhone über tintColor, in der Browser-Vorschau über eine CSS-Maske. */
function Sprite({ spr, w, h, tint, blur }: { spr: { a: number; tint: number; src: any }; w: number; h: number; tint: string | null; blur: number }) {
  if (Platform.OS === 'web' && spr.tint) {
    let uri = '';
    try { uri = (RNImage as any).resolveAssetSource(spr.src)?.uri || ''; } catch {}
    if (uri) return <View style={{ width: w, height: h, backgroundColor: tint || '#fff', maskImage: `url(${uri})`, WebkitMaskImage: `url(${uri})`, maskSize: '100% 100%', WebkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', filter: blur ? `blur(${blur}px)` : undefined } as any} />;
  }
  return <Image source={spr.src} style={{ width: w, height: h }} contentFit="fill" tintColor={tint || undefined} blurRadius={blur} />;
}

/** ein Teilchen: Bahn, Pendeln, Kippen, Drehen und Deckkraft aus einem einzigen Zeitwert (0 → 1 je Runde) */
const Particle = memo(function Particle({ L, p, W, H, k, quiet }: { L: any; p: P; W: number; H: number; k: number; quiet: boolean }) {
  const spr = SPRITES[p.sprite] || SPRITES.glow;
  const size = p.size * k, w = spr.a >= 1 ? size : size * spr.a, h = spr.a >= 1 ? size / spr.a : size;
  const v = useSharedValue(quiet ? p.y : p.delay);
  useEffect(() => { if (quiet) return; v.value = p.delay; v.value = withRepeat(withTiming(p.delay + 1, { duration: p.dur * 1000, easing: Easing.linear }), -1, false); }, [quiet]);
  // Werte, die sich nicht ändern, außerhalb des Zeichen-Takts ausrechnen
  const m: string = L.m, cycles = Math.max(1, Math.round(p.dur / p.swayDur)), sway = p.sway * k, drift = p.drift * k, lo = L.lo ?? (m === 'float' ? 0.3 : 0), fade: string = L.fade || '', tilt: number = L.tilt || 0, angle: number = L.angle || 0;
  const y0 = -size - 0.06 * H, y1 = H + size, pulse: number = L.pulse || 1, s0 = 0.35 + 0.5 * lo, hasSpin = !!(L.spin || L.flip);
  const vis = clamp(1.05 / p.dur, 0.08, 0.4), th = ((angle || 148) * Math.PI) / 180, travel = W * 1.15;
  const a = useAnimatedStyle(() => {
    const t = v.value % 1;
    if (m === 'fall' || m === 'rise') {
      const y = m === 'fall' ? y0 + (y1 - y0) * t : y1 + (y0 - y1) * t, sw = Math.sin(TAU * (t * cycles + p.phase));
      const opacity = fade === 'ends' ? interpolate(t, [0, 0.1, 0.78, 1], [0, p.op, p.op, 0]) : fade === 'out' ? interpolate(t, [0, 0.08, 0.55, 1], [0, p.op, p.op * 0.7, 0]) : p.op;
      const rot = tilt ? tilt * Math.sin(TAU * (t * cycles * 0.77 + p.phase)) : angle ? angle : hasSpin ? p.r0 + p.spin * t : 0;
      return { opacity, transform: [{ translateX: p.x * W + drift * t + sway * sw - w / 2 }, { translateY: y - h / 2 }, { perspective: 400 }, { rotateX: `${p.rock * sw + p.flip * t}deg` }, { rotateY: `${-p.rock * 0.6 * sw + p.flip * 0.7 * t}deg` }, { rotate: `${rot}deg` }] };
    }
    if (m === 'float') {
      const s = 0.5 - 0.5 * Math.cos(TAU * (t * pulse + p.r0 / 360));
      return { opacity: p.op * (lo + (1 - lo) * s), transform: [{ translateX: p.x * W + sway * Math.sin(TAU * (t + p.phase)) - w / 2 }, { translateY: p.y * H + sway * 0.6 * Math.sin(TAU * (t * 2 + p.delay)) - h / 2 }, { scale: 0.88 + 0.18 * s }] };
    }
    if (m === 'twinkle') {
      const s = 0.5 - 0.5 * Math.cos(TAU * t);
      return { opacity: p.op * (lo + (1 - lo) * s), transform: [{ translateX: p.x * W - w / 2 }, { translateY: p.y * H - h / 2 }, { scale: s0 + (1 - s0) * s }, { rotate: `${(p.r0 % 30) + p.spin * t}deg` }] };
    }
    // Sternschnuppe: zieht kurz und schnell durch, dann lange Pause
    const mm = Math.min(1, t / vis);
    return { opacity: t < vis ? interpolate(mm, [0, 0.15, 0.6, 1], [0, p.op, p.op, 0]) : 0,
      transform: [{ translateX: (0.35 + p.x * 0.75) * W + Math.cos(th) * travel * mm - w / 2 }, { translateY: (p.y * 0.5 - 0.12) * H + Math.sin(th) * travel * mm - h / 2 }, { rotate: `${angle || 148}deg` }] };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h }, a]}>
      <Sprite spr={spr} w={w} h={h} tint={p.tint} blur={L.blur ? L.blur * k : 0} />
    </Animated.View>
  );
});

/** Nebel, Polarlicht: ein nahtloses Band (zwei gleiche Bilder nebeneinander), das langsam durchzieht */
const Strip = memo(function Strip({ L, p, W, H, k, quiet }: { L: any; p: P; W: number; H: number; k: number; quiet: boolean }) {
  const spr = SPRITES[p.sprite] || SPRITES.fog;
  const v = useSharedValue(p.delay);
  useEffect(() => { if (quiet) return; v.value = p.delay; v.value = withRepeat(withTiming(p.delay + 1, { duration: p.dur * 1000, easing: Easing.linear }), -1, false); }, [quiet]);
  const dir: number = L.dir || 1, h = (L.h || 1) * H;
  const a = useAnimatedStyle(() => { const t = v.value % 1; return { transform: [{ translateX: dir > 0 ? -W * t : -W * (1 - t) }] }; });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: (L.top || 0) * H, width: W * 2, height: h, flexDirection: 'row', opacity: p.op }, a]}>
      {[0, 1].map((n) => <Sprite key={n} spr={spr} w={W} h={h} tint={p.tint} blur={L.blur ? L.blur * k : 0} />)}
    </Animated.View>
  );
});
