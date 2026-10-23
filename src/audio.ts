export class BrickAudio {
  muted = false;
  private context: AudioContext | null = null;
  constructor() { try { this.muted = localStorage.getItem('bricked.muted') === 'true'; } catch { /* Sound stays usable without storage. */ } }
  toggle() { this.muted = !this.muted; try { localStorage.setItem('bricked.muted',String(this.muted)); } catch { /* Keep the session preference. */ } }
  click() {
    if (this.muted) return;
    try {
      this.context ??= new AudioContext();
      const ctx = this.context;
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime, pitch = 0.95 + Math.random() * 0.1;
      const buffer = ctx.createBuffer(1,Math.floor(ctx.sampleRate * 0.055),ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for(let i=0;i<samples.length;i++) samples[i]=(Math.random()*2-1)*Math.exp(-i/(ctx.sampleRate*0.007));
      const source = ctx.createBufferSource(); source.buffer = buffer; source.playbackRate.value = pitch;
      const filter=ctx.createBiquadFilter(); filter.type='bandpass'; filter.frequency.value=2200*pitch; filter.Q.value=0.7;
      const gain=ctx.createGain(); gain.gain.setValueAtTime(0.27,now); gain.gain.exponentialRampToValueAtTime(0.001,now+0.055);
      source.connect(filter).connect(gain).connect(ctx.destination); source.start(now);
      const oscillator=ctx.createOscillator(), body=ctx.createGain(); oscillator.type='triangle'; oscillator.frequency.setValueAtTime(680*pitch,now); oscillator.frequency.exponentialRampToValueAtTime(280*pitch,now+0.025);
      body.gain.setValueAtTime(0.1,now); body.gain.exponentialRampToValueAtTime(0.001,now+0.035);
      oscillator.connect(body).connect(ctx.destination); oscillator.start(now); oscillator.stop(now+0.04);
    } catch { /* Placement also works in browsers without Web Audio. */ }
  }
}
