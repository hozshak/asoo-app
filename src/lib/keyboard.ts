// Tastatur am iPhone: Ist sie offen, braucht das Eingabefeld unten keinen Platz für den Home-Balken (sonst entsteht eine
// Lücke über der Tastatur). Der Abstand zur Kopfzeile richtet sich nach dem Gerät (mit Dynamic Island ist sie höher).
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return open;
}

/** Höhe der Kopfzeile eines Stapel-Bildschirms (Statusleiste + 44 Punkte Leiste) – für KeyboardAvoidingView. */
export function useHeaderOffset() {
  const ins = useSafeAreaInsets();
  return Platform.OS === 'ios' ? ins.top + 44 : 0;
}

/** Abstand unter dem Eingabefeld: Home-Balken bei geschlossener Tastatur, sonst nur ein kleiner Rand. */
export function useComposerPad(min = 10) {
  const ins = useSafeAreaInsets();
  const open = useKeyboardOpen();
  return open ? 8 : Math.max(ins.bottom, min);
}
