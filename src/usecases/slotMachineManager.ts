import { SLOT_MACHINE_CONFIG } from "../domain/slotMachine";
import { SYMBOLS } from "../domain/symbols";
import { defaultRandom, randomInt } from "../domain/random";
import type { RandomGenerator } from "../domain/random";

export type RoundStartPayload = {
  startAt?: string;
  [key: string]: unknown;
};

export type RoundPlan = {
  targetIndexes: number[];
  baseSpinDurationMs: number;
  delayMs: number;
  totalSpinMs: number;
  startSound: "win" | "spin";
  isWin: boolean;
};

export class SlotMachineManager {
  private readonly random: RandomGenerator;

  constructor(random: RandomGenerator = defaultRandom) {
    this.random = random;
  }

  planRound(payload: RoundStartPayload, now = Date.now()): RoundPlan {
    const isWin = this.random.float() < SLOT_MACHINE_CONFIG.winProbability;
    const targetIndexes = this.decideTargets(isWin);
    const desiredTotalMs = randomInt(
      this.random,
      SLOT_MACHINE_CONFIG.minTotalSpinMs,
      SLOT_MACHINE_CONFIG.maxTotalSpinMs,
    );
    const baseSpinDurationMs = Math.max(
      0,
      desiredTotalMs - SLOT_MACHINE_CONFIG.reelDelayMs * (SLOT_MACHINE_CONFIG.reelCount - 1),
    );

    const delayMs = this.calculateDelay(payload.startAt, now);
    const startSound: "win" | "spin" =
      isWin && this.random.float() < SLOT_MACHINE_CONFIG.winStartSoundProbability ? "win" : "spin";

    return {
      targetIndexes,
      baseSpinDurationMs,
      delayMs,
      totalSpinMs:
        baseSpinDurationMs + SLOT_MACHINE_CONFIG.reelDelayMs * (SLOT_MACHINE_CONFIG.reelCount - 1),
      startSound,
      isWin,
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
}
