// Sprachen der App – wie in der Web-App: Deutsch ist der Grundtext im Code, t('…') liefert die Übersetzung.
// Die App nimmt die Sprache des iPhones (auch die Sprache, die man in den iPhone-Einstellungen nur für ToLobby wählt) –
// außer man wählt in den Einstellungen der App selbst eine (Schlüssel asoo.lang, setLang).
// Fehlt eine Übersetzung, erscheint Englisch, fehlt auch die, der deutsche Grundtext.
// Übersetzungen: src/lang/<code>.json (Schlüssel = deutscher Text). Neue Texte: node scripts/i18n-extract.mjs
import { NativeModules, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import en from '../lang/en.json';
import ar from '../lang/ar.json';
import es from '../lang/es.json';
import fr from '../lang/fr.json';
import it from '../lang/it.json';
import ku from '../lang/ku.json';
import nl from '../lang/nl.json';
import pl from '../lang/pl.json';
import pt from '../lang/pt.json';
import ru from '../lang/ru.json';
import tr from '../lang/tr.json';

export const LANGS = ['de', 'en', 'ar', 'es', 'fr', 'it', 'ku', 'nl', 'pl', 'pt', 'ru', 'tr'] as const;
export type Lang = (typeof LANGS)[number];
const MAPS: Record<string, Record<string, string>> = { en, ar, es, fr, it, ku, nl, pl, pt, ru, tr };

/** Bevorzugte Sprachen des Geräts, wichtigste zuerst (z. B. ["tr-DE", "de-DE"]). */
function deviceLangs(): string[] {
  try {
    if (Platform.OS === 'web') return [...((globalThis as any).navigator?.languages || []), (globalThis as any).navigator?.language].filter(Boolean);
    if (Platform.OS === 'ios') {
      const s = NativeModules.SettingsManager?.settings || {};
      return [...(s.AppleLanguages || []), s.AppleLocale].filter(Boolean);
    }
    const l = NativeModules.I18nManager?.localeIdentifier;
    if (l) return [l];
  } catch {}
  try { return [Intl.DateTimeFormat().resolvedOptions().locale]; } catch { return []; }
}
function pick(): Lang {
  for (const raw of deviceLangs()) {
    const code = String(raw).toLowerCase().replace('_', '-').split('-')[0];
    // Kurdisch: Kurmancî heißt bei Apple „kmr“, Sorani „ckb“ – beide auf unsere Kurdisch-Fassung
    const c = code === 'kmr' || code === 'ckb' ? 'ku' : code;
    if ((LANGS as readonly string[]).includes(c)) return c as Lang;
  }
  return 'en';
}
// In der App gewählte Sprache (null = wie das iPhone). SecureStore liest auch ohne „await“ – die Sprache steht beim Start fest.
const KEY = 'asoo.lang';
function chosen(): Lang | null {
  try {
    const v = Platform.OS === 'web' ? (globalThis as any).localStorage?.getItem(KEY) : SecureStore.getItem(KEY);
    return v && (LANGS as readonly string[]).includes(v) ? (v as Lang) : null;
  } catch { return null; }
}
const LOCALES = { de: 'de-DE', en: 'en-GB', ar: 'ar', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', ku: 'ku', nl: 'nl-NL', pl: 'pl-PL', pt: 'pt-PT', ru: 'ru-RU', tr: 'tr-TR' } as Record<Lang, string>;
export let LANG: Lang = chosen() || pick();
/** Gebietsschema für Datum und Zahlen (toLocaleDateString …) */
export let LOCALE = LOCALES[LANG];
export let isRTL = LANG === 'ar';
/** Namen der Sprachen in ihrer eigenen Sprache (für die Auswahl). */
export const LANG_NAMES: Record<Lang, string> = { de: 'Deutsch', en: 'English', ar: 'العربية', es: 'Español', fr: 'Français', it: 'Italiano', ku: 'Kurdî', nl: 'Nederlands', pl: 'Polski', pt: 'Português', ru: 'Русский', tr: 'Türkçe' };
/** Gewählte Sprache oder 'auto' (wie das iPhone). */
export const langChoice = (): Lang | 'auto' => chosen() || 'auto';
/** Sprache, die das iPhone vorgibt (für „Wie das iPhone“). */
export const deviceLang = (): Lang => pick();
const langSubs = new Set<() => void>();
export function onLangChange(fn: () => void) { langSubs.add(fn); return () => { langSubs.delete(fn); }; }
/** Sprache wechseln ('auto' = wie das iPhone). Die App baut sich danach neu auf (_layout.tsx). */
export function setLang(l: Lang | 'auto') {
  try {
    if (Platform.OS === 'web') { if (l === 'auto') (globalThis as any).localStorage?.removeItem(KEY); else (globalThis as any).localStorage?.setItem(KEY, l); }
    else if (l === 'auto') SecureStore.deleteItemAsync(KEY).catch(() => {}); else SecureStore.setItem(KEY, l);
  } catch {}
  LANG = l === 'auto' ? pick() : l;
  LOCALE = LOCALES[LANG];
  isRTL = LANG === 'ar';
  langSubs.forEach((f) => f());
}

/** Übersetzt einen deutschen Grundtext. {name} im Text wird durch vars.name ersetzt. */
export function t(de: string, vars?: Record<string, string | number | null | undefined>): string {
  let s = LANG === 'de' ? de : (MAPS[LANG]?.[de] || MAPS.en?.[de] || de);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(v == null ? '' : String(v));
  return s;
}
