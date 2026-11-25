// „Profil gestalten“: eine Seite für alles, was das Profil ausmacht – oben die Live-Vorschau (Banner, Profilbild mit
// bewegtem Rahmen, Name im gewählten Stil, Effekt), darunter vier Bereiche: Bild & Farben · Rahmen · Name · Effekt.
// Antippen zeigt die Änderung sofort in der Vorschau und speichert sie (bei einem Fehler springt sie zurück).
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { api, errText, mediaSource, upload } from '@/lib/api';
import { setState, useStore } from '@/lib/store';
import { pickImage as chooseImage } from '@/lib/pick';
import { FRAMES, type Frame } from '@/lib/frames';
import { Avatar, Glow, T, TopBar, tick } from './ui';
import { Icon, type IconName } from './Icon';
import { NameText, NAME_STYLES } from './NameText';
import { EFFECTS, ProfileFx } from './ProfileFx';
import { ColorRow } from './ColorPicker';
import { C } from '@/lib/theme';
import { t } from '@/lib/i18n';

export type StudioTab = 'look' | 'frame' | 'name' | 'effect';
const TABS: [StudioTab, string, IconName][] = [['look', t("Bild & Farben"), 'image'], ['frame', t("Rahmen"), 'sparkle'], ['name', t("Name"), 'edit'], ['effect', t("Effekt"), 'moon']];
const ACCENTS = ['#8468ff', '#ff5c8a', '#2ec5ff', '#3ddc97', '#ffb02e', '#ff6b3d', '#e04dff', '#5865f2'];
const GOLD = '#ffd86b';

export function Studio({ tab: first }: { tab: StudioTab }) {
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const me = useStore((s) => s.me) as any;
  const [tab, setTab] = useState<StudioTab>(first);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState<'' | 'avatar' | 'banner'>('');
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 2200); return () => clearTimeout(t); }, [msg]);
  if (!me) return null;

  /** sofort zeigen, dann speichern – bei einem Fehler zurück auf vorher */
  const patch = async (body: Record<string, any>, ok = 'Gespeichert ✓') => {
    const before = Object.fromEntries(Object.keys(body).map((k) => [k, me[k]]));
    setState((s) => ({ me: { ...s.me!, ...body } }));
    try { const d = await api<any>('PATCH', '/api/me', body); setState((s) => ({ me: { ...s.me!, ...d.user } })); setMsg(ok); }
    catch (e) { setState((s) => ({ me: { ...s.me!, ...before } })); setMsg(errText(e)); }
  };
  const pick = async (kind: 'avatar' | 'banner') => {
    const r = await chooseImage({ title: kind === 'avatar' ? t("Profilbild ändern") : t("Banner ändern"), crop: kind === 'avatar' ? [1, 1] : [3, 1], quality: 0.75, maxSide: kind === 'avatar' ? 1024 : 1600 });
    if (!r) return;
    setBusy(kind);
    try { const up = await upload(kind, r.uri, r.mime); const d = await api<any>('PATCH', '/api/me', { [kind]: up.key }); setState((s) => ({ me: { ...s.me!, ...d.user } })); setMsg(kind === 'avatar' ? t("Profilbild gespeichert ✓") : t("Banner gespeichert ✓")); }
    catch (e) { setMsg(errText(e)); }
    setBusy('');
  };

  const banner = mediaSource(me.banner);
  const col3 = (width - 28 - 20) / 3, col2 = (width - 28 - 10) / 2;
  const deco = me.deco || 'none', style = me.name_style || 'default', effect = me.effect || 'none';
  const premium = Object.values(FRAMES).filter((f) => f.premium), rings = Object.values(FRAMES).filter((f) => !f.premium);

  const frameTile = (f: Frame | null) => {
    const id = f ? f.id : 'none', on = f ? deco === f.id : !FRAMES[deco];
    const size = f ? Math.min(56, 88 / Math.max(f.w, f.h)) : 52;
    return (
      <Pressable key={id} accessibilityRole="radio" accessibilityLabel={f ? f.name : t("Kein Rahmen")} accessibilityState={{ checked: on }} onPress={() => { tick(); patch({ deco: id }, f ? 'Rahmen gesetzt ✓' : 'Rahmen entfernt'); }}
        style={[st.tile, { width: col3, height: col3 * 1.24 }, f?.premium && st.tilePremium, on && st.tileOn]}>
        <View style={st.tileArt}><Avatar user={{ ...me, deco: id }} size={size} force live={on && !!f} /></View>
        <T style={[st.tileName, st.tileName2, on && { color: C.text }]} numberOfLines={2}>{f ? f.name : t("Kein Rahmen")}</T>
        {on ? <Check /> : null}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <Glow />
      <TopBar title={t("Profil gestalten")} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      {/* Live-Vorschau */}
      <View style={st.preview}>
        {banner ? <Image source={banner} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          : <LinearGradient colors={[me.banner_color || me.accent || C.accent, me.banner_color ? shade(me.banner_color) : '#ff5c8a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
        <LinearGradient colors={['rgba(10,10,18,0)', 'rgba(10,10,18,0.55)', 'rgba(10,10,18,0.94)']} locations={[0.2, 0.62, 1]} style={StyleSheet.absoluteFill} />
        <ProfileFx id={me.effect} dense={0.85} />
        <View style={st.pvRow}>
          <Avatar user={me} size={76} force live />
          <View style={{ flex: 1, minWidth: 0, marginLeft: 20 }}>
            <NameText name={me.display || me.username} styleId={me.name_style} style={st.pvName} live />
            <T style={st.pvHandle} numberOfLines={1}>@{me.username}</T>
          </View>
        </View>
        <View style={st.pvTag}><View style={st.pvDot} /><T style={st.pvTagT}>{t("Vorschau")}</T></View>
      </View>
      {/* Bereiche */}
      <View style={st.tabs}>
        {TABS.map(([k, label, icon]) => {
          const on = tab === k;
          return (
            <Pressable key={k} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={() => { tick(); setTab(k); }} style={[st.tab, on && st.tabOn]}>
              <Icon name={icon} size={18} color={on ? '#fff' : C.muted} stroke={2.2} />
              <T style={[st.tabT, on && { color: '#fff' }]} numberOfLines={1}>{label}</T>
            </Pressable>
          );
        })}
      </View>

      <ScrollView key={tab} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: ins.bottom + 70 }} showsVerticalScrollIndicator={false}>
        {tab === 'look' ? (
          <Animated.View entering={FadeIn.duration(160)}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Big icon="user" title={t("Profilbild")} sub={busy === 'avatar' ? t("Lädt hoch …") : t("Foto oder Bild wählen")} onPress={() => pick('avatar')} />
              <Big icon="image" title={t("Banner")} sub={busy === 'banner' ? t("Lädt hoch …") : t("Bild hinter dem Profil")} onPress={() => pick('banner')} />
            </View>
            {me.avatar || me.banner ? (
              <View style={{ flexDirection: 'row', gap: 18, marginTop: 10, marginLeft: 4 }}>
                {me.avatar ? <T style={st.link} onPress={() => patch({ avatar: null }, 'Profilbild entfernt')}>{t("Profilbild entfernen")}</T> : null}
                {me.banner ? <T style={st.link} onPress={() => patch({ banner: null }, 'Banner entfernt')}>{t("Banner entfernen")}</T> : null}
              </View>
            ) : null}
            <Head title={t("Akzentfarbe")} sub={t("Für dein Profil, deinen 3D-Avatar und das Leuchten um deinen Namen.")} />
            <View style={st.card}><ColorRow title={t("Akzentfarbe")} value={me.accent} presets={ACCENTS} onChange={(c) => patch({ accent: c }, 'Farbe gesetzt ✓')} /></View>
            <Head title={t("Bannerfarbe")} sub={me.banner ? t("Gilt, sobald kein Banner-Bild gesetzt ist.") : t("Die Farbe hinter deinem Profil, solange du kein Banner-Bild hast.")} />
            <View style={st.card}>
              <ColorRow title={t("Bannerfarbe")} value={me.banner_color} presets={ACCENTS} onChange={(c) => patch({ banner_color: c }, 'Farbe gesetzt ✓')}
                none={{ label: t("Standard"), on: !me.banner_color, onPick: () => patch({ banner_color: null }, 'Farbe gesetzt ✓'), colors: [me.accent || C.accent, '#ff5c8a'] }} />
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push('/avatar3d')} style={({ pressed }) => [st.rowLink, pressed && { backgroundColor: C.bg4 }]}>
              <View style={st.rowIcon}><Icon name="cube" size={19} color={C.accent} /></View>
              <View style={{ flex: 1 }}><T style={{ fontWeight: '700', fontSize: 15.5 }}>{t("3D-Avatar gestalten")}</T><T style={{ color: C.muted, fontSize: 12.5 }}>{t("Figur, Haare, Haut und Kleidung – jede Farbe frei wählbar")}</T></View>
              <View style={{ transform: [{ rotate: '-90deg' }] }}><Icon name="chevron" size={15} color={C.muted} stroke={2.4} /></View>
            </Pressable>
          </Animated.View>
        ) : tab === 'frame' ? (
          <Animated.View entering={FadeIn.duration(160)}>
            <Pressable accessibilityRole="radio" accessibilityLabel={t("Kein Rahmen")} accessibilityState={{ checked: !FRAMES[deco] }} onPress={() => { tick(); patch({ deco: 'none' }, 'Rahmen entfernt'); }} style={[st.noneRow, !FRAMES[deco] && st.tileOn]}>
              <View style={st.noneIcon}><Icon name="minusCircle" size={18} color={C.text2} /></View>
              <T style={{ flex: 1, fontWeight: '700', fontSize: 15 }}>{t("Kein Rahmen")}</T>
              {!FRAMES[deco] ? <View style={[st.check, { position: 'relative', right: 0, top: 0 }]}><Icon name="check" size={12} color="#fff" stroke={3.2} /></View> : null}
            </Pressable>
            <Head title={t("Premium")} icon="sparkle" gold sub={t("Echt in 3D gerendert – das Licht wandert über Gold, Diamanten und Kristall.")} />
            <View style={st.grid}>{premium.map(frameTile)}</View>
            <Head title={t("Leuchtringe")} sub={t("Schlanke Ringe aus Licht.")} />
            <View style={st.grid}>{rings.map(frameTile)}</View>
          </Animated.View>
        ) : tab === 'name' ? (
          <Animated.View entering={FadeIn.duration(160)}>
            <Head title={t("Namens-Stil")} sub={t("So sehen andere deinen Namen im Chat und auf deinem Profil.")} first />
            <View style={st.grid}>
              {NAME_STYLES.map(([k, label, , kind]) => {
                const on = style === k;
                return (
                  <Pressable key={k} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: on }} onPress={() => { tick(); patch({ name_style: k }, 'Namens-Stil gesetzt ✓'); }}
                    style={[st.tile, st.nameTile, { width: col2 }, kind === 'metal' && st.tilePremium, on && st.tileOn]}>
                    <NameText name={me.display || me.username} styleId={k} style={st.nameDemo} live={on} />
                    <T style={[st.tileName, on && { color: C.text }]} numberOfLines={1}>{label}</T>
                    {on ? <Check /> : null}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(160)}>
            <Head title={t("Profil-Effekt")} sub={t("Liegt über deinem Profil und deiner Profilkarte.")} first />
            <View style={st.grid}>
              {[['none', 'Kein Effekt'] as [string, string], ...EFFECTS.map(([k, l]) => [k, l] as [string, string])].map(([k, label]) => {
                const on = effect === k;
                return (
                  <Pressable key={k} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: on }} onPress={() => { tick(); patch({ effect: k }, k === 'none' ? 'Effekt entfernt' : 'Effekt gesetzt ✓'); }}
                    style={[st.tile, st.fxTile, { width: col2 }, on && st.tileOn]}>
                    <View style={st.fxDemo}>
                      <LinearGradient colors={['#2c2456', '#15142a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                      {k === 'none' ? <View style={st.fxNone}><Icon name="minusCircle" size={22} color={C.faint} /></View> : <ProfileFx id={k} dense={0.5} />}
                    </View>
                    <T style={[st.tileName, { marginTop: 8 }, on && { color: C.text }]} numberOfLines={1}>{label}</T>
                    {on ? <Check /> : null}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        )}
      </ScrollView>
      {msg ? <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOut.duration(140)} style={[st.toast, { bottom: ins.bottom + 18 }]} pointerEvents="none"><T style={{ fontWeight: '700' }}>{msg}</T></Animated.View> : null}
    </View>
  );
}

const Check = () => <View style={st.check}><Icon name="check" size={12} color="#fff" stroke={3.2} /></View>;
function Head({ title, sub, icon, gold, first }: { title: string; sub?: string; icon?: IconName; gold?: boolean; first?: boolean }) {
  return (
    <View style={{ marginTop: first ? 8 : 22, marginBottom: 10, marginLeft: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Icon name={icon} size={15} color={gold ? GOLD : C.text2} stroke={2.4} /> : null}
        <T style={[st.headT, gold && { color: GOLD }]}>{title}</T>
      </View>
      {sub ? <T style={st.headSub}>{sub}</T> : null}
    </View>
  );
}
function Big({ icon, title, sub, onPress }: { icon: IconName; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t("{0} ändern", { 0: title })} onPress={() => { tick(); onPress(); }} style={({ pressed }) => [st.big, pressed && { backgroundColor: C.bg4 }]}>
      <View style={st.rowIcon}><Icon name={icon} size={19} color={C.accent} /></View>
      <T style={{ fontWeight: '800', fontSize: 15.5, marginTop: 10 }}>{title}</T>
      <T style={{ color: C.muted, fontSize: 12.5 }} numberOfLines={1}>{sub}</T>
    </Pressable>
  );
}
function shade(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) return '#ff5c8a';
  const n = parseInt(m[1], 16), r = Math.max(0, (n >> 16) - 70), g = Math.max(0, ((n >> 8) & 255) - 70), b = Math.max(0, (n & 255) - 40);
  return `rgb(${r},${g},${b})`;
}

const st = StyleSheet.create({
  preview: { marginHorizontal: 14, height: 168, borderRadius: 22, overflow: 'hidden', backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line },
  pvRow: { position: 'absolute', left: 26, right: 16, bottom: 22, flexDirection: 'row', alignItems: 'center' },
  pvName: { fontSize: 23, fontWeight: '800' },
  pvHandle: { color: C.text2, fontSize: 13.5, marginTop: -2 },
  pvTag: { position: 'absolute', right: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.42)' },
  pvDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.ok },
  pvTagT: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, marginTop: 12, marginBottom: 8 },
  tab: { flex: 1, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line },
  tabOn: { backgroundColor: C.accent, borderColor: 'rgba(255,255,255,0.22)', shadowColor: C.accent, shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  tabT: { color: C.muted, fontSize: 11.5, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { borderRadius: 18, backgroundColor: C.bg2, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 9, overflow: 'hidden' },
  tilePremium: { borderColor: 'rgba(255,216,107,0.22)', backgroundColor: '#17172a' },
  tileOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  tileArt: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  tileName: { color: C.muted, fontSize: 12, fontWeight: '700', paddingHorizontal: 6 },
  tileName2: { height: 32, lineHeight: 15.5, textAlign: 'center', textAlignVertical: 'center' },
  noneRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 56, paddingHorizontal: 12, marginTop: 4, borderRadius: 18, backgroundColor: C.bg2, borderWidth: 1.5, borderColor: C.line },
  noneIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.bg4, alignItems: 'center', justifyContent: 'center' },
  check: { position: 'absolute', right: 7, top: 7, width: 20, height: 20, borderRadius: 10, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  nameTile: { height: 86, justifyContent: 'center', paddingBottom: 0, paddingHorizontal: 10, gap: 3 },
  nameDemo: { fontSize: 21, fontWeight: '800', maxWidth: '100%' },
  fxTile: { padding: 8, paddingBottom: 10, justifyContent: 'flex-start' },
  fxDemo: { alignSelf: 'stretch', height: 84, borderRadius: 12, overflow: 'hidden' },
  fxNone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headT: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: C.text2 },
  headSub: { color: C.muted, fontSize: 12.5, marginTop: 1 },
  card: { borderRadius: 18, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, padding: 10 },
  big: { flex: 1, borderRadius: 18, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, padding: 14 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rowLink: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22, padding: 12, borderRadius: 18, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line },
  link: { color: C.danger, fontSize: 13.5, fontWeight: '600' },
  toast: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 16, height: 40, borderRadius: 20, backgroundColor: 'rgba(36,38,58,0.97)', borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
});
