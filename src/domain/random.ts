export interface RandomGenerator {
  float(): number;
}

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
