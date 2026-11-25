// Hinweis „Neue Version im App Store“: fragt beim Start einmal beim App Store nach (öffentliche Suche nach der
// App-Kennung). Ist dort eine neuere Version als die installierte, erscheint oben ein Hinweis mit „Aktualisieren“.
// „Später“ blendet ihn für genau diese Version aus (SecureStore asoo.updateSeen). TestFlight-Versionen, die neuer sind
// als der App Store, bekommen keinen Hinweis.
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './ui';
import { Icon } from './Icon';
import { t } from '@/lib/i18n';
import { C, GRAD } from '@/lib/theme';

const BUNDLE = 'de.feierabendcode.asoo';
const STORE = 'itms-apps://apps.apple.com/app/id6836821648';
const SEEN = 'asoo.updateSeen';

/** 1.2.10 > 1.2.9 – Versionsnummern Stelle für Stelle vergleichen. */
export function newer(a: string, b: string) {
  const x = String(a).split('.').map((n) => parseInt(n, 10) || 0), y = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
}

export function UpdateBanner() {
  const ins = useSafeAreaInsets();
  const [store, setStore] = useState<{ version: string; url: string } | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const mine = Application.nativeApplicationVersion;
    if (!mine) return;
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`https://itunes.apple.com/lookup?bundleId=${BUNDLE}&country=de&t=${Date.now()}`);
        const d = await r.json();
        const app = d?.results?.[0];
        if (!app?.version || !newer(app.version, mine)) return;
        if (SecureStore.getItem(SEEN) === app.version) return;
        setStore({ version: app.version, url: app.trackViewUrl ? String(app.trackViewUrl).replace(/^https:/, 'itms-apps:') : STORE });
      } catch { /* kein Netz – beim nächsten Start wieder */ }
    }, 4000);
    return () => clearTimeout(timer);
  }, []);
  if (!store) return null;
  const later = () => { try { SecureStore.setItem(SEEN, store.version); } catch {} setStore(null); };
  const go = () => { Linking.openURL(store.url).catch(() => Linking.openURL(STORE).catch(() => {})); setStore(null); };
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-start', paddingTop: ins.top + 8, paddingHorizontal: 12 }]}>
      <View style={s.card}>
        <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ic}><Icon name="download" size={18} color="#fff" /></LinearGradient>
        <View style={{ flex: 1 }}>
          <T style={s.title}>{t("Neue Version verfügbar")}</T>
          <T style={s.sub}>{t("ToLobby {v} ist im App Store – mit Verbesserungen und neuen Funktionen.", { v: store.version })}</T>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Pressable onPress={go} style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}><T style={s.btnText}>{t("Aktualisieren")}</T></Pressable>
            <Pressable onPress={later} style={({ pressed }) => [s.btn2, pressed && { opacity: 0.7 }]}><T style={s.btn2Text}>{t("Später")}</T></Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, backgroundColor: C.bg3, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)', shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  ic: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '800', fontSize: 15.5, color: C.text },
  sub: { color: C.muted, fontSize: 13, marginTop: 2 },
  btn: { backgroundColor: C.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
  btn2: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
  btn2Text: { color: C.text, fontWeight: '700', fontSize: 13.5 },
});
