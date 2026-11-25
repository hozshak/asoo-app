// Bildschirm teilen gibt es nur am iPhone (ScreenPicker.native.tsx) – im Browser nichts.
import { createRef } from 'react';
export const screenPickerRef = createRef<any>();
export function GlobalScreenPicker() { return null; }
