// Das dauerhafte Web-Fenster (lib/webhost.ts). Liegt über der ganzen App; geschlossen wird es nur aus dem Bild
// geschoben, nicht beendet – so laufen Anrufe und Sprachräume weiter, und die nächste Seite ist sofort da.
import React, { useEffect, useRef } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ScreenCapturePickerView } from 'react-native-webrtc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { BASE, getToken } from '@/lib/api';
import { attachInject, getHost, onWebMessage, useHost } from '@/lib/webhost';
import { signOut } from '@/lib/session';
import { isSharing, onScreenShare, startScreenShare, stopScreenShare, type ScreenQuality } from '@/lib/screenshare';
import { C } from '@/lib/theme';
import { T } from './ui';
import { t, LANG } from '@/lib/i18n';

// Typen von react-native-webview passen mit ref nicht zu React 19 – zur Laufzeit ein normales Bauteil
const WV = WebView as unknown as React.ComponentType<any>;

const ORIGIN = (BASE || 'https://zuno-app.altraex.workers.dev').replace(/\/+$/, '');
// Genau die eigene Adresse – „startsWith“ hätte auch z. B. https://zuno-app.altraex.workers.dev.fremd.de durchgelassen
const ownUrl = (u?: string) => { try { return !!u && new URL(u).origin === ORIGIN; } catch { return false; } };
// Was die App der Web-Seite anbietet (dort erscheinen dann passende Knöpfe, z. B. „Bildschirm teilen“ am iPhone)
// Sprache der App gilt auch in der eingebetteten Web-App (sonst stünde dort die Sprache vom Konto oder Englisch)
const LANG_JS = `window.__asooLang=${JSON.stringify(LANG)};try{localStorage.setItem('zuno.lang',${JSON.stringify(LANG)})}catch(e){};`;
const CAPS = LANG_JS + (Platform.OS === 'ios' ? 'window.__asooCaps={screen:true};true;' : 'window.__asooCaps={};true;');
const PICK = Platform.OS === 'ios' ? (ScreenCapturePickerView as unknown as React.ComponentType<any>) : null;

export function WebHost() {
  const started = useHost((s) => s.started);
  const visible = useHost((s) => s.visible);
  const busy = useHost((s) => s.busy);
  const { height } = useWindowDimensions();
  const router = useRouter();
  const ref = useRef<any>(null);
  // Startadresse nur einmal festlegen – eine neue Adresse würde die Seite neu laden (und einen Anruf beenden)
  const source = useRef<{ uri: string; headers: Record<string, string> } | null>(null);
  if (!started) source.current = null; // abgemeldet: beim nächsten Mal mit dem neuen Schlüssel starten
  if (started && !source.current) {
    const p = getHost().path;
    const to = p + (p.includes('?') ? '&' : '?') + 'app=1';
    source.current = { uri: `${ORIGIN}/api/auth/app-web?to=${encodeURIComponent(to)}`, headers: { authorization: `Bearer ${getToken() || ''}`, 'x-client': 'asoo-app' } };
  }
  useEffect(() => { attachInject((js) => ref.current?.injectJavaScript(js)); return () => attachInject(null); }, []);
  // Bildschirm teilen: Zustand an die Web-Seite melden (ihr Knopf leuchtet dann)
  const picker = useRef<any>(null);
  useEffect(() => onScreenShare((on) => ref.current?.injectJavaScript(`window.__asooScreen && window.__asooScreen(${on});true;`)), []);
  const toggleShare = () => {
    if (isSharing()) { stopScreenShare(); return; }
    const room = getHost().voice?.room;
    if (!room) { Alert.alert(t("Bildschirm teilen"), t("Tritt zuerst einem Sprachraum oder Anruf bei.")); return; }
    const opts: [string, ScreenQuality | null][] = [['720p – spart Daten', '720'], ['1080p – Full HD', '1080'], ['Volle Auflösung', 'max'], ['Abbrechen', null]];
    ActionSheetIOS.showActionSheetWithOptions({ title: t("Bildschirm teilen"), message: t("Dein ganzer Bildschirm wird übertragen – auch wenn du die App verlässt. Beenden über den roten Balken oben oder das Kontrollzentrum."), options: opts.map((o) => o[0]), cancelButtonIndex: opts.length - 1 }, (i) => {
      const q = opts[i]?.[1];
      if (q) startScreenShare(room, picker.current, q).catch(() => Alert.alert(t("Bildschirm teilen"), t("Das hat nicht geklappt. Bitte versuch es noch einmal.")));
    });
  };
  if (!started || !source.current) return null;
  const onMessage = (e: WebViewMessageEvent) => {
    // Befehle (abmelden, Chat öffnen, Bildschirm teilen) nur von der eigenen Seite annehmen
    if (!ownUrl(e.nativeEvent.url)) return;
    let m: any = null;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    const r = onWebMessage(m);
    if (r.open) router.push({ pathname: '/chat/[id]', params: { id: r.open } });
    if (r.auth) signOut(false);
    if (r.share) toggleShare();
  };
  return (
    <View pointerEvents={visible ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, s.host, !visible && { transform: [{ translateY: height + 50 }] }]}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: C.bg0 }}>
        <WV
          ref={ref}
          source={source.current}
          injectedJavaScriptBeforeContentLoaded={CAPS}
          style={{ flex: 1, backgroundColor: C.bg0 }}
          onMessage={onMessage}
          mediaCapturePermissionGrantType="grant"
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          allowsBackForwardNavigationGestures={false}
          sharedCookiesEnabled
          contentInsetAdjustmentBehavior="never"
          bounces={false}
          overScrollMode="never"
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(r: any) => {
            if (!r.isTopFrame || ownUrl(r.url) || r.url === 'about:blank' || r.url.startsWith('blob:' + ORIGIN)) return true;
            if (/^https?:/.test(r.url)) WebBrowser.openBrowserAsync(r.url).catch(() => {});
            return false;
          }}
          // stürzt der Inhalt ab (z. B. wenig Speicher), neu laden statt eines weißen Fensters
          onContentProcessDidTerminate={() => ref.current?.reload()}
        />
        {PICK ? <PICK ref={picker} style={s.picker} /> : null}
        {busy ? <View style={[StyleSheet.absoluteFill, s.wait]} pointerEvents="none"><ActivityIndicator color={C.accent} size="large" /><T style={{ color: C.muted, marginTop: 10 }}>{t("Wird geladen …")}</T></View> : null}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  host: { zIndex: 50, elevation: 50, backgroundColor: C.bg0 },
  wait: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg0 },
  picker: { position: 'absolute', width: 1, height: 1, opacity: 0, left: 0, top: 0 },
});
