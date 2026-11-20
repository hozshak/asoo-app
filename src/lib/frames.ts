// Profilrahmen wie in der Web-App (Lottie-Animationen, zuno-app/public/frames). Maße aus frames-data.js:
// w/h = Bildgröße, x/y = Mitte des Lochs – alles in Loch-Durchmessern (Loch = Profilbild).
export type Frame = { name: string; w: number; h: number; x: number; y: number; json: any; still: any };
export const FRAMES: Record<string, Frame> = {
  // Leuchtrahmen (seit Web-Version 52): Standbilder aus zuno-app/public/frames, eng um das Profilbild
  prisma: { name: 'Prisma', w: 1.36, h: 1.36, x: 0.68, y: 0.68, json: null, still: require('../../assets/frames/prisma.webp') },
  neon: { name: 'Neon', w: 1.36, h: 1.36, x: 0.68, y: 0.68, json: null, still: require('../../assets/frames/neon.webp') },
  gold: { name: 'Gold', w: 1.36, h: 1.36, x: 0.68, y: 0.68, json: null, still: require('../../assets/frames/gold.webp') },
  orbit: { name: 'Orbit', w: 1.36, h: 1.36, x: 0.68, y: 0.68, json: null, still: require('../../assets/frames/orbit.webp') },
  ember: { name: 'Glut', w: 1.36, h: 1.36, x: 0.68, y: 0.68, json: null, still: require('../../assets/frames/ember.webp') },
  frost: { name: 'Frost', w: 1.36, h: 1.36, x: 0.68, y: 0.68, json: null, still: require('../../assets/frames/frost.webp') },
  galaxy: { name: 'Galaxie', w: 1.36, h: 1.36, x: 0.68, y: 0.68, json: null, still: require('../../assets/frames/galaxy.webp') },
  sakura: { name: 'Sakura', w: 1.36, h: 1.36, x: 0.68, y: 0.68, json: null, still: require('../../assets/frames/sakura.webp') },
  cyber: { name: 'Cyber', w: 1.36, h: 1.36, x: 0.68, y: 0.68, json: null, still: require('../../assets/frames/cyber.webp') },
  pulse: { name: 'Herzschlag', w: 1.36, h: 1.36, x: 0.68, y: 0.68, json: null, still: require('../../assets/frames/pulse.webp') },
  shadow: { name: 'Schatten', w: 1.36, h: 1.36, x: 0.68, y: 0.68, json: null, still: require('../../assets/frames/shadow.webp') },
  diamant: { name: 'Diamant', w: 1.36, h: 1.36, x: 0.68, y: 0.68, json: null, still: require('../../assets/frames/diamant.webp') },
};
/** Frühere Rahmen → passender neuer (wie FRAME_ALIAS in zuno-app/public/js/frames.js) */
const ALIAS: Record<string, string> = { 'gold-wings': 'gold', 'gold-stars': 'gold', 'gold-hex': 'gold', diamond: 'diamant', bronze: 'ember', lava: 'ember', moonlight: 'galaxy', arcade: 'cyber', aurora: 'prisma', inferno: 'ember', laser: 'cyber', laurel: 'gold', angel: 'gold', amor: 'pulse', volt: 'neon', neko: 'sakura', ocean: 'frost', glow: 'prisma', ring: 'prisma', wings: 'gold', crown: 'gold', flames: 'ember', hearts: 'pulse', stars: 'galaxy', halo: 'gold', leaves: 'sakura' };
/** Rahmen zu einer gespeicherten Kennung (auch alte Kennungen) */
export const frameOf = (id?: string | null): Frame | null => (id ? FRAMES[id] || FRAMES[ALIAS[id]] || null : null);
/** Ab welcher Größe ein Rahmen gezeigt wird (sonst wird er zu klein): breite Rahmen erst ab 72 px, sonst ab 36 px. */
export const frameMin = (f: Frame) => (f.w > 2.1 ? 72 : 36);
