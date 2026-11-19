// Profilrahmen wie in der Web-App (Lottie-Animationen, zuno-app/public/frames). Maße aus frames-data.js:
// w/h = Bildgröße, x/y = Mitte des Lochs – alles in Loch-Durchmessern (Loch = Profilbild).
export type Frame = { name: string; w: number; h: number; x: number; y: number; json: any; still: any };
export const FRAMES: Record<string, Frame> = {
  'gold-wings': { name: 'Goldflügel', w: 1.8156, h: 1.8156, x: 0.8991, y: 0.9311, json: require('../../assets/frames/gold-wings.json'), still: require('../../assets/frames/gold-wings.webp') },
  'gold-stars': { name: 'Sternenflügel', w: 1.8156, h: 1.8156, x: 0.9098, y: 0.9346, json: require('../../assets/frames/gold-stars.json'), still: require('../../assets/frames/gold-stars.webp') },
  diamond: { name: 'Diamant', w: 3.5562, h: 2.1045, x: 1.7781, y: 0.9932, json: require('../../assets/frames/diamond.json'), still: require('../../assets/frames/diamond.webp') },
  bronze: { name: 'Bronze', w: 2.9091, h: 1.7216, x: 1.4525, y: 0.8587, json: require('../../assets/frames/bronze.json'), still: require('../../assets/frames/bronze.webp') },
  lava: { name: 'Lavakönig', w: 2.7234, h: 2.7234, x: 1.3115, y: 1.4232, json: require('../../assets/frames/lava.json'), still: require('../../assets/frames/lava.webp') },
  moonlight: { name: 'Mondfalter', w: 1.6667, h: 1.6667, x: 0.8333, y: 0.8333, json: require('../../assets/frames/moonlight.json'), still: require('../../assets/frames/moonlight.webp') },
  'gold-hex': { name: 'Goldwabe', w: 1.6623, h: 1.6623, x: 0.833, y: 0.8005, json: require('../../assets/frames/gold-hex.json'), still: require('../../assets/frames/gold-hex.webp') },
  arcade: { name: 'Arcade', w: 2.7826, h: 2.7826, x: 1.3726, y: 1.3183, json: require('../../assets/frames/arcade.json'), still: require('../../assets/frames/arcade.webp') },
};
/** Ab welcher Größe ein Rahmen gezeigt wird (sonst wird er zu klein): breite Rahmen erst ab 72 px, sonst ab 36 px. */
export const frameMin = (f: Frame) => (f.w > 2.1 ? 72 : 36);
