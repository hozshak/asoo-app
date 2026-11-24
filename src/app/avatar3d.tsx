// 3D-Avatar – nativ (vorher die Web-Seite, die sich am iPhone per Doppeltippen vergrößerte): Figur wählen (Anime oder
// Realistisch, mit Vorschaubild), Farben für Haare, Augen, Haut und Kleidung, speichern. Die Liste der Figuren und
// Farben entspricht public/js/avatar3d.js in der Web-App (MODELS, *_COLORS) – bei neuen Figuren beide anpassen.
// Für die bewegte 3D-Ansicht gibt es „In 3D ansehen“ (Web-Vorschau).
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, BASE, errText } from '@/lib/api';
import { setState, useStore } from '@/lib/store';
import { openWeb } from '@/lib/web';
import { Btn, Card, Glow, Section, T, TopBar } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ColorRow, isHex } from '@/components/ColorPicker';
import { C } from '@/lib/theme';

type Model = { id: string; name: string; cat: 'anime' | 'real'; bottom?: boolean; fixed?: boolean };
const CATS: [Model['cat'], string][] = [['anime', 'Anime'], ['real', 'Realistisch']];
const MODELS: Model[] = [
  { id: 'shibu', name: 'Shibu', cat: 'anime', bottom: true }, { id: 'vita', name: 'Vita', cat: 'anime' }, { id: 'ren', name: 'Ren', cat: 'anime', bottom: true },
  { id: 'vivi', name: 'Vivi', cat: 'anime' }, { id: 'fumi', name: 'Fumi', cat: 'anime', bottom: true }, { id: 'rubin', name: 'Rubin', cat: 'anime' },
  { id: 'shino', name: 'Shino', cat: 'anime', bottom: true }, { id: 'mika', name: 'Mika', cat: 'anime' }, { id: 'yami', name: 'Yami', cat: 'anime' },
  { id: 'mx-boss', name: 'The Boss', cat: 'real', fixed: true }, { id: 'mx-remy', name: 'Remy', cat: 'real', fixed: true }, { id: 'mx-amy', name: 'Amy', cat: 'real', fixed: true },
  { id: 'mx-timmy', name: 'Timmy', cat: 'real', fixed: true }, { id: 'mx-jackie', name: 'Jackie', cat: 'real', fixed: true }, { id: 'mx-kachujin', name: 'Kachujin', cat: 'real', fixed: true },
];
// Index 0 = Originalfarbe der Figur
const HAIR = [null, '#17131a', '#4a2e1f', '#8a5a34', '#d9b36a', '#f1ece2', '#b8342e', '#ff7ab6', '#7c5cff', '#2e8bff', '#35c9a5', '#8d99a8'];
const EYES = [null, '#3a2a20', '#6b4a2b', '#3f7fd8', '#35b58a', '#8a8f9a', '#8f5cff', '#e0537a', '#e0a23a', '#d8413a'];
const SKIN = [null, '#f3d3bd', '#e2b594', '#c8946c', '#9a6644', '#6b432c'];
const CLOTH = [null, '#f4f4f6', '#1b1b22', '#6b7280', '#e5484d', '#f08c2e', '#f2c94c', '#3dbb7a', '#2e8bff', '#7c5cff', '#ff7ab6', '#7a4a2b'];
type Part = 'hair' | 'eyes' | 'skin' | 'top' | 'bottom' | 'shoes';
// hairC, eyesC … = frei gewählte Farbe (Farbwähler); hat Vorrang vor der Palette (wie in der Web-App)
type Cfg = { v: 2; m: string; hair: number; eyes: number; skin: number; top: number; bottom: number; shoes: number; hairC?: string; eyesC?: string; skinC?: string; topC?: string; bottomC?: string; shoesC?: string };
const PARTS: Part[] = ['hair', 'eyes', 'skin', 'top', 'bottom', 'shoes'];
const thumb = (id: string) => ({ uri: (BASE || 'https://zuno-app.altraex.workers.dev') + '/avatars/thumbs/' + id + '.webp' });
const int = (v: any, n: number) => (Number.isInteger(v) && v >= 0 && v < n ? v : 0);

export default function Avatar3D() {
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const me = useStore((s) => s.me) as any;
  const start = useMemo<Cfg>(() => {
    const c = me?.avatar3d || {};
    const out: Cfg = { v: 2, m: MODELS.some((x) => x.id === c.m) ? c.m : 'shibu', hair: int(c.hair, HAIR.length), eyes: int(c.eyes, EYES.length), skin: int(c.skin, SKIN.length), top: int(c.top, CLOTH.length), bottom: int(c.bottom, CLOTH.length), shoes: int(c.shoes, CLOTH.length) };
    for (const k of PARTS) if (isHex(c[k + 'C'])) (out as any)[k + 'C'] = String(c[k + 'C']).toLowerCase();
    return out;
  }, []);
  const [cfg, setCfg] = useState<Cfg>(start);
  const [saved, setSaved] = useState(JSON.stringify(start));
  const [cat, setCat] = useState<Model['cat']>(MODELS.find((x) => x.id === start.m)?.cat || 'anime');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!me) return null;
  const model = MODELS.find((x) => x.id === cfg.m) || MODELS[0];
  const set = (p: Partial<Cfg>) => { setCfg((c) => ({ ...c, ...p })); setMsg(''); };
  const dirty = JSON.stringify(cfg) !== saved;
  const save = async () => {
    setBusy(true);
    try {
      const d = await api<any>('PATCH', '/api/me', { avatar3d: cfg });
      setState((s) => ({ me: { ...s.me!, ...d.user } }));
      setSaved(JSON.stringify(cfg)); setMsg('Avatar gespeichert ✓');
    } catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
  };
  // eine Farb-Zeile je Körperteil: „A“ = Originalfarbe, fertige Farben, dazu jede eigene Farbe über den Farbwähler
  const part = (key: Part, list: (string | null)[], title: string) => {
    const own = (cfg as any)[key + 'C'] as string | undefined, idx = cfg[key];
    return (
      <View style={s.card}>
        <ColorRow title={title} value={own || list[idx] || null} presets={list.slice(1) as string[]}
          onChange={(c) => { const i = list.indexOf(c); set(i > 0 ? { [key]: i, [key + 'C']: undefined } as any : { [key + 'C']: c } as any); }}
          none={{ label: 'Originalfarbe', on: !own && idx === 0, onPick: () => set({ [key]: 0, [key + 'C']: undefined } as any), text: 'A' }} />
      </View>
    );
  };
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Glow />
      <TopBar title="3D-Avatar" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: ins.bottom + 110, gap: 12 }}>
        <View style={s.hero}>
          <Image source={thumb(model.id)} style={s.heroImg} contentFit="contain" transition={150} />
          <View style={{ flex: 1, gap: 6 }}>
            <T style={s.heroName}>{model.name}</T>
            <T style={s.heroSub}>{model.cat === 'real' ? 'Realistische Figur' : 'Anime-Figur'}</T>
            <Pressable accessibilityRole="button" onPress={() => openWeb(router, '/settings/avatar?solo=1')} style={s.view3d}>
              <Icon name="cube" size={15} color={C.text} /><T style={{ fontWeight: '700', fontSize: 13.5 }}>In 3D ansehen</T>
            </Pressable>
          </View>
        </View>

        <Section>Figur</Section>
        <View style={s.cats}>
          {CATS.map(([k, l]) => (
            <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: cat === k }} onPress={() => setCat(k)} style={[s.cat, cat === k && s.catOn]}>
              <T style={[s.catT, cat === k && { color: C.text }]}>{l} · {MODELS.filter((m) => m.cat === k).length}</T>
            </Pressable>
          ))}
        </View>
        <View style={s.grid}>
          {MODELS.filter((m) => m.cat === cat).map((m) => (
            <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={m.name} accessibilityState={{ selected: cfg.m === m.id }} onPress={() => set({ m: m.id })} style={[s.tile, cfg.m === m.id && s.tileOn]}>
              <Image source={thumb(m.id)} style={s.tileImg} contentFit="cover" transition={150} />
              <T style={s.tileT} numberOfLines={1}>{m.name}</T>
            </Pressable>
          ))}
        </View>

        {model.fixed ? <Card style={{ padding: 14 }}><T style={{ color: C.muted }}>Diese Figur ist fertig gestaltet – Farben lassen sich hier nicht ändern.</T></Card> : <>
          <Section>Haare</Section>{part('hair', HAIR, 'Haarfarbe')}
          <Section>Augen</Section>{part('eyes', EYES, 'Augenfarbe')}
          <Section>Haut</Section>{part('skin', SKIN, 'Hautfarbe')}
          <Section>{model.bottom ? 'Oberteil' : 'Outfit'}</Section>{part('top', CLOTH, model.bottom ? 'Farbe des Oberteils' : 'Farbe des Outfits')}
          {model.bottom ? <><Section>Hose / Rock</Section>{part('bottom', CLOTH, 'Farbe von Hose / Rock')}</> : null}
          <Section>Schuhe</Section>{part('shoes', CLOTH, 'Farbe der Schuhe')}
          <T style={{ color: C.faint, fontSize: 12.5 }}>„A“ = Originalfarbe der Figur. Über den bunten Kreis wählst du jede beliebige Farbe. In 3D siehst du sie über „In 3D ansehen“ (nach dem Speichern).</T>
        </>}
      </ScrollView>
      <View style={[s.bar, { paddingBottom: ins.bottom + 10 }]}>
        {msg ? <T style={{ color: msg.includes('✓') ? C.ok : C.warn, textAlign: 'center', marginBottom: 6 }}>{msg}</T> : null}
        <Btn title="Avatar speichern" icon="check" onPress={save} busy={busy} disabled={!dirty || busy} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 20, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line },
  heroImg: { width: 110, height: 110, borderRadius: 18, backgroundColor: C.bg3 },
  heroName: { fontSize: 22, fontWeight: '800' },
  heroSub: { color: C.muted, fontSize: 13.5 },
  view3d: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.line, marginTop: 4 },
  cats: { flexDirection: 'row', gap: 8 },
  cat: { paddingHorizontal: 14, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line },
  catOn: { backgroundColor: C.accentSoft, borderColor: C.accentLine },
  catT: { color: C.muted, fontWeight: '700', fontSize: 13.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '31%', flexGrow: 1, maxWidth: '32.5%', borderRadius: 16, overflow: 'hidden', backgroundColor: C.bg2, borderWidth: 2, borderColor: 'transparent' },
  tileOn: { borderColor: C.accent },
  tileImg: { width: '100%', aspectRatio: 1, backgroundColor: C.bg3 },
  tileT: { textAlign: 'center', fontWeight: '700', fontSize: 13, paddingVertical: 6 },
  card: { borderRadius: 18, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, padding: 10 },
  sw: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dot: { width: 38, height: 38, borderRadius: 19, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  dotOn: { borderColor: C.accent },
  fill: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  orig: { backgroundColor: C.bg3, alignItems: 'center', justifyContent: 'center' },
  origT: { color: C.muted, fontWeight: '800', fontSize: 12 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 10, backgroundColor: 'rgba(10,10,18,0.92)', borderTopWidth: 1, borderTopColor: C.line },
});
