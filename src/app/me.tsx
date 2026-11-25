// Mein Profil – wie bei Discord als Karte, die von unten hochkommt: X oben links, Banner, großes Profilbild mit Rahmen,
// Name mit Pfeil (antippen = Status ändern), @Name, „Profil bearbeiten“, darunter Karten (Profil aufpeppen, Über mich,
// Mitglied seit, Freunde, So sehen dich andere). Unten schwebt eine Leiste: 3D-Avatar, Rahmen, Entdecken, Einstellungen.
// Der Profil-Effekt liegt über dem ganzen Bildschirm, damit er nirgends abgeschnitten wird.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { pickImage as chooseImage } from '@/lib/pick';
import { api, errText, upload } from '@/lib/api';
import { setState, useStore } from '@/lib/store';
import { Btn, T } from '@/components/ui';
import { ProfileHead } from '@/components/ProfileHead';
import { ProfileFx } from '@/components/ProfileFx';
import { Icon, type IconName } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { StatusSheet } from '@/components/MeBar';
import { C, GRAD, GRAD_POS, HOME } from '@/lib/theme';
import { matchNew } from '@/lib/match';

export default function Me() {
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const me = useStore((s) => s.me) as any;
  const friends = useStore((s) => s.friends.friends.length);
  const requests = useStore((s) => s.friends.incoming.length);
  const match = useStore((s) => s.match);
  const [msg, setMsg] = useState('');
  const [sheet, setSheet] = useState(false);
  const [amp, setAmp] = useState(true);
  if (!me) return null;
  const patch = async (body: any) => {
    try { const d = await api<any>('PATCH', '/api/me', body); setState((s) => ({ me: { ...s.me!, ...d.user } })); } catch (e) { setMsg(errText(e)); }
  };
  const pickAvatar = async () => {
    const r = await chooseImage({ title: 'Profilbild ändern', crop: [1, 1], maxSide: 768, onWork: () => setMsg('Bild wird vorbereitet …') });
    if (!r) return;
    setMsg('Profilbild wird hochgeladen …');
    try { const up = await upload('avatar', r.uri, r.mime); await patch({ avatar: up.key }); setMsg('Profilbild gespeichert ✓'); } catch (e) { setMsg(errText(e)); }
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const page = (p: string) => router.push({ pathname: '/settings', params: { page: p } });
  const raw = me.status_raw || me.status;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      {/* die Karte beginnt unter der Statusleiste und hat oben runde Ecken (wie das Profil-Fenster bei Discord) */}
      <View style={[s.sheet, { marginTop: ins.top + 4 }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 + ins.bottom }} showsVerticalScrollIndicator={false}>
          <ProfileHead u={me} status={raw} onAvatar={pickAvatar} onName={() => setSheet(true)} ring={HOME.panel}
            topLeft={<Pressable accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={6} onPress={close} style={s.close}><Icon name="x" size={22} color="#fff" stroke={2.4} /></Pressable>}
            bannerRight={<Pressable accessibilityRole="button" accessibilityLabel="Einstellungen" hitSlop={8} onPress={() => { Haptics.selectionAsync().catch(() => {}); router.push('/settings'); }} style={({ pressed }) => [s.gear, pressed && { opacity: 0.7 }]}><Icon name="gear" size={21} color={C.text} stroke={2.2} /></Pressable>} />

          <View style={{ paddingHorizontal: 16, marginTop: 16, gap: 12 }}>
            <Btn title="Profil bearbeiten" icon="edit" onPress={() => page('profile')} />
            {msg ? <T style={s.msg}>{msg}</T> : null}

            {/* wie „Amp up your profile“: farbiger Rand, zwei Knöpfe, wegklickbar */}
            {amp ? (
              <LinearGradient colors={GRAD as any} locations={GRAD_POS as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ampEdge}>
                <View style={s.amp}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <T style={s.ampTitle}>Peppe dein Profil auf</T>
                    <Pressable accessibilityRole="button" accessibilityLabel="Ausblenden" hitSlop={8} onPress={() => setAmp(false)}><Icon name="x" size={20} color={C.muted} /></Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <AmpBtn icon="sparkle" label="Profilrahmen" onPress={() => page('frame')} />
                    <AmpBtn icon="moon" label="Profil-Effekt" onPress={() => page('effect')} />
                  </View>
                </View>
              </LinearGradient>
            ) : null}

            {me.bio ? <View style={s.card}><T style={s.label}>Über mich</T><T style={s.bio}>{me.bio}</T></View> : null}

            {me.created ? <View style={{ gap: 6, paddingHorizontal: 2, marginTop: 4 }}>
              <T style={s.label}>Mitglied seit</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Logo size={22} />
                <T style={s.since}>{new Date(me.created).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</T>
              </View>
            </View> : null}

            <RowCard label="Mitspieler-Match" icon="pad" sub={match.has ? 'Leute zum Zocken – Likes, Matches, dein Gamer-Profil' : 'Finde Leute zum Zocken – erst anonym, bei einem Match mit Namen'} badge={matchNew(match)} onPress={() => router.push('/match')} />
            <RowCard label="Freunde" sub={friends ? `${friends} ${friends === 1 ? 'Freund' : 'Freunde'}` : undefined} badge={requests} onPress={() => router.push('/friends')} />
            <RowCard label="So sehen dich andere" icon="user" onPress={() => router.push({ pathname: '/user/[id]', params: { id: me.id } })} />
          </View>
        </ScrollView>

        {/* schwebende Leiste unten wie bei Discord (Quests, Shop, Nitro, Einstellungen) – hier die Asoo-Gegenstücke */}
        <View style={[s.dock, { bottom: Math.max(ins.bottom - 4, 12) }]}>
          <DockBtn icon="cube" label="3D-Avatar" onPress={() => router.push('/avatar3d')} />
          <DockBtn icon="sparkle" label="Rahmen" onPress={() => page('frame')} />
          <DockBtn icon="compass" label="Entdecken" onPress={() => router.push({ pathname: '/server-new', params: { tab: 'discover' } })} />
          <DockBtn icon="gear" label="Einstellungen" onPress={() => router.push('/settings')} />
        </View>
      </View>
      <StatusSheet open={sheet} onClose={() => setSheet(false)} />
      <ProfileFx id={me.effect} />
    </View>
  );
}

function AmpBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.ampBtn, pressed && { opacity: 0.8 }]}>
      <Icon name={icon} size={18} color={C.text} />
      <T style={{ fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{label}</T>
    </Pressable>
  );
}

function RowCard({ label, sub, icon, badge, onPress }: { label: string; sub?: string; icon?: IconName; badge?: number; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }} style={({ pressed }) => [s.card, s.rowCard, pressed && { backgroundColor: HOME.bar }]}>
      {icon ? <Icon name={icon} size={19} color={C.text2} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T style={{ fontSize: 16, fontWeight: '700' }}>{label}</T>
        {sub ? <T style={{ color: C.muted, fontSize: 13 }}>{sub}</T> : null}
      </View>
      {badge ? <View style={s.badge}><T style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{badge}</T></View> : null}
      <View style={{ transform: [{ rotate: '-90deg' }] }}><Icon name="chevron" size={16} color={C.muted} stroke={2.4} /></View>
    </Pressable>
  );
}

function DockBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }} style={({ pressed }) => [s.dockBtn, pressed && { opacity: 0.65 }]}>
      <Icon name={icon} size={24} color={C.text} stroke={2.1} />
      <T style={s.dockText} numberOfLines={1}>{label}</T>
    </Pressable>
  );
}

const s = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: HOME.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  gear: { width: 42, height: 42, borderRadius: 21, backgroundColor: HOME.raised, borderWidth: 1, borderColor: HOME.edge, alignItems: 'center', justifyContent: 'center' },
  close: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  msg: { color: C.warn, textAlign: 'center' },
  ampEdge: { borderRadius: 22, padding: 2 },
  amp: { borderRadius: 20, backgroundColor: HOME.panel, padding: 14, gap: 12 },
  ampTitle: { flex: 1, fontSize: 17, fontWeight: '800' },
  ampBtn: { flex: 1, height: 50, borderRadius: 14, backgroundColor: HOME.raised, borderWidth: 1, borderColor: HOME.edge, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  card: { backgroundColor: HOME.raised, borderRadius: 18, borderWidth: 1, borderColor: HOME.edge, padding: 16 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 12 },
  label: { color: C.muted, fontSize: 14, fontWeight: '700' },
  bio: { color: C.text2, fontSize: 15, marginTop: 4, lineHeight: 21 },
  since: { color: C.text, fontSize: 16, fontWeight: '600' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' },
  dock: { position: 'absolute', left: 28, right: 28, height: 76, borderRadius: 24, backgroundColor: HOME.bar, borderWidth: 1, borderColor: HOME.edge, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  dockBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, height: '100%' },
  dockText: { color: C.text, fontSize: 12.5, fontWeight: '700' },
});
