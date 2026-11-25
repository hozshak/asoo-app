// Trinkgeld über Apple gibt es nur in der iPhone-App (tips.native.ts). Im Browser (Entwicklungs-Vorschau) leere Gegenstücke.
export const TIP_SKUS = ['tolobby_tip_small', 'tolobby_tip_medium', 'tolobby_tip_large'] as const;
export type Tip = { id: string; price: string; title: string };
export const startTips = async () => false;
export const onTipThanks = (_f: (sku: string) => void) => () => {};
export const onTipError = (_f: (msg: string) => void) => () => {};
export const loadTips = async (): Promise<Tip[]> => [];
export const buyTip = async (_sku: string) => { throw new Error('not_available'); };
export const stopTips = () => {};
