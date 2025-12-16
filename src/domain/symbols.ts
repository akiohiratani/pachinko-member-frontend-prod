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
  { src: "/symbols/1.png", alt: "1" },
  { src: "/symbols/2.png", alt: "2" },
  { src: "/symbols/3.png", alt: "3" },
  { src: "/symbols/4.png", alt: "4" },
  { src: "/symbols/5.png", alt: "5" },
] as const;
