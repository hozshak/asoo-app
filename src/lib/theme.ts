// Farben, Verläufe und Schrift von Asoo – genau wie das „moderne Erscheinungsbild“ der Web-App
// (zuno-app/public/css/app.css, Abschnitt „Asoo – modernes Erscheinungsbild“).
export const C = {
  bg0: '#07070d',
  bg1: '#0e0f18',
  bg2: '#131420',
  bg3: '#1b1c2b',
  bg4: '#24263a',
  bg5: '#2f3149',
  line: 'rgba(255,255,255,0.075)',
  text: '#f3f3f9',
  text2: '#d0d1e2',
  muted: '#9c9db6',
  faint: '#73748f',
  accent: '#8468ff',
  accent2: '#ff5c9a',
  accentSoft: 'rgba(132,104,255,0.17)',
  accentLine: 'rgba(132,104,255,0.34)',
  info: '#2ec5ff',
  ok: '#3ddc97',
  warn: '#ffb02e',
  danger: '#ff4d5e',
  mention: 'rgba(255,176,46,0.10)',
  mentionLine: '#ffb02e',
};
/** Startseite wie bei Discord: drei ruhige Stufen derselben Farbe statt Leuchten –
 *  links die Server-Leiste am dunkelsten, rechts die Liste eine Stufe heller, Knöpfe und Profilleiste noch eine Stufe heller. */
export const HOME = { rail: '#0c0c13', panel: '#14151f', raised: '#1d1e2b', bar: '#202131', edge: 'rgba(255,255,255,0.06)' };
/** Der Farbverlauf der Web-App (--grad): Knöpfe, aktiver Server, Senden. */
export const GRAD = ['#8468ff', '#b260ff', '#ff5c9a'] as const;
export const GRAD_POS = [0, 0.52, 1] as const;
export const R = { sm: 8, md: 12, lg: 16, xl: 22 };
export const statusColor = (s?: string) => (s === 'online' ? C.ok : s === 'idle' ? C.warn : s === 'dnd' ? C.danger : C.faint);

// Schrift: Cairo wie im Web (variable Schrift dort, hier die festen Stärken)
export const F = {
  regular: 'Cairo_400Regular',
  medium: 'Cairo_500Medium',
  semibold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
  heavy: 'Cairo_800ExtraBold',
};
export const fontFor = (w?: string | number) => {
  const n = typeof w === 'string' ? (w === 'bold' ? 700 : parseInt(w, 10) || 400) : w || 400;
  return n >= 800 ? F.heavy : n >= 700 ? F.bold : n >= 600 ? F.semibold : n >= 500 ? F.medium : F.regular;
};
