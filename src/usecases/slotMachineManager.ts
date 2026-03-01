import { SLOT_MACHINE_CONFIG } from "../domain/slotMachine";
import { SYMBOLS } from "../domain/symbols";
import { defaultRandom, randomInt } from "../domain/random";
import type { RandomGenerator } from "../domain/random";

export type RoundStartPayload = {
  startAt?: string;
  winProbability?: number;
  winIndex?: number;
  [key: string]: unknown;
};

export type RoundPlan = {
  targetIndexes: number[];
  baseSpinDurationMs: number;
  delayMs: number;
  totalSpinMs: number;
  startSound: "win" | "spin";
  isWin: boolean;
  /**
   * リーチが発生した際に最後のリールへ追加する演出用のディレイ時間。
   * リーチではない場合は 0 として扱います。
   */
  reachExtraDelayMs: number;
  reachFakeout: {
    enabled: boolean;
    fakeIndex: number;
    shiftMs: number;
  };
};

/**
 * ドメイン設定とインフラを束ね、1 ラウンド分のスロット挙動を計画するユースケース。
 * Application Service（サービスオブジェクト）として Round 計画を生成し、
 * 当たり判定、停止位置、演出時間、効果音などを一括で決定します。
 */
export class SlotMachineManager {
  private readonly random: RandomGenerator;

  constructor(random: RandomGenerator = defaultRandom) {
    this.random = random;
  }

  planRound(payload: RoundStartPayload, now = Date.now()): RoundPlan {
    const winProbability = this.resolveWinProbability(payload);
    SLOT_MACHINE_CONFIG.winProbability = winProbability;
    const isWin = this.random.float() < winProbability;
    const targetIndexes = this.decideTargets(isWin);
    // 左右のリールが揃っていて中央のみが異なる場合をリーチとみなす。
    const isReach =
      SLOT_MACHINE_CONFIG.reelCount >= 3 &&
      targetIndexes[0] === targetIndexes[2];
    // リーチ時は 5~10 秒の余韻を最後のリールへ追加し、演出を長めにする。
    const reachExtraDelayMs = isReach ? randomInt(this.random, 20000, 25000) : 3000;
    const reachFakeout = this.decideReachFakeout(isWin, isReach, targetIndexes);

    // リーチでない通常時の総演出時間を決めたうえで、最後のリール分を除いた基本時間を算出する。
    // リーチの追加演出分は最後のリールに加算されるため、totalSpinMs にのみ反映する。
    const sequentialDelayTotal =
      SLOT_MACHINE_CONFIG.reelDelayMs * (SLOT_MACHINE_CONFIG.reelCount - 1);
    const desiredTotalMs = randomInt(
      this.random,
      SLOT_MACHINE_CONFIG.minTotalSpinMs,
      SLOT_MACHINE_CONFIG.maxTotalSpinMs,
    );
    const baseSpinDurationMs = Math.max(
      0,
      desiredTotalMs - sequentialDelayTotal,
    );

    const delayMs = this.calculateDelay(payload.startAt, now);
    const startSound: "win" | "spin" =
      isWin && this.random.float() < SLOT_MACHINE_CONFIG.winStartSoundProbability ? "win" : "spin";

    return {
      targetIndexes,
      baseSpinDurationMs,
      delayMs,
      totalSpinMs: baseSpinDurationMs + sequentialDelayTotal + reachExtraDelayMs,
      startSound,
      isWin,
      reachExtraDelayMs,
      reachFakeout,
    };
  }

  get reelCount(): number {
    return SLOT_MACHINE_CONFIG.reelCount;
  }

  get easing(): string {
    return SLOT_MACHINE_CONFIG.easing;
  }

  get reelDelayMs(): number {
    return SLOT_MACHINE_CONFIG.reelDelayMs;
  }

  preloadSymbols(): void {
    SYMBOLS.forEach((symbol) => {
      const img = new Image();
      img.src = symbol.src;
    });
  }

  private resolveWinProbability(payload: RoundStartPayload): number {
    const rawProbability = payload.winProbability ?? payload.winIndex;
    if (typeof rawProbability === "number" && Number.isFinite(rawProbability)) {
      const normalized = rawProbability / 100;
      return Math.min(Math.max(normalized, 0), 1);
    }

    return SLOT_MACHINE_CONFIG.winProbability;
  }

  private calculateDelay(startAt: string | undefined, now: number): number {
    if (!startAt) return 0;
    const startDate = new Date(startAt);
    if (Number.isNaN(startDate.getTime())) return 0;
    return Math.max(0, startDate.getTime() - now);
  }

  private decideTargets(isWin: boolean): number[] {
    if (isWin) {
      const symbolIndex = randomInt(this.random, 0, SYMBOLS.length - 1);
      return Array(SLOT_MACHINE_CONFIG.reelCount).fill(symbolIndex);
    }

    const baseSymbol = randomInt(this.random, 0, SYMBOLS.length - 1);
    const diffReel = randomInt(this.random, 0, SLOT_MACHINE_CONFIG.reelCount - 1);

    let diffSymbol = baseSymbol;
    while (diffSymbol === baseSymbol) {
      diffSymbol = randomInt(this.random, 0, SYMBOLS.length - 1);
    }

    return Array.from({ length: SLOT_MACHINE_CONFIG.reelCount }, (_, index) =>
      index === diffReel ? diffSymbol : baseSymbol,
    );
  }

  private decideReachFakeout(
    isWin: boolean,
    isReach: boolean,
    targetIndexes: number[],
  ): RoundPlan["reachFakeout"] {
    if (!isWin || !isReach || targetIndexes.length < 2) {
      return { enabled: false, fakeIndex: 0, shiftMs: 0 };
    }

    // 1/3 の確率で「外れたと思いきや当たる」演出を有効化する。
    const enabled = this.random.float() < 1 / 3;
    if (!enabled) {
      return { enabled: false, fakeIndex: 0, shiftMs: 0 };
    }

    const centerIndex = 1;
    const hitIndex = targetIndexes[centerIndex] ?? 0;
    // 「1」が当たり図柄の場合は「5」で一旦止める演出を優先する。
    // それ以外の当たり図柄でも、必ず別図柄へフェイク停止させる。
    const fakeIndex =
      hitIndex === 0
        ? SYMBOLS.length - 1
        : this.pickDifferentSymbolIndex(hitIndex);

    return {
      enabled: true,
      fakeIndex,
      shiftMs: randomInt(this.random, 280, 420),
    };
  }

  private pickDifferentSymbolIndex(excludedIndex: number): number {
    let selected = excludedIndex;
    while (selected === excludedIndex) {
      selected = randomInt(this.random, 0, SYMBOLS.length - 1);
    }
    return selected;
  }
}
