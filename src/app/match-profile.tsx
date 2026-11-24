// „Mitspieler finden“ – Gamer-Profil. Beim ersten Mal eine kurze geführte Einrichtung (4 Schritte: Spiele, Zeiten,
// Stil & Plattform, Über dich); danach eine Seite zum Bearbeiten mit Sichtbarkeit, Vorschau („So sehen dich andere“),
// blockierten Karten und Löschen. Profilbild, Banner und Rahmen kommen aus dem normalen Asoo-Profil.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useStore } from '@/lib/store';
import { LANG_NAME, LOOKING, PLATFORM, STYLE, deleteProfile, loadSelf, matchErr, saveProfile, unblockAll, type MatchCard, type MatchSelf } from '@/lib/match';
import { GameChip, MatchCardView, TimeGrid } from '@/components/MatchBits';
import { Btn, Glow, T, TopBar } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { C, GRAD, GRAD_POS, HOME } from '@/lib/theme';

type Draft = { games: string[]; platforms: string[]; langs: string[]; looking: string[]; times: number; style: string; mic: boolean; about: string; visible: boolean };
const tap = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };
// Schnellwahl fürs Raster: Abends Mo–Fr, Nachmittag + Abend am Wochenende
let WEEK = 0, WEEKEND = 0;
for (let d = 0; d < 5; d++) WEEK |= 1 << (d * 4 + 2);
for (let d = 5; d < 7; d++) for (const sl of [1, 2]) WEEKEND |= 1 << (d * 4 + sl);
const STEPS = ['Was spielst du?', 'Wann hast du Zeit?', 'Wie und womit spielst du?', 'Über dich'];

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { tap(); onPress(); }} style={[s.chip, on && s.chipOn]}>
      <T style={[s.chipText, on && { color: '#c9bcff' }]}>{label}</T>
    </Pressable>
  );
}
const Head = ({ title, hint }: { title: string; hint?: string }) => <View style={{ marginBottom: 12 }}><T style={s.h}>{title}</T>{hint ? <T style={s.hint}>{hint}</T> : null}</View>;
const Label = ({ children }: { children: string }) => <T style={s.label}>{children}</T>;
const toggle = (list: string[], k: string, max = 99) => (list.includes(k) ? list.filter((x) => x !== k) : list.length >= max ? list : [...list, k]);

export default function MatchProfileScreen() {
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const me = useStore((st) => st.me) as any;
  const [self, setSelf] = useState<MatchSelf | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [step, setStepRaw] = useState(0);
  const setStep = (n: number) => { setNote(''); setStepRaw(n); };
  const [preview, setPreview] = useState(false);
  const [q, setQ] = useState('');
  const [custom, setCustom] = useState('');
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(''), 3200); return () => clearTimeout(t); }, [note]);
  useEffect(() => {
    loadSelf().then((x) => {
      setSelf(x);
      const p = x.profile;
      setD({ games: p?.games || [], platforms: p?.platforms || [], langs: p?.langs || (LANG_NAME[me?.lang] ? [me.lang] : ['de']), looking: p?.looking || [], times: p?.times || 0, style: p?.style || 'both', mic: p ? p.mic : true, about: p?.about || '', visible: p ? p.visible : true });
    }).catch((e) => setNote(matchErr(e)));
  }, []);
  const set = (patch: Partial<Draft>) => setD((x) => (x ? { ...x, ...patch } : x));
  const first = !!self && !self.profile;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/match'));

  const card: MatchCard | null = useMemo(() => {
    if (!d) return null;
    const base = self?.preview;
    return {
      pid: null, avatar: base?.avatar ?? me?.avatar ?? null, banner: base?.banner ?? me?.banner ?? null, banner_color: base?.banner_color ?? me?.banner_color ?? null, accent: base?.accent || me?.accent || '#8468ff',
      deco: base?.deco || me?.deco || 'none', effect: base?.effect || me?.effect || 'none', games: d.games.map((n) => ({ n, c: false })), platforms: d.platforms, langs: d.langs, style: d.style, mic: d.mic,
      looking: d.looking, about: d.about, times: d.times, overlap: 0, score: null, boost: false, active: 'now',
    };
  }, [d, self?.preview, me]);

  if (!self || !d) return <View style={{ flex: 1, backgroundColor: C.bg0 }}><Glow /><TopBar title="Gamer-Profil" onBack={back} />{note ? <T style={{ color: C.muted, textAlign: 'center', marginTop: 40 }}>{note}</T> : <ActivityIndicator color={C.accent} style={{ marginTop: 60 }} />}</View>;

  const has = (g: string) => d.games.some((x) => x.toLowerCase() === g.toLowerCase());
  const addGame = (g: string) => {
    g = g.trim().slice(0, 32);
    if (!g || has(g)) return;
    if (d.games.length >= 8) return setNote('Höchstens 8 Spiele.');
    set({ games: [...d.games, g] });
  };
  const save = async () => {
    if (!d.games.length) { setStepRaw(0); return setNote('Wähle mindestens ein Spiel aus.'); }
    setBusy(true);
    try {
      const x = await saveProfile(d);
      setSelf(x);
      // zurück zum Stapel (der lädt beim Zurückkommen neu); nur bei direktem Aufruf ohne Vorgänger ersetzen
      if (first) { if (router.canGoBack()) router.back(); else router.replace('/match'); } else { setNote('Gespeichert ✓'); }
    } catch (e) { setNote(matchErr(e)); }
    setBusy(false);
  };
  const del = () => {
    const go = async () => { try { await deleteProfile(); if (router.canGoBack()) router.back(); else router.replace('/match'); } catch (e) { setNote(matchErr(e)); } };
    const text = 'Deine Karte, deine Likes und deine Matches bei „Mitspieler finden“ werden gelöscht. Deine Freunde und Chats bleiben.';
    if (Platform.OS === 'web') { if (confirm('Gamer-Profil löschen?\n\n' + text)) go(); return; }
    Alert.alert('Gamer-Profil löschen?', text, [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Löschen', style: 'destructive', onPress: go }]);
  };

  const term = q.trim().toLowerCase();
  const catalog = self.catalog.games.filter((g) => !has(g) && (!term || g.toLowerCase().includes(term))).slice(0, term ? 50 : 16);
  const games = (
    <View style={s.sec}>
      <Head title={STEPS[0]} hint="Bis zu 8 Spiele – danach suchen wir passende Leute." />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}><T style={{ fontWeight: '700', fontSize: 13.5 }}>Deine Spiele</T><T style={{ color: C.muted, fontSize: 13 }}>{d.games.length} von 8</T></View>
      <View style={s.wrap}>
        {d.games.length ? d.games.map((g) => <GameChip key={g} name={g} on x onPress={() => set({ games: d.games.filter((n) => n !== g) })} />)
          : <T style={{ color: C.muted, fontSize: 13.5 }}>Noch kein Spiel gewählt – tippe unten auf deine Spiele.</T>}
      </View>
      <View style={s.search}>
        <Icon name="search" size={17} color={C.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Spiel suchen …" placeholderTextColor={C.faint} style={s.input} autoCorrect={false} maxLength={32} clearButtonMode="while-editing" />
      </View>
      <View style={s.wrap}>
        {catalog.map((g) => <GameChip key={g} name={g} onPress={() => addGame(g)} />)}
        {!catalog.length ? <T style={{ color: C.muted, fontSize: 13.5 }}>Nichts gefunden – füg dein Spiel unten selbst hinzu.</T> : !term ? <T style={{ color: C.faint, fontSize: 13, alignSelf: 'center' }}>… suche oben nach weiteren</T> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <View style={[s.search, { flex: 1, marginVertical: 0 }]}>
          <TextInput value={custom} onChangeText={setCustom} placeholder="Anderes Spiel" placeholderTextColor={C.faint} style={s.input} maxLength={32} returnKeyType="done" onSubmitEditing={() => { addGame(custom); setCustom(''); }} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Spiel hinzufügen" onPress={() => { tap(); addGame(custom); setCustom(''); }} style={({ pressed }) => [s.add, pressed && { opacity: 0.7 }]}><Icon name="plus" size={20} color={C.text} stroke={2.4} /></Pressable>
      </View>
    </View>
  );
  const times = (
    <View style={s.sec}>
      <Head title={STEPS[1]} hint="Tippe die Felder an. Die Zeiten gelten in deiner Ortszeit; andere sehen sie in ihrer." />
      <TimeGrid mask={d.times} onToggle={(bit) => set({ times: d.times ^ bit })} />
      <View style={[s.wrap, { marginTop: 14 }]}>
        <Chip label="Abends unter der Woche" on={(d.times & WEEK) === WEEK} onPress={() => set({ times: (d.times & WEEK) === WEEK ? d.times & ~WEEK : d.times | WEEK })} />
        <Chip label="Am Wochenende" on={(d.times & WEEKEND) === WEEKEND} onPress={() => set({ times: (d.times & WEEKEND) === WEEKEND ? d.times & ~WEEKEND : d.times | WEEKEND })} />
        <Chip label="Alles leeren" on={false} onPress={() => set({ times: 0 })} />
      </View>
    </View>
  );
  const how = (
    <View style={s.sec}>
      <Head title={STEPS[2]} />
      <Label>Plattformen</Label>
      <View style={s.wrap}>{self.catalog.platforms.map((k) => <Chip key={k} label={PLATFORM[k] || k} on={d.platforms.includes(k)} onPress={() => set({ platforms: toggle(d.platforms, k) })} />)}</View>
      <Label>Spielstil</Label>
      <View style={s.wrap}>{self.catalog.styles.map((k) => <Chip key={k} label={STYLE[k] || k} on={d.style === k} onPress={() => set({ style: k })} />)}</View>
      <Label>Ich suche</Label>
      <View style={s.wrap}>{self.catalog.looking.map((k) => <Chip key={k} label={LOOKING[k] || k} on={d.looking.includes(k)} onPress={() => set({ looking: toggle(d.looking, k) })} />)}</View>
      <Label>Sprachen</Label>
      <View style={s.wrap}>{self.catalog.langs.map((k) => <Chip key={k} label={LANG_NAME[k] || k} on={d.langs.includes(k)} onPress={() => set({ langs: toggle(d.langs, k, 6) })} />)}</View>
      <View style={s.switchRow}>
        <View style={{ flex: 1 }}><T style={{ fontWeight: '700' }}>Ich spiele mit Mikro</T><T style={s.hint}>Andere sehen, ob du im Sprachchat dabei bist.</T></View>
        <Switch value={d.mic} onValueChange={(v) => set({ mic: v })} trackColor={{ true: C.accent, false: C.bg5 }} />
      </View>
    </View>
  );
  const about = (
    <View style={s.sec}>
      <Head title={STEPS[3]} hint="Freiwillig. Bitte keine Namen, Adressen oder Telefonnummern." />
      <TextInput value={d.about} onChangeText={(v) => set({ about: v.slice(0, 200) })} placeholder="Ein, zwei Sätze über dich als Spieler – z. B. Rang, Lieblingsrolle, worauf du Lust hast." placeholderTextColor={C.faint} multiline maxLength={200} style={s.about} />
      <T style={{ color: C.muted, fontSize: 12.5, textAlign: 'right', marginTop: 4 }}>{d.about.length}/200</T>
    </View>
  );
  const previewBtn = (
    <Pressable accessibilityRole="button" onPress={() => { tap(); setPreview(true); }} style={({ pressed }) => [s.previewBtn, pressed && { opacity: 0.8 }]}>
      <Icon name="user" size={18} color={C.accent} />
      <View style={{ flex: 1 }}><T style={{ fontWeight: '800' }}>So sehen dich andere</T><T style={s.hint}>Profilbild, Banner und Rahmen kommen aus deinem Asoo-Profil. Dein Name bleibt bis zum Match verborgen.</T></View>
      <View style={{ transform: [{ rotate: '-90deg' }] }}><Icon name="chevron" size={15} color={C.muted} stroke={2.4} /></View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <Glow />
      <TopBar title={first ? 'Gamer-Profil einrichten' : 'Mein Gamer-Profil'} onBack={() => (first && step > 0 ? setStep(step - 1) : back())} />
      {first ? (
        <>
          <View style={s.progress}>
            {STEPS.map((_, i) => <View key={i} style={[s.bar, i <= step && { overflow: 'hidden' }]}>{i <= step ? <LinearGradient colors={GRAD as any} locations={GRAD_POS as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /> : null}</View>)}
          </View>
          <T style={s.stepText}>Schritt {step + 1} von {STEPS.length}</T>
          <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 30 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
            <Animated.View key={step} entering={FadeInRight.duration(220)}>
              {step === 0 ? games : step === 1 ? times : step === 2 ? how : <>{about}{previewBtn}</>}
            </Animated.View>
          </ScrollView>
          <View style={[s.foot, { paddingBottom: Math.max(ins.bottom, 12) }]}>
            {step > 0 ? <Btn title="Zurück" kind="secondary" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
            {step < STEPS.length - 1
              ? <Btn title="Weiter" onPress={() => { if (step === 0 && !d.games.length) return setNote('Wähle mindestens ein Spiel aus.'); setStep(step + 1); }} style={{ flex: 2 }} />
              : <Btn title="Profil erstellen" icon="check" busy={busy} onPress={save} style={{ flex: 2 }} />}
          </View>
        </>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 30, gap: 12 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
            {previewBtn}
            {games}{times}{how}{about}
            <View style={s.sec}>
              <Head title="Sichtbarkeit" />
              <View style={[s.switchRow, { marginTop: 0, paddingTop: 0, borderTopWidth: 0 }]}>
                <View style={{ flex: 1 }}><T style={{ fontWeight: '700' }}>Profil sichtbar</T><T style={s.hint}>Ausgeschaltet sieht niemand deine Karte. Likes und Matches bleiben.</T></View>
                <Switch value={d.visible} onValueChange={(v) => set({ visible: v })} trackColor={{ true: C.accent, false: C.bg5 }} />
              </View>
              {self.hidden_cards ? (
                <View style={s.switchRow}>
                  <View style={{ flex: 1 }}><T style={{ fontWeight: '700' }}>{self.hidden_cards} blockierte {self.hidden_cards === 1 ? 'Karte' : 'Karten'}</T><T style={s.hint}>Diese Leute siehst du hier nicht mehr.</T></View>
                  <Btn small kind="secondary" title="Freigeben" onPress={async () => { try { setSelf(await unblockAll()); setNote('Alle Karten wieder freigegeben.'); } catch (e) { setNote(matchErr(e)); } }} />
                </View>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" onPress={del} style={({ pressed }) => [s.del, pressed && { opacity: 0.7 }]}>
              <Icon name="trash" size={17} color={C.danger} /><T style={{ color: C.danger, fontWeight: '700' }}>Gamer-Profil löschen</T>
            </Pressable>
          </ScrollView>
          <View style={[s.foot, { paddingBottom: Math.max(ins.bottom, 12) }]}>
            <Btn title="Speichern" icon="check" busy={busy} onPress={save} style={{ flex: 1 }} />
          </View>
        </>
      )}
      {note ? <Animated.View entering={FadeIn.duration(150)} style={[s.note, { bottom: ins.bottom + 96 }]} pointerEvents="none"><T style={{ fontWeight: '700', textAlign: 'center' }}>{note}</T></Animated.View> : null}
      <Modal visible={preview} transparent animationType="fade" onRequestClose={() => setPreview(false)}>
        <View style={[s.back, { paddingTop: ins.top + 14, paddingBottom: ins.bottom + 14 }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreview(false)} accessibilityLabel="Schließen" />
          <View style={{ width: '100%', maxWidth: 440, flexShrink: 1 }}>
            <ScrollView style={{ borderRadius: 26 }} showsVerticalScrollIndicator={false}>{card ? <MatchCardView c={card} preview /> : null}</ScrollView>
            <Btn title="Schließen" kind="secondary" onPress={() => setPreview(false)} style={{ marginTop: 12 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  sec: { padding: 16, borderRadius: 20, backgroundColor: HOME.panel, borderWidth: 1, borderColor: HOME.edge },
  h: { fontSize: 19, fontWeight: '800' },
  hint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 1 },
  label: { color: C.faint, fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1, marginTop: 16, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: HOME.raised, borderWidth: 1, borderColor: HOME.edge, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: C.accentSoft, borderColor: C.accent },
  chipText: { fontWeight: '700', fontSize: 14, color: C.text2 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: 13, backgroundColor: HOME.raised, borderWidth: 1, borderColor: HOME.edge, marginVertical: 12 },
  input: { flex: 1, color: C.text, fontSize: 15.5, paddingVertical: 0, fontFamily: 'Cairo_500Medium' },
  add: { width: 44, height: 44, borderRadius: 13, backgroundColor: HOME.bar, borderWidth: 1, borderColor: HOME.edge, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  about: { minHeight: 96, borderRadius: 14, backgroundColor: HOME.raised, borderWidth: 1, borderColor: HOME.edge, color: C.text, padding: 12, fontSize: 15.5, lineHeight: 21, textAlignVertical: 'top', fontFamily: 'Cairo_500Medium' },
  previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: HOME.raised, borderWidth: 1, borderColor: C.accentLine, marginTop: 12 },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingTop: 12 },
  bar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: C.bg4 },
  stepText: { color: C.muted, fontSize: 12.5, fontWeight: '700', paddingHorizontal: 14, marginTop: 8 },
  foot: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingTop: 10, backgroundColor: C.bg1, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  del: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 },
  note: { position: 'absolute', left: 24, right: 24, padding: 12, borderRadius: 14, backgroundColor: 'rgba(32,33,49,0.97)', borderWidth: 1, borderColor: C.line },
  back: { flex: 1, backgroundColor: 'rgba(4,4,10,0.8)', alignItems: 'center', justifyContent: 'center', padding: 14 },
});
