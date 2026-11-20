// Alter Einstieg für Web-Ansichten (Links von außen, ältere Aufrufe): öffnet das dauerhafte Web-Fenster und geht gleich zurück.
import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { showWeb } from '@/lib/webhost';
import { C } from '@/lib/theme';

const ALLOWED = /^\/(channels|settings|feed|discover|post|u|i|admin|notifications|start)(\/|\?|$)/;

export default function Room() {
  const { path } = useLocalSearchParams<{ path: string }>();
  const router = useRouter();
  useEffect(() => {
    showWeb(typeof path === 'string' && ALLOWED.test(path) ? path : '/channels/@me');
    if (router.canGoBack()) router.back(); else router.replace('/');
  }, []);
  return <View style={{ flex: 1, backgroundColor: C.bg0 }} />;
}
