export interface StemChannelNode {
  id: string;
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode;
  pannerNode: StereoPannerNode;
  analyserNode: AnalyserNode;
  buffer: AudioBuffer | null;
  volume: number;
  pan: number;
  isMuted: boolean;
  isSolo: boolean;
}

export class MultiTrackEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private channels: Map<string, StemChannelNode> = new Map();

  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pauseOffset: number = 0;
  private duration: number = 0;
  private playbackRate: number = 1.0;

  // A-B Looping
  private loopA: number | null = null;
  private loopB: number | null = null;
  private loopWatcherInterval: number | null = null;

  // Precision Metronome Lookahead Scheduler
  private beatGrid: number[] = [];
  private metronomeEnabled: boolean = false;
  private nextBeatIdx: number = 0;
  private metronomeInterval: number | null = null;

  constructor() {

    // Lazy AudioContext initialization on first user interaction
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass({ latencyHint: 'interactive' });
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public getContext(): AudioContext {
    return this.ensureContext();
  }

  /**
   * Carga múltiples stems en paralelo desde URLs y construye los grafos de canal.
   */
  public async loadStems(stems: Record<string, string>, baseUrl: string = "http://127.0.0.1:8000"): Promise<void> {
    const ctx = this.ensureContext();
    this.stop();
    this.channels.clear();
    this.duration = 0;
    this.pauseOffset = 0;

    const entries = Object.entries(stems);
    const loadPromises = entries.map(async ([stemName, pathOrUrl]) => {
      const fullUrl = pathOrUrl.startsWith("http") ? pathOrUrl : `${baseUrl}${pathOrUrl}`;
      try {
        const resp = await fetch(fullUrl);
        if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
        const arrayBuf = await resp.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrayBuf);

        if (audioBuf.duration > this.duration) {
          this.duration = audioBuf.duration;
        }

        // Crear Strip DSP
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.85;

        const pannerNode = ctx.createStereoPanner();
        pannerNode.pan.value = 0.0;

        const analyserNode = ctx.createAnalyser();
        analyserNode.fftSize = 64;

        // Conexión: Source -> Gain -> Panner -> Analyser -> MasterGain
        gainNode.connect(pannerNode);
        pannerNode.connect(analyserNode);
        analyserNode.connect(this.masterGain!);

        this.channels.set(stemName, {
          id: stemName,
          sourceNode: null,
          gainNode,
          pannerNode,
          analyserNode,
          buffer: audioBuf,
          volume: 0.85,
          pan: 0.0,
          isMuted: false,
          isSolo: false,
        });
      } catch (err) {
        console.error(`Error cargando stem [${stemName}] desde ${fullUrl}:`, err);
      }
    });

    await Promise.all(loadPromises);
    this.recalculateGains();
  }

  public setBeatGrid(grid: number[]): void {
    this.beatGrid = grid;
    this.resetMetronomePointer();
  }

  public play(): void {
    if (this.isPlaying || this.channels.size === 0) return;
    const ctx = this.ensureContext();

    const now = ctx.currentTime;
    this.startTime = now - (this.pauseOffset / this.playbackRate);

    this.channels.forEach((ch) => {
      if (!ch.buffer) return;
      const src = ctx.createBufferSource();
      src.buffer = ch.buffer;
      src.playbackRate.value = this.playbackRate;
      src.connect(ch.gainNode);

      const offset = Math.min(this.pauseOffset, ch.buffer.duration);
      src.start(now, offset);
      ch.sourceNode = src;
    });

    this.isPlaying = true;
    this.startLoopWatcher();
    this.startMetronomeScheduler();
  }

  public pause(): void {
    if (!this.isPlaying) return;
    this.pauseOffset = this.getCurrentTime();
    this.stopSources();
    this.isPlaying = false;
    this.stopSchedulers();
  }

  public stop(): void {
    this.pauseOffset = 0;
    this.stopSources();
    this.isPlaying = false;
    this.stopSchedulers();
    this.resetMetronomePointer();
  }

  public seek(targetSeconds: number): void {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    this.pauseOffset = Math.max(0, Math.min(targetSeconds, this.duration));
    this.resetMetronomePointer();
    if (wasPlaying) {
      this.play();
    }
  }

  public getCurrentTime(): number {
    if (!this.isPlaying || !this.ctx) return this.pauseOffset;
    const elapsed = (this.ctx.currentTime - this.startTime) * this.playbackRate;
    return Math.min(Math.max(0, elapsed), this.duration);
  }

  public getDuration(): number {
    return this.duration;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.5, Math.min(2.0, rate));
    if (this.isPlaying && this.ctx) {
      const currentPos = this.getCurrentTime();
      this.startTime = this.ctx.currentTime - (currentPos / this.playbackRate);
      this.channels.forEach((ch) => {
        if (ch.sourceNode) {
          ch.sourceNode.playbackRate.setValueAtTime(this.playbackRate, this.ctx!.currentTime);
        }
      });
    }
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  // ==========================================
  // CANAL MIXER CONTROLS
  // ==========================================
  public setVolume(stemId: string, volume: number): void {
    const ch = this.channels.get(stemId);
    if (!ch || !this.ctx) return;
    ch.volume = Math.max(0, Math.min(1.0, volume));
    this.recalculateGains();
  }

  public setPan(stemId: string, pan: number): void {
    const ch = this.channels.get(stemId);
    if (!ch || !this.ctx) return;
    ch.pan = Math.max(-1, Math.min(1, pan));
    ch.pannerNode.pan.setValueAtTime(ch.pan, this.ctx.currentTime);
  }

  public toggleMute(stemId: string): void {
    const ch = this.channels.get(stemId);
    if (!ch) return;
    ch.isMuted = !ch.isMuted;
    this.recalculateGains();
  }

  public toggleSolo(stemId: string): void {
    const ch = this.channels.get(stemId);
    if (!ch) return;
    ch.isSolo = !ch.isSolo;
    this.recalculateGains();
  }

  public setMasterVolume(vol: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1.0, vol)), this.ctx.currentTime);
    }
  }

  private recalculateGains(): void {
    if (!this.ctx) return;
    const hasSolo = Array.from(this.channels.values()).some((c) => c.isSolo);

    this.channels.forEach((ch) => {
      let active = true;
      if (hasSolo) {
        active = ch.isSolo;
      } else if (ch.isMuted) {
        active = false;
      }
      const target = active ? ch.volume : 0.0;
      // Smooth linear transition to prevent audio popping
      ch.gainNode.gain.setTargetAtTime(target, this.ctx!.currentTime, 0.012);
    });
  }

  public getChannelLevel(stemId: string): number {
    const ch = this.channels.get(stemId);
    if (!ch || !this.isPlaying) return 0;
    const data = new Uint8Array(ch.analyserNode.frequencyBinCount);
    ch.analyserNode.getByteTimeDomainData(data);

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    return Math.min(1.0, rms * 2.8);
  }

  // ==========================================
  // METRÓNOMO DINÁMICO LOOKAHEAD
  // ==========================================
  public setMetronome(enabled: boolean): void {
    this.metronomeEnabled = enabled;
  }

  public getMetronome(): boolean {
    return this.metronomeEnabled;
  }

  private resetMetronomePointer(): void {
    const t = this.pauseOffset;
    this.nextBeatIdx = this.beatGrid.findIndex((b) => b >= t);
    if (this.nextBeatIdx === -1) this.nextBeatIdx = this.beatGrid.length;
  }

  private startMetronomeScheduler(): void {
    if (this.metronomeInterval) window.clearInterval(this.metronomeInterval);
    const lookaheadSec = 0.12;

    this.metronomeInterval = window.setInterval(() => {
      if (!this.isPlaying || !this.metronomeEnabled || this.beatGrid.length === 0 || !this.ctx) return;

      const currentPos = this.getCurrentTime();
      while (
        this.nextBeatIdx < this.beatGrid.length &&
        this.beatGrid[this.nextBeatIdx] < currentPos + lookaheadSec
      ) {
        const beatTime = this.beatGrid[this.nextBeatIdx];
        if (beatTime >= currentPos) {
          const scheduleTime = this.startTime + (beatTime / this.playbackRate);
          const isDownbeat = (this.nextBeatIdx % 4 === 0);
          this.triggerClick(scheduleTime, isDownbeat);
        }
        this.nextBeatIdx++;
      }
    }, 25);
  }

  private triggerClick(audioTime: number, isAccent: boolean): void {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isAccent ? 1600 : 900, audioTime);

      gain.gain.setValueAtTime(isAccent ? 0.6 : 0.35, audioTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioTime + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      osc.start(audioTime);
      osc.stop(audioTime + 0.045);
    } catch {
      // Ignorar scheduling menor en caso de desborde
    }
  }

  // ==========================================
  // LOOPING REGIONES A-B
  // ==========================================
  public setLoopA(a: number | null): void {
    this.loopA = a;
    if (this.loopB !== null && this.loopA !== null && this.loopA >= this.loopB) {
      this.loopB = this.loopA + 2.0;
    }
  }

  public setLoopB(b: number | null): void {
    this.loopB = b;
    if (this.loopA !== null && this.loopB !== null && this.loopB <= this.loopA) {
      this.loopA = Math.max(0, this.loopB - 2.0);
    }
  }

  public clearLoop(): void {
    this.loopA = null;
    this.loopB = null;
  }

  public getLoopA(): number | null {
    return this.loopA;
  }

  public getLoopB(): number | null {
    return this.loopB;
  }

  private startLoopWatcher(): void {
    if (this.loopWatcherInterval) window.clearInterval(this.loopWatcherInterval);
    this.loopWatcherInterval = window.setInterval(() => {
      if (!this.isPlaying) return;
      const current = this.getCurrentTime();
      if (this.loopA !== null && this.loopB !== null) {
        if (current >= this.loopB) {
          this.seek(this.loopA);
        }
      } else if (current >= this.duration && this.duration > 0) {
        this.seek(0);
        this.pause();
      }
    }, 25);
  }

  private stopSources(): void {
    this.channels.forEach((ch) => {
      if (ch.sourceNode) {
        try {
          ch.sourceNode.stop();
          ch.sourceNode.disconnect();
        } catch {
          // Ignorar error si ya terminó
        }
        ch.sourceNode = null;
      }
    });
  }

  private stopSchedulers(): void {
    if (this.loopWatcherInterval) window.clearInterval(this.loopWatcherInterval);
    if (this.metronomeInterval) window.clearInterval(this.metronomeInterval);
  }
}
