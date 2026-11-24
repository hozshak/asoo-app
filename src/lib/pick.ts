// Bild wählen: Erst fragen, woher (Kamera, Fotos, Dateien) – dann öffnet sich sofort das Passende. Vorher ging direkt
// die Fotomediathek auf; das dauerte am iPhone spürbar und wirkte, als hinge die App.
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type PickedImage = { uri: string; mime: string; width?: number; height?: number };
type Source = 'camera' | 'library' | 'files';
type Opts = { title?: string; crop?: [number, number]; quality?: number; maxSide?: number; onWork?: () => void };

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function askSource(title: string): Promise<Source | null> {
  // im Browser (Test-Ansicht) gibt es keine Kamera-Auswahl – dort gleich die Dateiauswahl
  if (Platform.OS === 'web') return Promise.resolve('library');
  const opts: [string, Source | null][] = [['Foto aufnehmen', 'camera'], ['Aus Fotos wählen', 'library'], ['Aus Dateien wählen', 'files'], ['Abbrechen', null]];
  return new Promise((resolve) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ title, options: opts.map((o) => o[0]), cancelButtonIndex: opts.length - 1 }, (i) => resolve(opts[i]?.[1] ?? null));
    } else {
      Alert.alert(title, undefined, [
        ...opts.slice(0, 3).map(([text, v]) => ({ text, onPress: () => resolve(v) })),
        { text: 'Abbrechen', style: 'cancel' as const, onPress: () => resolve(null) },
      ], { cancelable: true, onDismiss: () => resolve(null) });
    }
  });
}

/** Fragt nach der Quelle und gibt das gewählte Bild zurück (oder null). Fehlt eine Erlaubnis, erklärt ein Hinweis den Weg. */
export async function pickImage(o: Opts = {}): Promise<PickedImage | null> {
  const raw = await pickRaw(o);
  if (!raw || raw.mime === 'image/gif') return raw; // GIFs bleiben (sonst wären sie nicht mehr bewegt)
  o.onWork?.(); // ab hier sieht man „wird vorbereitet …“ statt eines stehenden Bildschirms
  return (await shrink(raw, o.maxSide ?? 1600, o.crop)) || raw;
}

/**
 * Verkleinern vor dem Hochladen: Handyfotos haben oft 4–8 MB – der Server nimmt fürs Profilbild höchstens 3 MB, und so
 * große Dateien brauchen im Mobilnetz lange. Längste Seite auf maxSide Pixel, als JPEG.
 */
async function shrink(raw: PickedImage, maxSide: number, crop?: [number, number]): Promise<PickedImage | null> {
  try {
    const ctx = ImageManipulator.manipulate(raw.uri);
    // Größe ist meist schon bekannt (Bildauswahl liefert sie mit): dann gleich verkleinert zeichnen – das volle Bild
    // (12–48 Megapixel) nur einmal zu entpacken spart am iPhone spürbar Zeit
    let w = raw.width || 0, hgt = raw.height || 0;
    // Beim Zuschneiden die echte (gedrehte) Größe nehmen: Handyfotos stehen oft nur per Kennzeichen hochkant
    if (!w || !hgt || crop) { const probe = await ctx.renderAsync(); w = probe.width; hgt = probe.height; }
    // Zuschneiden (z. B. quadratisch fürs Profilbild): mittig, selbst – die Bildauswahl mit eingebautem Zuschneiden
    // ist am iPhone die alte, langsame (öffnet die Fotos erst nach Sekunden)
    if (crop) {
      const want = crop[0] / crop[1], cw = w / hgt > want ? Math.round(hgt * want) : w, ch = w / hgt > want ? hgt : Math.round(w / want);
      if (cw < w || ch < hgt) { ctx.crop({ originX: Math.round((w - cw) / 2), originY: Math.round((hgt - ch) / 2), width: cw, height: ch }); w = cw; hgt = ch; }
    }
    if (Math.max(w, hgt) > maxSide) ctx.resize(w >= hgt ? { width: maxSide } : { height: maxSide });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
    return { uri: out.uri, mime: 'image/jpeg', width: img.width, height: img.height };
  } catch { return null; }
}

async function pickRaw({ title = 'Bild wählen', crop }: Opts): Promise<PickedImage | null> {
  const src = await askSource(title);
  if (!src) return null;
  // Current: das Foto so übernehmen, wie es ist (kein Umwandeln von HEIC nach JPEG in voller Größe – das dauerte am iPhone
  // mehrere Sekunden). Verkleinert und nach JPEG gebracht wird es danach in einem Schritt (shrink).
  const common: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current };
  if (src === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Kamera nicht erlaubt', 'Erlaube ToLobby die Kamera in den iPhone-Einstellungen (Einstellungen → ToLobby → Kamera).');
      return null;
    }
    const r = await ImagePicker.launchCameraAsync(common);
    if (r.canceled || !r.assets?.[0]) return null;
    return { uri: r.assets[0].uri, mime: r.assets[0].mimeType || 'image/jpeg', width: r.assets[0].width, height: r.assets[0].height };
  }
  if (src === 'library') {
    const r = await ImagePicker.launchImageLibraryAsync(common);
    if (r.canceled || !r.assets?.[0]) return null;
    return { uri: r.assets[0].uri, mime: r.assets[0].mimeType || 'image/jpeg', width: r.assets[0].width, height: r.assets[0].height };
  }
  const d = await DocumentPicker.getDocumentAsync({ type: IMAGE_TYPES, copyToCacheDirectory: true, multiple: false });
  if (d.canceled || !d.assets?.[0]) return null;
  const a = d.assets[0];
  if (a.mimeType && !IMAGE_TYPES.includes(a.mimeType)) { Alert.alert('Kein passendes Bild', 'Bitte wähle ein JPG-, PNG-, WebP- oder GIF-Bild.'); return null; }
  if (a.size && a.size > 40 * 1024 * 1024) { Alert.alert('Bild zu groß', 'Das Bild darf höchstens 40 MB groß sein.'); return null; }
  return { uri: a.uri, mime: a.mimeType || 'image/jpeg' };
}
