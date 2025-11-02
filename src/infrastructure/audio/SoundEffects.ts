/**
 * スロット開始・勝利演出のサウンド再生を管理するクラス。
 * オーディオ要素のプリロードと再生可否チェックを行い、安全に効果音を鳴らします。
 */
export class SoundEffects {
  private winAudio: HTMLAudioElement | null = null;
  private spinAudio: HTMLAudioElement | null = null;
  private winAlertAudio: HTMLAudioElement | null = null;

  constructor(winSrc: string, spinSrc: string, winAlertSrc: string) {
    if (typeof Audio !== "undefined") {
      this.winAudio = new Audio(winSrc);
      this.winAudio.preload = "auto";
      this.spinAudio = new Audio(spinSrc);
      this.spinAudio.preload = "auto";
      // 勝利時の確定音もあらかじめ生成しておき、遅延なく再生できるようにする。
      this.winAlertAudio = new Audio(winAlertSrc);
      this.winAlertAudio.preload = "auto";
    }
  }

  async enable(): Promise<boolean> {
    try {
      await Promise.all(
        [this.winAudio, this.spinAudio, this.winAlertAudio].map(async (audio) => {
          if (!audio) return;
          await audio.play();
          audio.pause();
          audio.currentTime = 0;
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async playStart(sound: "win" | "spin"): Promise<void> {
    const target = sound === "win" ? this.winAudio : this.spinAudio;
    if (!target) return;
    try {
      target.currentTime = 0;
      await target.play();
    } catch {
      if (sound === "win") {
        await this.playFallbackSpin();
      }
    }
  }

  dispose() {
    this.winAudio = null;
    this.spinAudio = null;
    this.winAlertAudio = null;
  }

  private async playFallbackSpin() {
    if (!this.spinAudio) return;
    try {
      this.spinAudio.currentTime = 0;
      await this.spinAudio.play();
    } catch {
      // Ignore fallback failure
    }
  }

  async playWinAlert(): Promise<void> {
    // 全リール停止後に呼び出されるため、ここでは純粋に効果音の再生だけを担当する。
    if (!this.winAlertAudio) return;
    try {
      this.winAlertAudio.currentTime = 0;
      await this.winAlertAudio.play();
    } catch {
      // Ignore alert failure
    }
  }
}
