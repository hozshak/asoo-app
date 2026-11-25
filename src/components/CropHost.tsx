// Bild selbst ausrichten vor dem Hochladen (Profilbild, Banner, Server-Bild …): ein Finger verschiebt, zwei Finger zoomen,
// dazu „−“/„+“. Ergebnis ist der Ausschnitt in Bild-Pixeln; zugeschnitten wird danach in lib/pick.ts (ImageManipulator).
// Aufruf über requestCrop() – das Fenster selbst hängt einmal ganz oben in _layout.tsx (<CropHost />).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './ui';
import { Icon } from './Icon';
import { t } from '@/lib/i18n';
import { C, GRAD } from '@/lib/theme';
import { LinearGradient } from 'expo-linear-gradient';

export type CropRect = { originX: number; originY: number; width: number; height: number };
type Req = { uri: string; w: number; h: number; aspect: number; round?: boolean; title?: string; resolve: (r: CropRect | null) => void };
let open: ((r: Req) => void) | null = null;

/** Fenster zeigen und auf den gewählten Ausschnitt warten (null = abgebrochen). Ohne Fenster: mittiger Ausschnitt. */
export function requestCrop(o: Omit<Req, 'resolve'>): Promise<CropRect | null> {
  return new Promise((resolve) => {
    if (!open) {
      const want = o.aspect, cw = o.w / o.h > want ? o.h * want : o.w, ch = o.w / o.h > want ? o.h : o.w / want;
      return resolve({ originX: (o.w - cw) / 2, originY: (o.h - ch) / 2, width: cw, height: ch });
    }
    open({ ...o, resolve });
  });
}

export function CropHost() {
  const [req, setReq] = useState<Req | null>(null);
  useEffect(() => { open = setReq; return () => { open = null; }; }, []);
  if (!req) return null;
  return <Cropper key={req.uri} req={req} done={(r) => { req.resolve(r); setReq(null); }} />;
}

function Cropper({ req, done }: { req: Req; done: (r: CropRect | null) => void }) {
  const win = useWindowDimensions();
  const ins = useSafeAreaInsets();
  const W = Math.min(win.width - 32, 440), H = Math.round(W / req.aspect);
  const base = Math.max(W / req.w, H / req.h);
  const [v, setV] = useState({ z: 1, x: (W - req.w * base) / 2, y: (H - req.h * base) / 2 });
  const cur = useRef(v); cur.current = v;
  const clamp = (z: number, x: number, y: number) => {
    z = Math.min(5, Math.max(1, z));
    const s = base * z, iw = req.w * s, ih = req.h * s;
    return { z, x: Math.min(0, Math.max(W - iw, x)), y: Math.min(0, Math.max(H - ih, y)) };
  };
  // um einen Punkt (im Rahmen) zoomen, damit das Bild unter den Fingern bleibt
  const zoomAt = (st: typeof v, nz: number, cx = W / 2, cy = H / 2) => {
    nz = Math.min(5, Math.max(1, nz));
    const k = nz / st.z;
    return clamp(nz, cx - (cx - st.x) * k, cy - (cy - st.y) * k);
  };
  const g = useRef<{ start: typeof v; dist: number; cx: number; cy: number } | null>(null);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { g.current = { start: cur.current, dist: 0, cx: W / 2, cy: H / 2 }; },
    onPanResponderMove: (e, gs) => {
      const ts = e.nativeEvent.touches;
      if (!g.current) return;
      if (ts.length >= 2) {
        const d = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
        if (!g.current.dist) { g.current = { start: cur.current, dist: d, cx: W / 2, cy: H / 2 }; return; }
        setV(zoomAt(g.current.start, g.current.start.z * (d / g.current.dist)));
      } else {
        if (g.current.dist) { g.current = { start: cur.current, dist: 0, cx: W / 2, cy: H / 2 }; return; } // von zwei auf einen Finger
        setV(clamp(g.current.start.z, g.current.start.x + gs.dx, g.current.start.y + gs.dy));
      }
    },
    onPanResponderRelease: () => { g.current = null; },
    onPanResponderTerminate: () => { g.current = null; },
  }), [W, H, base]);
  const s = base * v.z;
  const apply = () => {
    const x = Math.max(0, -v.x / s), y = Math.max(0, -v.y / s);
    done({ originX: Math.round(x), originY: Math.round(y), width: Math.round(Math.min(req.w - x, W / s)), height: Math.round(Math.min(req.h - y, H / s)) });
  };
  const B = W; // Rand für die Kreis-Abdunklung beim Profilbild
  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={() => done(null)} presentationStyle="fullScreen">
      <View style={[st.root, { paddingTop: ins.top + 10, paddingBottom: ins.bottom + 14 }]}>
        <View style={st.head}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('Abbrechen')} onPress={() => done(null)} hitSlop={10} style={st.headBtn}><Icon name="x" size={22} color="#fff" /></Pressable>
          <T style={st.title} numberOfLines={1}>{req.title || t('Bild ausrichten')}</T>
          <View style={st.headBtn} />
        </View>
        <View style={st.center}>
          <View {...pan.panHandlers} style={[st.frame, { width: W, height: H, borderRadius: req.round ? 0 : 14 }]}>
            <Image source={{ uri: req.uri }} style={{ position: 'absolute', left: v.x, top: v.y, width: req.w * s, height: req.h * s }} contentFit="fill" />
            {req.round
              ? <View pointerEvents="none" style={{ position: 'absolute', left: -B, top: -B, width: W + 2 * B, height: H + 2 * B, borderRadius: (W + 2 * B) / 2, borderWidth: B, borderColor: 'rgba(0,0,0,0.55)' }} />
              : null}
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', borderRadius: req.round ? W / 2 : 14 }]} />
          </View>
          <T style={st.hint}>{t('Ziehen zum Verschieben, mit zwei Fingern zoomen.')}</T>
          <View style={st.zoomRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Verkleinern')} onPress={() => setV(zoomAt(v, v.z / 1.25))} style={st.zoomBtn}><T style={st.zoomTxt}>−</T></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Vergrößern')} onPress={() => setV(zoomAt(v, v.z * 1.25))} style={st.zoomBtn}><T style={st.zoomTxt}>+</T></Pressable>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={apply} style={({ pressed }) => [st.ok, pressed && { opacity: 0.85 }]}>
          <LinearGradient colors={GRAD as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          <T style={st.okTxt}>{t('Übernehmen')}</T>
        </Pressable>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050a', paddingHorizontal: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  headBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  frame: { overflow: 'hidden', backgroundColor: '#000' },
  hint: { color: C.muted, fontSize: 13.5, textAlign: 'center' },
  zoomRow: { flexDirection: 'row', gap: 14 },
  zoomBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  zoomTxt: { color: '#fff', fontSize: 24, fontWeight: '700', lineHeight: 28 },
  ok: { height: 54, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  okTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
