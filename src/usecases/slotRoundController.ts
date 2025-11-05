import { SlotMachineManager, type RoundStartPayload, type RoundPlan } from "./slotMachineManager";
import type { SoundEffects } from "../infrastructure/audio/SoundEffects";

type TimerHandle = ReturnType<typeof window.setTimeout> | null;
type AnimationHandle = ReturnType<typeof window.requestAnimationFrame> | null;

type TimerAPI = {
  setTimeout(handler: () => void, timeout: number): number;
  clearTimeout(handle: number): void;
};

type AnimationAPI = {
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(handle: number): void;
};

const browserWindow = typeof window === "undefined" ? null : window;

const defaultTimers: TimerAPI = browserWindow
  ? {
      setTimeout: (handler, timeout) => browserWindow.setTimeout(handler, timeout),
      clearTimeout: (handle) => browserWindow.clearTimeout(handle),
    }
  : {
      // SSR 環境では即時実行し、副作用を抑える。
      setTimeout: (handler) => {
        handler();
        return 0;
      },
      clearTimeout: () => {
        /* noop */
      },
    };

const defaultAnimation: AnimationAPI = browserWindow
  ? {
      requestAnimationFrame: (callback) => browserWindow.requestAnimationFrame(callback),
      cancelAnimationFrame: (handle) => browserWindow.cancelAnimationFrame(handle),
    }
  : {
      requestAnimationFrame: (callback) => {
        callback(0);
        return 0;
      },
      cancelAnimationFrame: () => {
        /* noop */
      },
    };

export type RoundLifecycleCallbacks = {
  /**
   * ラウンド開始前の下準備を行い、React 側の状態を更新するためのコールバック。
   */
  onPrepare(plan: RoundPlan): void;
  /**
   * リールの目標位置を確定し、スピンを始めるためのコールバック。
   */
  onSpin(targetIndexes: number[]): void;
  /**
   * リーチ演出の開始を通知する。
   */
  onReachStart(): void;
  /**
   * リーチ演出の終了または中断を通知する。
   */
  onReachEnd(): void;
  /**
   * 勝利演出の開始を通知する。
   */
  onWin(): void;
};

/**
 * スロットの 1 ラウンド分の制御をまとめ、App.tsx から非同期処理を切り離すユースケース。
 * Presentation 層とインフラを仲介する Mediator/Coordinator の役割を担う。
 * タイマーとアニメーションのスケジューリング、演出開始タイミング、効果音の再生を担う。
 */
export class SlotRoundController {
  private startTimer: TimerHandle = null;
  private finishTimer: TimerHandle = null;
  private reachStartTimer: TimerHandle = null;
  private reachEndTimer: TimerHandle = null;
  private firstFrame: AnimationHandle = null;
  private secondFrame: AnimationHandle = null;
  private reachActive = false;
  private readonly slotManager: SlotMachineManager;
  private readonly timers: TimerAPI;
  private readonly animation: AnimationAPI;

  constructor(
    slotManager: SlotMachineManager,
    timers: TimerAPI = defaultTimers,
    animation: AnimationAPI = defaultAnimation,
  ) {
    this.slotManager = slotManager;
    this.timers = timers;
    this.animation = animation;
  }

  handleRoundStart(
    payload: RoundStartPayload,
    callbacks: RoundLifecycleCallbacks,
    effects?: SoundEffects | null,
  ): void {
    const plan = this.slotManager.planRound(payload);
    this.reset();

    const startRound = () => {
      this.startTimer = null;
      callbacks.onPrepare(plan);

      const shouldTriggerReach = this.shouldTriggerReach(plan);
      const rightReelStopMs = plan.baseSpinDurationMs + this.slotManager.reelDelayMs;

      this.firstFrame = this.animation.requestAnimationFrame(() => {
        this.firstFrame = null;
        this.secondFrame = this.animation.requestAnimationFrame(() => {
          this.secondFrame = null;
          // 受信直後のフレームで即座に回転を開始し、2 回目以降でもラグが生まれないようにする。
          callbacks.onSpin(plan.targetIndexes);
          if (shouldTriggerReach) {
            this.scheduleReach(plan, rightReelStopMs, callbacks);
          }
        });
      });

      this.playStartSound(plan, effects);
      this.scheduleFinish(plan, callbacks, effects);
    };

    if (plan.delayMs <= 0) {
      // 遅延指定が無い場合は WebSocket の受信直後に即時実行して初期フレームを合わせる。
      startRound();
    } else {
      this.startTimer = this.timers.setTimeout(startRound, plan.delayMs);
    }
  }

  dispose(): void {
    this.reset();
  }

  private reset(): void {
    if (this.startTimer !== null) {
      this.timers.clearTimeout(this.startTimer);
      this.startTimer = null;
    }
    if (this.finishTimer !== null) {
      this.timers.clearTimeout(this.finishTimer);
      this.finishTimer = null;
    }
    if (this.reachStartTimer !== null) {
      this.timers.clearTimeout(this.reachStartTimer);
      this.reachStartTimer = null;
    }
    if (this.reachEndTimer !== null) {
      this.timers.clearTimeout(this.reachEndTimer);
      this.reachEndTimer = null;
    }
    if (this.firstFrame !== null) {
      this.animation.cancelAnimationFrame(this.firstFrame);
      this.firstFrame = null;
    }
    if (this.secondFrame !== null) {
      this.animation.cancelAnimationFrame(this.secondFrame);
      this.secondFrame = null;
    }
    if (this.reachActive) {
      this.reachActive = false;
    }
  }

  private shouldTriggerReach(plan: RoundPlan): boolean {
    return (
      this.slotManager.reelCount >= 3 &&
      plan.targetIndexes.length >= 3 &&
      plan.targetIndexes[0] === plan.targetIndexes[2]
    );
  }

  private scheduleReach(
    plan: RoundPlan,
    rightReelStopMs: number,
    callbacks: RoundLifecycleCallbacks,
  ): void {
    const reachDelay = Math.max(0, rightReelStopMs);
    this.reachStartTimer = this.timers.setTimeout(() => {
      this.reachStartTimer = null;
      this.reachActive = true;
      callbacks.onReachStart();
      const remainingMs = plan.totalSpinMs - rightReelStopMs;
      if (remainingMs > 0) {
        this.reachEndTimer = this.timers.setTimeout(() => {
          this.reachEndTimer = null;
          this.reachActive = false;
          callbacks.onReachEnd();
        }, remainingMs);
      }
    }, reachDelay);
  }

  private async playStartSound(plan: RoundPlan, effects?: SoundEffects | null): Promise<void> {
    if (!effects) return;
    try {
      await effects.playStart(plan.startSound);
    } catch {
      if (plan.startSound === "win") {
        try {
          await effects.playStart("spin");
        } catch {
          /* noop */
        }
      }
    }
  }

  private scheduleFinish(
    plan: RoundPlan,
    callbacks: RoundLifecycleCallbacks,
    effects?: SoundEffects | null,
  ): void {
    this.finishTimer = this.timers.setTimeout(() => {
      this.finishTimer = null;
      if (!plan.isWin) return;

      if (this.reachStartTimer !== null) {
        this.timers.clearTimeout(this.reachStartTimer);
        this.reachStartTimer = null;
      }
      if (this.reachEndTimer !== null) {
        this.timers.clearTimeout(this.reachEndTimer);
        this.reachEndTimer = null;
      }
      if (this.reachActive) {
        this.reachActive = false;
        callbacks.onReachEnd();
      }

      if (!effects) {
        return;
      }

      (async () => {
        try {
          await effects.playWinAlert();
          callbacks.onWin();
        } catch {
          /* 音声再生に失敗した場合は演出を開始しない。 */
        }
      })();
    }, plan.totalSpinMs);
  }
}
