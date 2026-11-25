// Profilrahmen wie in der Web-App (zuno-app/public/frames, Maße aus public/js/frames-data.js):
// w/h = Bildgröße, x/y = Mitte des Lochs – alles in Loch-Durchmessern (Loch = Profilbild).
// Premium-Rahmen sind in 3D gerendert (Gold, Platin mit Diamanten, Kristall …), darunter die Leuchtringe.
// In Listen zeigt die App das Standbild (liegt in der App); wo ein Profil groß zu sehen ist (live), spielt sie das
// bewegte Bild vom Server ab (<id>.anim.webp – wird nach dem ersten Laden auf dem Gerät behalten).
import { Platform } from 'react-native';
import { BASE } from './api';

export type Frame = { id: string; name: string; w: number; h: number; x: number; y: number; still: any; premium?: boolean };
const sq = (id: string, name: string, size: number, still: any, premium = false): Frame => ({ id, name, w: size, h: size, x: size / 2, y: size / 2, still, premium });
export const FRAMES: Record<string, Frame> = {
  // Premium-Kollektion (tools/build-frames4.mjs in der Web-App)
  aurum: sq('aurum', 'Feingold', 1.52, require('../../assets/frames/aurum.webp'), true),
  platin: sq('platin', 'Platin & Diamanten', 1.52, require('../../assets/frames/platin.webp'), true),
  rose: sq('rose', 'Roségold', 1.52, require('../../assets/frames/rose.webp'), true),
  holo: sq('holo', 'Holo-Chrom', 1.52, require('../../assets/frames/holo.webp'), true),
  obsidian: sq('obsidian', 'Obsidian & Glut', 1.56, require('../../assets/frames/obsidian.webp'), true),
  kristall: { id: 'kristall', name: 'Eiskristall', w: 1.76, h: 1.76, x: 0.88, y: 0.92, still: require('../../assets/frames/kristall.webp'), premium: true },
  neonduo: sq('neonduo', 'Neonglas', 1.6, require('../../assets/frames/neonduo.webp'), true),
  nebula: sq('nebula', 'Sternennebel', 1.68, require('../../assets/frames/nebula.webp'), true),
  perle: sq('perle', 'Perlen', 1.52, require('../../assets/frames/perle.webp'), true),
  smaragd: sq('smaragd', 'Smaragd', 1.56, require('../../assets/frames/smaragd.webp'), true),
  lorbeer: sq('lorbeer', 'Goldlorbeer', 1.72, require('../../assets/frames/lorbeer.webp'), true),
  carbon: sq('carbon', 'Carbon RGB', 1.56, require('../../assets/frames/carbon.webp'), true),
  // Leuchtringe (seit Web-Version 52)
  prisma: sq('prisma', 'Prisma', 1.36, require('../../assets/frames/prisma.webp')),
  neon: sq('neon', 'Neon', 1.36, require('../../assets/frames/neon.webp')),
  gold: sq('gold', 'Gold', 1.36, require('../../assets/frames/gold.webp')),
  orbit: sq('orbit', 'Orbit', 1.36, require('../../assets/frames/orbit.webp')),
  ember: sq('ember', 'Glut', 1.36, require('../../assets/frames/ember.webp')),
  frost: sq('frost', 'Frost', 1.36, require('../../assets/frames/frost.webp')),
  galaxy: sq('galaxy', 'Galaxie', 1.36, require('../../assets/frames/galaxy.webp')),
  sakura: sq('sakura', 'Sakura', 1.36, require('../../assets/frames/sakura.webp')),
  cyber: sq('cyber', 'Cyber', 1.36, require('../../assets/frames/cyber.webp')),
  pulse: sq('pulse', 'Herzschlag', 1.36, require('../../assets/frames/pulse.webp')),
  shadow: sq('shadow', 'Schatten', 1.36, require('../../assets/frames/shadow.webp')),
  diamant: sq('diamant', 'Diamant', 1.36, require('../../assets/frames/diamant.webp')),
};
/** Frühere Rahmen → passender neuer (wie FRAME_ALIAS in zuno-app/public/js/frames.js) */
// Passform: Das Loch in den Rahmen-Bildern ist 2–8 % größer als das Profilbild – es blieb ein dunkler Spalt. Je Rahmen
// ausgemessen (Innenkante des Rahmens) und so verkleinert, dass er das Profilbild knapp überdeckt (Innenkante bei 49 %).
const FIT: Record<string, number> = { aurum: 0.951, platin: 0.951, rose: 0.961, holo: 0.965, obsidian: 0.976, kristall: 0.968, neonduo: 0.968, nebula: 0.961, perle: 0.965, smaragd: 0.957, lorbeer: 0.959, carbon: 0.972, prisma: 0.961, neon: 0.925, gold: 0.961, ember: 0.951, frost: 0.942, galaxy: 0.966, sakura: 0.957, cyber: 0.957, pulse: 0.948, shadow: 0.966, diamant: 0.916 };
for (const [id, k] of Object.entries(FIT)) { const f = FRAMES[id]; if (f) { f.w *= k; f.h *= k; f.x *= k; f.y *= k; } }

const ALIAS: Record<string, string> = { 'gold-wings': 'gold', 'gold-stars': 'gold', 'gold-hex': 'gold', diamond: 'diamant', bronze: 'ember', lava: 'ember', moonlight: 'galaxy', arcade: 'cyber', aurora: 'prisma', inferno: 'ember', laser: 'cyber', laurel: 'gold', angel: 'gold', amor: 'pulse', volt: 'neon', neko: 'sakura', ocean: 'frost', glow: 'prisma', ring: 'prisma', wings: 'gold', crown: 'gold', flames: 'ember', hearts: 'pulse', stars: 'galaxy', halo: 'gold', leaves: 'sakura' };
/** Rahmen zu einer gespeicherten Kennung (auch alte Kennungen) */
export const frameOf = (id?: string | null): Frame | null => (id ? FRAMES[id] || FRAMES[ALIAS[id]] || null : null);
/** Ab welcher Größe ein Rahmen gezeigt wird (sonst wird er zu klein): breite Rahmen erst ab 72 px, sonst ab 36 px. */
export const frameMin = (f: Frame) => (f.w > 2.1 ? 72 : 36);
// Beim Entwickeln im Browser liegen die bewegten Bilder beim lokalen Asoo-Server (der Entwicklungs-Proxy reicht nur /api und /media durch)
const STATIC = BASE || (Platform.OS === 'web' && __DEV__ ? 'http://localhost:8796' : 'https://zuno-app.altraex.workers.dev');
/** Adresse des bewegten Bildes eines Rahmens */
export const frameAnim = (f: Frame) => ({ uri: `${STATIC}/frames/${f.id}.anim.webp` });
