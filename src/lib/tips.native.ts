// „ToLobby unterstützen“ in der iPhone-App: freiwilliges Trinkgeld über Apple (In-App-Kauf, Verbrauchsartikel).
// Apple verlangt für Geld an den App-Anbieter den Kauf über Apple – PayPal-Links sind in der App deshalb tabu.
// Die Käufe schalten nichts frei, sie sind ein Dankeschön. Abschluss (finishTransaction) passiert hier zentral, auch für
// Käufe, die iOS beim nächsten Start nachliefert (z. B. wenn die App während des Kaufs geschlossen wurde).
import { Platform } from 'react-native';
import { endConnection, fetchProducts, finishTransaction, initConnection, purchaseErrorListener, purchaseUpdatedListener, requestPurchase } from 'expo-iap';

/** Artikel-Kennungen – genau so in App Store Connect angelegt (Typ „Verbrauchsartikel“) */
export const TIP_SKUS = ['tolobby_tip_small', 'tolobby_tip_medium', 'tolobby_tip_large'] as const;
export type Tip = { id: string; price: string; title: string };

let started: Promise<boolean> | null = null;
const thanks = new Set<(sku: string) => void>();
const errors = new Set<(msg: string) => void>();

/** Verbindung zum App Store (einmal je App-Start); false = geht hier nicht (Browser, Simulator ohne StoreKit …) */
export function startTips(): Promise<boolean> {
  if (Platform.OS !== 'ios') return Promise.resolve(false);
  return (started ||= (async () => {
    try {
      await initConnection();
      purchaseUpdatedListener(async (p: any) => {
        if (!TIP_SKUS.includes(p?.productId)) return;
        try { await finishTransaction({ purchase: p, isConsumable: true }); } catch { /* nächster Start versucht es erneut */ }
        thanks.forEach((f) => f(p.productId));
      });
      purchaseErrorListener((e: any) => {
        if (/cancel/i.test(String(e?.code || e?.message || ''))) return; // abgebrochen: kein Fehler
        errors.forEach((f) => f(String(e?.message || e?.code || 'error')));
      });
      return true;
    } catch { started = null; return false; }
  })());
}
export const onTipThanks = (f: (sku: string) => void) => { thanks.add(f); return () => { thanks.delete(f); }; };
export const onTipError = (f: (msg: string) => void) => { errors.add(f); return () => { errors.delete(f); }; };

/** Preise in der Landeswährung des Nutzers (von Apple) */
export async function loadTips(): Promise<Tip[]> {
  if (!(await startTips())) return [];
  const list: any[] = (await fetchProducts({ skus: [...TIP_SKUS], type: 'in-app' }).catch(() => [])) || [];
  return TIP_SKUS.map((sku) => list.find((p) => p.id === sku)).filter(Boolean).map((p: any) => ({ id: p.id, price: p.displayPrice, title: p.title }));
}
export async function buyTip(sku: string) {
  if (!(await startTips())) throw new Error('not_available');
  await requestPurchase({ request: { apple: { sku } }, type: 'in-app' } as any);
}
export const stopTips = () => { if (started) { endConnection().catch(() => {}); started = null; } };
