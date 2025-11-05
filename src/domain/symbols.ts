/**
 * 値オブジェクトとして扱うスロットシンボル定義。
 * Immutable Data パターンで UI 層へ安全に共有する。
 */
export type SymbolDef = {
  src: string;
  alt: string;
};

/**
 * UI やユースケースで共有するための定数コレクション。
 */
export const SYMBOLS: readonly SymbolDef[] = [
  { src: "/symbols/1.png", alt: "Amazon ギフト" },
  { src: "/symbols/2.png", alt: "ストロングゼロ ダブルレモン" },
  { src: "/symbols/3.png", alt: "LINE（人物イメージ）" },
  { src: "/symbols/4.png", alt: "ハーゲンダッツ バニラ" },
] as const;
