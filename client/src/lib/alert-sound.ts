let ctx: AudioContext | null = null;

/** Short two-tone chime via Web Audio — no asset to ship. Silently no-ops without an audio device. */
export function playAlertSound() {
  try {
    ctx ??= new AudioContext();
    void ctx.resume(); // autoplay policy: stays suspended until the page has had a click/keypress
    const t0 = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const t = t0 + i * 0.15;
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  } catch {
    // No audio output (e.g. RDP without audio redirection)
  }
}
