// Farbwähler wie in Profi-Programmen: großes Feld (Sättigung × Helligkeit), Farbton-Leiste, Hex-Eingabe,
// fertige Paletten und die zuletzt benutzten Farben. Dazu ColorRow: eine Zeile mit schnellen Farbpunkten und
// „Eigene Farbe“ (öffnet den Wähler). Für Akzent-, Banner-, Server- und Avatar-Farben.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, T, tick } from './ui';
import { Icon } from './Icon';
import { C, F } from '@/lib/theme';

// ---------- Farbrechnung ----------
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const isHex = (s?: string | null) => !!s && /^#[0-9a-f]{6}$/i.test(s);
function hsvToHex(h: number, s: number, v: number) {
  const f = (n: number) => { const k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); };
  return '#' + [f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function hexToHsv(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  const h = !d ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, max ? d / max : 0, max];
}
/** dunkler Haken auf hellen Farben, heller auf dunklen */
const onColor = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 160 ? '#11121c' : '#ffffff'; };

/** Paletten: ToLobby-Farben, kräftig, pastell, dunkel/edel */
export const PALETTE: [string, string[]][] = [
  ['ToLobby', ['#8468ff', '#b260ff', '#ff5c9a', '#2ec5ff', '#3ddc97', '#ffb02e', '#ff6b3d', '#ff4d5e']],
  ['Kräftig', ['#5865f2', '#00c2a8', '#e04dff', '#ff3d3d', '#ffd400', '#1fd655', '#0096ff', '#ff7ab6']],
  ['Pastell', ['#b8a6ff', '#ffb3d1', '#a8e0ff', '#a8f0d0', '#ffe2a8', '#ffc2b0', '#d9c2ff', '#c8f0ff']],
  ['Edel', ['#d4af37', '#c0c5ce', '#b76e79', '#0f7a47', '#1b3a6b', '#5a1a2b', '#2b2d42', '#f5f0e6']],
];

// zuletzt benutzte Farben (bleiben auf dem Gerät)
const KEY = 'asoo.colors';
let recent: string[] = [];
let loaded = false;
async function loadRecent() {
  if (loaded) return; loaded = true;
  try { const v = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY); const a = JSON.parse(v || '[]'); if (Array.isArray(a)) recent = a.filter(isHex).slice(0, 8); } catch {}
}
function remember(hex: string) {
  recent = [hex, ...recent.filter((c) => c !== hex)].slice(0, 8);
  const v = JSON.stringify(recent);
  try { if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, v); else SecureStore.setItemAsync(KEY, v).catch(() => {}); } catch {}
}

/** Fläche zum Ziehen: meldet die Stelle als Anteil 0..1 (waagerecht, senkrecht) */
function useDrag(onMove: (x: number, y: number) => void) {
  const ref = useRef<any>(null);
  const box = useRef({ x: 0, y: 0, w: 1, h: 1 });
  const cb = useRef(onMove); cb.current = onMove;
  const ready = useRef(false); // erst ausmessen, wo die Fläche liegt – vorher würde der Knopf springen
  const at = (e: any) => { if (!ready.current) return; const b = box.current; cb.current(clamp((e.nativeEvent.pageX - b.x) / b.w), clamp((e.nativeEvent.pageY - b.y) / b.h)); };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => { ready.current = false; const ev = { nativeEvent: { pageX: e.nativeEvent.pageX, pageY: e.nativeEvent.pageY } }; ref.current?.measureInWindow((x: number, y: number, w: number, h: number) => { box.current = { x, y, w: w || 1, h: h || 1 }; ready.current = true; at(ev); }); },
    onPanResponderMove: at,
  }), []);
  return { ref, handlers: pan.panHandlers };
}

export function ColorPicker({ open, value, title = 'Farbe wählen', onClose, onPick }: { open: boolean; value?: string | null; title?: string; onClose: () => void; onPick: (hex: string) => void }) {
  const ins = useSafeAreaInsets();
  const start = isHex(value) ? value!.toLowerCase() : '#8468ff';
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(start));
  const [text, setText] = useState(start);
  const [, bump] = useState(0);
  useEffect(() => { if (open) { const h = hexToHsv(start); setHsv(h); setText(start); loadRecent().then(() => bump((n) => n + 1)); } }, [open, start]);
  const hex = hsvToHex(hsv[0], hsv[1], hsv[2]);
  const set = (h: [number, number, number]) => { setHsv(h); setText(hsvToHex(h[0], h[1], h[2])); };
  const setHex = (c: string) => { setHsv(hexToHsv(c)); setText(c.toLowerCase()); };
  const sv = useDrag((x, y) => set([hsv[0], x, 1 - y]));
  const hue = useDrag((x) => set([Math.min(359.9, x * 360), hsv[1], hsv[2]]));
  const typed = (s: string) => { const v = ('#' + s.replace(/[^0-9a-f]/gi, '')).slice(0, 7).toLowerCase(); setText(v); if (isHex(v)) setHsv(hexToHsv(v)); };
  const done = () => { tick(); remember(hex); onPick(hex); onClose(); };
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Schließen" />
        <View style={[s.sheet, { paddingBottom: ins.bottom + 14 }]}>
          <View style={s.grab} />
          <View style={s.head}>
            <T style={s.title}>{title}</T>
            <Pressable accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={10} onPress={onClose} style={s.x}><Icon name="x" size={18} color={C.text2} stroke={2.4} /></Pressable>
          </View>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Sättigung × Helligkeit */}
            <View ref={sv.ref} {...sv.handlers} style={[s.sv, { backgroundColor: hsvToHex(hsv[0], 1, 1) }]} accessibilityLabel="Sättigung und Helligkeit">
              <LinearGradient colors={['#ffffff', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(0,0,0,0)', '#000000']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
              <View pointerEvents="none" style={[s.knob, { left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%`, backgroundColor: hex }]} />
            </View>
            {/* Farbton */}
            <View ref={hue.ref} {...hue.handlers} style={s.hue} accessibilityLabel="Farbton">
              <LinearGradient colors={['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: 13 }]} />
              <View pointerEvents="none" style={[s.hueKnob, { left: `${(hsv[0] / 360) * 100}%`, backgroundColor: hsvToHex(hsv[0], 1, 1) }]} />
            </View>
            {/* vorher / neu + Hex */}
            <View style={s.row}>
              <View style={s.compare}>
                <Pressable accessibilityLabel="Vorherige Farbe" onPress={() => setHex(start)} style={[s.half, { backgroundColor: start, borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }]}><T style={[s.halfT, { color: onColor(start) }]}>Vorher</T></Pressable>
                <View style={[s.half, { backgroundColor: hex, borderTopRightRadius: 12, borderBottomRightRadius: 12 }]}><T style={[s.halfT, { color: onColor(hex) }]}>Neu</T></View>
              </View>
              <View style={s.hexBox}>
                <T style={s.hash}>#</T>
                <TextInput accessibilityLabel="Farbcode" value={text.replace('#', '').toUpperCase()} onChangeText={typed} autoCapitalize="characters" autoCorrect={false} maxLength={6} style={s.hexIn} placeholder="8468FF" placeholderTextColor={C.faint} />
              </View>
            </View>
            {recent.length ? <><T style={s.cap}>Zuletzt benutzt</T><View style={s.dots}>{recent.map((c) => <Dot key={c} c={c} on={c === hex} onPress={() => setHex(c)} />)}</View></> : null}
            {PALETTE.map(([name, list]) => (
              <View key={name}><T style={s.cap}>{name}</T><View style={s.dots}>{list.map((c) => <Dot key={c} c={c} on={c === hex} onPress={() => setHex(c)} />)}</View></View>
            ))}
          </ScrollView>
          <Btn title="Farbe übernehmen" icon="check" onPress={done} style={{ marginTop: 14 }} />
        </View>
      </View>
    </Modal>
  );
}

function Dot({ c, on, onPress, size = 32 }: { c: string; on: boolean; onPress: () => void; size?: number }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityLabel={c} accessibilityState={{ checked: on }} onPress={() => { tick(); onPress(); }} style={[{ width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, borderWidth: 2, borderColor: on ? C.text : 'transparent', alignItems: 'center', justifyContent: 'center' }]}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <Icon name="check" size={16} color={onColor(c)} stroke={3} /> : null}
      </View>
    </Pressable>
  );
}

/**
 * Zeile mit schnellen Farbpunkten und „Eigene Farbe“. none: zusätzlicher erster Punkt ohne feste Farbe
 * (z. B. „Standard“ beim Banner, „Original“ beim Avatar).
 */
export function ColorRow({ value, presets, onChange, title, none }: { value?: string | null; presets: string[]; onChange: (hex: string) => void; title?: string; none?: { label: string; on: boolean; onPick: () => void; colors?: string[]; text?: string } }) {
  const [open, setOpen] = useState(false);
  const v = isHex(value) ? value!.toLowerCase() : null;
  const own = !!v && !presets.includes(v) && !(none?.on);
  return (
    <>
      <View style={s.dots}>
        {none ? (
          <Pressable accessibilityRole="radio" accessibilityLabel={none.label} accessibilityState={{ checked: none.on }} onPress={() => { tick(); none.onPick(); }} style={[s.ring, none.on && { borderColor: C.text }]}>
            <View style={s.inner}>
              {none.colors ? <LinearGradient colors={none.colors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
              {none.text ? <T style={s.noneT}>{none.text}</T> : null}
            </View>
          </Pressable>
        ) : null}
        {presets.map((c) => <Dot key={c} c={c} on={!none?.on && v === c} onPress={() => onChange(c)} />)}
        {/* Eigene Farbe: Regenbogen-Ring mit Plus – oder die gewählte eigene Farbe */}
        <Pressable accessibilityRole="button" accessibilityLabel="Eigene Farbe wählen" onPress={() => { tick(); setOpen(true); }} style={[s.ring, own && { borderColor: C.text }]}>
          <View style={s.inner}>
            {own ? <View style={[StyleSheet.absoluteFill, { backgroundColor: v! }]} /> : <LinearGradient colors={['#ff5c8a', '#ffb02e', '#3ddc97', '#2ec5ff', '#8468ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
            <Icon name={own ? 'edit' : 'plus'} size={15} color={own ? onColor(v!) : '#fff'} stroke={2.6} />
          </View>
        </Pressable>
      </View>
      <ColorPicker open={open} value={v || presets[0]} title={title} onClose={() => setOpen(false)} onPick={onChange} />
    </>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { maxHeight: '92%', backgroundColor: C.bg2, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderColor: C.line },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { flex: 1, fontSize: 19, fontWeight: '800' },
  x: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.bg4, alignItems: 'center', justifyContent: 'center' },
  sv: { height: 190, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.line },
  knob: { position: 'absolute', width: 28, height: 28, marginLeft: -14, marginTop: -14, borderRadius: 14, borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  hue: { height: 26, borderRadius: 13, marginTop: 14, borderWidth: 1, borderColor: C.line },
  hueKnob: { position: 'absolute', top: -4, width: 32, height: 32, marginLeft: -16, borderRadius: 16, borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  row: { flexDirection: 'row', gap: 10, marginTop: 16 },
  compare: { flex: 1, flexDirection: 'row', height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.line },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  halfT: { fontSize: 12, fontWeight: '800' },
  hexBox: { width: 132, height: 46, borderRadius: 12, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  hash: { color: C.muted, fontSize: 16, fontWeight: '700', marginRight: 2 },
  hexIn: { flex: 1, color: C.text, fontSize: 16, fontFamily: F.bold, letterSpacing: 1, padding: 0, height: '100%' },
  cap: { color: C.muted, fontSize: 12.5, fontWeight: '700', marginTop: 14, marginBottom: 6, marginLeft: 2 },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  ring: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  inner: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  noneT: { color: C.text2, fontWeight: '800', fontSize: 12 },
});
