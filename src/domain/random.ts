/**
 * Strategy パターンで乱数生成ロジックを差し替え可能にするためのインターフェース。
 * ドメイン層からインフラ依存を切り離し、テスト容易性と再利用性を高める。
 */
export interface RandomGenerator {
  float(): number;
}

/**
 * 暗号学的乱数 API を優先的に利用して一様乱数を提供するジェネレーター。
 * ブラウザが対応していない場合は Math.random を自動でフォールバックします。
 */
class CryptoRandomGenerator implements RandomGenerator {
  float(): number {
    if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      return array[0] / 2 ** 32;
    }
    return Math.random();
  }
}

export const defaultRandom = new CryptoRandomGenerator();

export function randomInt(random: RandomGenerator, minIncl: number, maxIncl: number) {
  const r = random.float();
  return Math.floor(r * (maxIncl - minIncl + 1)) + minIncl;
}
