// Unsichtbarer iOS-Knopf „Übertragung starten“ – darüber zeigt iOS das Auswahlfenster fürs Bildschirm-Teilen.
// WICHTIG: Es darf nur EINEN davon geben, und er muss im sichtbaren Fenster hängen. Das iOS-Steuerteil
// (ScreenCapturePickerViewManager) merkt sich nur den zuletzt angelegten Knopf – lag der im versteckten Web-Fenster,
// zeigte iOS ein leeres graues Auswahlfenster und danach ging nichts mehr. Deshalb: ein Knopf ganz oben in _layout.tsx.
import type React from 'react';
import { createRef } from 'react';
import { Platform } from 'react-native';
import { ScreenCapturePickerView } from 'react-native-webrtc';

const PICK = ScreenCapturePickerView as unknown as React.ComponentType<any>;
/** Der eine Knopf der App (für startScreenShare / captureScreen). */
export const screenPickerRef = createRef<any>();
export function GlobalScreenPicker() {
  if (Platform.OS !== 'ios') return null;
  return <PICK ref={screenPickerRef} style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01, left: 0, top: 0 }} pointerEvents="none" />;
}
