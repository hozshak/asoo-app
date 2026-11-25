// Teile der Web-App in der App: Sprach- und 3D-Räume, Avatar-Editor, Anrufe. Die Seite meldet sich über
// /api/auth/app-web mit dem Schlüssel der App an (zuno-app/src/worker.js) und läuft mit ?app=1 ohne eigene Leisten
// (zuno-app/public/js/app.js, „embed“). „Zurück“ in der Seite schickt { t: 'close' }.
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { BASE, getToken } from '@/lib/api';
import { C } from '@/lib/theme';
import { T } from './ui';
import { t, LANG } from '@/lib/i18n';

const ORIGIN = (BASE || 'https://zuno-app.altraex.workers.dev').replace(/\/+$/, '');

export function EmbedView({ path, onClose, onAuthLost, onOpen }: { path: string; onClose: () => void; onAuthLost: () => void; onOpen?: (ch: string, msg?: string) => void }) {
  const [ready, setReady] = useState(false);
  const source = useMemo(() => {
    const to = path + (path.includes('?') ? '&' : '?') + 'app=1';
    return { uri: `${ORIGIN}/api/auth/app-web?to=${encodeURIComponent(to)}`, headers: { authorization: `Bearer ${getToken() || ''}`, 'x-client': 'asoo-app' } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  const onMessage = (e: WebViewMessageEvent) => {
    let m: any = null;
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m?.t === 'ready') setReady(true);
    else if (m?.t === 'close') onClose();
    else if (m?.t === 'auth') onAuthLost();
    else if (m?.t === 'open' && typeof m.ch === 'string') onOpen?.(m.ch, m.m);
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg0 }}>
      <WebView
        source={source}
        // Sprache der App auch in der eingebetteten Web-App (3D-Räume, Avatar-Editor)
        injectedJavaScriptBeforeContentLoaded={`window.__asooLang=${JSON.stringify(LANG)};try{localStorage.setItem('zuno.lang',${JSON.stringify(LANG)})}catch(e){};true;`}
        style={{ flex: 1, backgroundColor: C.bg0 }}
        onMessage={onMessage}
        // das Ladebild bleibt, bis die Web-App fertig gezeichnet hat ({ t: 'ready' }) – höchstens 8 s nach dem Laden
        onLoadEnd={() => setTimeout(() => setReady(true), 8000)}
        // Mikrofon und Kamera für Sprachräume: iOS fragt einmal selbst (Texte in app.json), die Seite nicht noch einmal
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
        // Fremde Seiten (Links aus dem Chat, Regeln …) im Browser der App öffnen, nicht in diesem Fenster
        onShouldStartLoadWithRequest={(r) => {
          if (!r.isTopFrame || r.url.startsWith(ORIGIN) || r.url.startsWith('about:') || r.url.startsWith('blob:')) return true;
          if (/^https?:/.test(r.url)) WebBrowser.openBrowserAsync(r.url).catch(() => {});
          return false;
        }}
      />
      {!ready ? <View style={[StyleSheet.absoluteFill, s.wait]} pointerEvents="none"><ActivityIndicator color={C.accent} size="large" /><T style={{ color: C.muted, marginTop: 10 }}>{t("Wird geladen …")}</T></View> : null}
    </View>
  );
}

const s = StyleSheet.create({ wait: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg0 } });
