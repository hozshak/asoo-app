// Im Browser (nur Vorschau beim Entwickeln) gibt es keine Lottie-Animation – dort zeigt Avatar das Standbild des Rahmens.
export const HAS_LOTTIE = false;
export function LottieFrame(_: { source: any; width: number; height: number }) {
  return null;
}
