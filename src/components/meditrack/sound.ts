let ctx: AudioContext | null = null;

export function armAudio(): void {
  if (typeof window === "undefined") return;
  if (!ctx) ctx = new AudioContext();
  void ctx.resume().catch(() => undefined);
}

export function beep(): void {
  if (!ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  const tone = (freq: number, at: number, dur: number, gain: number) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(ctx!.destination);
    o.start(at);
    o.stop(at + dur);
  };
  tone(660, now, 0.16, 0.05);
  tone(880, now + 0.18, 0.22, 0.04);
}
