/**
 * スロット開始・勝利演出のサウンド再生を管理するクラス。
 * Audio 要素をカプセル化する Facade パターンで、UI からの利用をシンプルに保ちます。
 * オーディオ要素のプリロードと再生可否チェックを行い、安全に効果音を鳴らします。
 */
export class SoundEffects {
  private winAudio: HTMLAudioElement | null = null;
  private spinAudio: HTMLAudioElement | null = null;
  private winAlertAudio: HTMLAudioElement | null = null;
  private reachAudio: HTMLAudioElement | null = null;

  constructor(
    winSrc: string,
    spinSrc: string,
    winAlertSrc: string,
    reachSrc: string,
  ) {
    if (typeof Audio !== "undefined") {
      this.winAudio = new Audio(winSrc);
      this.winAudio.preload = "auto";
      this.spinAudio = new Audio(spinSrc);
      this.spinAudio.preload = "auto";
      // 勝利時の確定音もあらかじめ生成しておき、遅延なく再生できるようにする。
      this.winAlertAudio = new Audio(winAlertSrc);
      this.winAlertAudio.preload = "auto";
      // リーチ演出用のサウンドも事前に生成し、点滅と同期させる際の再生遅延を抑える。
      this.reachAudio = new Audio(reachSrc);
      this.reachAudio.preload = "auto";
      this.reachAudio.loop = true;
    }
  }

  async enable(): Promise<boolean> {
    try {
      await Promise.all(
        [
          this.winAudio,
          this.spinAudio,
          this.winAlertAudio,
          this.reachAudio,
        ].map(async (audio) => {
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
    this.reachAudio = null;
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

  async playReachPulse(): Promise<void> {
    // リールの点滅タイミングと同期させるため、再生位置を巻き戻して毎回短い効果音を鳴らす。
    if (!this.reachAudio) return;
    // モバイルブラウザでは再生中に currentTime を巻き戻すと音が途切れるため、
    // 一度再生を開始したらループ再生に任せる。
    if (!this.reachAudio.paused) {
      return;
    }
    try {
      this.reachAudio.currentTime = 0;
      await this.reachAudio.play();
    } catch {
      // Ignore reach failure
    }
  }

  stopReachPulse(): void {
    // リーチ演出が終了した瞬間に音を停止し、次回演出の先頭から再生できるように初期化する。
    if (!this.reachAudio) return;
    this.reachAudio.pause();
    this.reachAudio.currentTime = 0;
  }
}
