/**
 * スロット開始・勝利演出のサウンド再生を管理するクラス。
 * オーディオ要素のプリロードと再生可否チェックを行い、安全に効果音を鳴らします。
 */
export class SoundEffects {
  private spinAudio: HTMLAudioElement | null = null;
  private winAlertAudio: HTMLAudioElement | null = null;

  constructor(spinSrc: string, winAlertSrc: string) {
    if (typeof Audio !== "undefined") {
      this.spinAudio = new Audio(spinSrc);
      this.spinAudio.preload = "auto";
      this.winAlertAudio = new Audio(winAlertSrc);
      this.winAlertAudio.preload = "auto";
    }
  }

  async enable(): Promise<boolean> {
    try {
      await Promise.all(
        [this.spinAudio, this.winAlertAudio].map(async (audio) => {
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

  async playSpinStart(): Promise<void> {
    if (!this.spinAudio) return;
    try {
      this.spinAudio.currentTime = 0;
      await this.spinAudio.play();
    } catch {
      // Ignore spin sound failure
    }
  }

  async playWinAlert(): Promise<void> {
    if (!this.winAlertAudio) return;
    try {
      this.winAlertAudio.currentTime = 0;
      await this.winAlertAudio.play();
    } catch {
      // Ignore win alert failure
    }
  }

  dispose() {
    this.spinAudio = null;
    this.winAlertAudio = null;
  }
}
