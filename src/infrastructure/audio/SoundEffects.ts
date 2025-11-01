export class SoundEffects {
  private winAudio: HTMLAudioElement | null = null;
  private spinAudio: HTMLAudioElement | null = null;

  constructor(winSrc: string, spinSrc: string) {
    if (typeof Audio !== "undefined") {
      this.winAudio = new Audio(winSrc);
      this.winAudio.preload = "auto";
      this.spinAudio = new Audio(spinSrc);
      this.spinAudio.preload = "auto";
    }
  }

  async enable(): Promise<boolean> {
    try {
      await Promise.all(
        [this.winAudio, this.spinAudio].map(async (audio) => {
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
}
