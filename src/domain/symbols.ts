export type SymbolDef = {
  src: string;
  alt: string;
};

export const SYMBOLS: readonly SymbolDef[] = [
  { src: "/symbols/1.png", alt: "Amazon ギフト" },
  { src: "/symbols/2.png", alt: "ストロングゼロ ダブルレモン" },
  { src: "/symbols/3.png", alt: "LINE（人物イメージ）" },
  { src: "/symbols/4.png", alt: "ハーゲンダッツ バニラ" },
] as const;
