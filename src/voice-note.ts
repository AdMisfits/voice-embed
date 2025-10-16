interface VoiceNoteEvent extends CustomEvent {
  detail: {
    currentTime?: number;
    duration?: number;
    code?: string;
    message?: string;
  };
}

class VoiceNoteElement extends HTMLElement {
  private shadow: ShadowRoot;
  private audio: HTMLAudioElement;
  private playButton: HTMLButtonElement;
  private timeDisplay: HTMLSpanElement;
  private speedButton: HTMLButtonElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private container: HTMLDivElement;
  private audioContext: AudioContext | null = null;
  private isPlaying = false;
  private peaks: number[] = [];
  private animationFrame: number | null = null;
  private hasUserInteracted = false;
  private currentProgress = 0;
  private isGeneratingWaveform = false;
  private cacheKey: string = '';
  private hoveredBar: number | null = null;
  private clickedBar: number | null = null;
  private speeds: number[] = [1, 1.25, 1.5, 2];
  private currentSpeedIndex: number = 0;
  private resizeObserver: ResizeObserver | null = null;

  static get observedAttributes() {
    return ['src'];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    
    this.audio = document.createElement('audio');
    this.audio.preload = 'metadata';
    this.audio.crossOrigin = 'anonymous';
    
    this.playButton = document.createElement('button');
    this.timeDisplay = document.createElement('span');
    this.speedButton = document.createElement('button');
    this.canvas = document.createElement('canvas');
    this.container = document.createElement('div');
    
    this.setupDOM();
    this.attachEventListeners();
  }

  private setupDOM() {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: inline-block;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
      }

      * {
        box-sizing: border-box;
      }

      .container {
        background: #007AFF;
        border-radius: 1rem;
        padding: 8px;
        padding-top: 10px;
        padding-bottom: 10px;
        display: inline-flex;
        align-items: center;
        position: relative;
        overflow: visible;
      }

      .play-button {
        background: white;
        border: none;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        padding: 0;
        transition: transform 0.1s;
        margin-right: 8px;
      }

      .play-button:active {
        transform: scale(0.95);
      }

      .play-button:focus {
        outline: none;
      }

      .play-icon,
      .pause-icon {
        width: 16px;
        height: 16px;
        fill: #007AFF;
      }

      .pause-icon {
        display: none;
        width: 14px;
        height: 14px;
      }

      .play-button[aria-pressed="true"] .play-icon {
        display: none;
      }

      .play-button[aria-pressed="true"] .pause-icon {
        display: block;
      }

      .waveform-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: stretch;
        position: relative;
        min-width: 150px;
        max-width: 200px;

      }

      .waveform-canvas {
        width: 100%;
        height: 28px;
        cursor: pointer;
        display: block;
      }

      .time-display {
        position: absolute;
        bottom: -6px;
        left: 0;
        color: white;
        font-size: 9px;
        font-weight: 500;
        opacity: 0.85;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      .speed-button {
        background: transparent;
        border: none;
        color: white;
        font-size: 11px;
        font-weight: 600;
        opacity: 0.7;
        cursor: pointer;
        padding: 4px 1px;
        margin-left: 4px;
        border-radius: 6px;
        transition: opacity 0.2s, background 0.2s;
        white-space: nowrap;
        min-width: 32px;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
        align-self: center;
        box-sizing: content-box;
      }

      .speed-button:hover {
        opacity: 0.9;
        background: rgba(255, 255, 255, 0.1);
      }

      .speed-button:active {
        opacity: 1;
        background: rgba(255, 255, 255, 0.15);
      }

      .speed-button:focus {
        outline: none;
      }

      .loading {
        opacity: 0.6;
      }

      .error-state {
        background: #FF3B30;
      }

      @media (prefers-reduced-motion: reduce) {
        * {
          transition: none !important;
          animation: none !important;
        }
      }
    `;

    this.container.className = 'container';
    this.container.setAttribute('role', 'region');
    this.container.setAttribute('aria-label', 'Voice message');

    this.playButton.className = 'play-button';
    this.playButton.setAttribute('aria-label', 'Play');
    this.playButton.setAttribute('aria-pressed', 'false');
    this.playButton.innerHTML = `
      <svg class="play-icon" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z"/>
      </svg>
      <svg class="pause-icon" viewBox="0 0 24 24">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
      </svg>
    `;

    this.canvas.className = 'waveform-canvas'; 
    
    this.timeDisplay.className = 'time-display';
    this.timeDisplay.textContent = '0:00';

    this.speedButton.className = 'speed-button';
    this.speedButton.textContent = '1×';
    this.speedButton.setAttribute('aria-label', 'Playback speed');
    this.speedButton.setAttribute('title', 'Change playback speed');

    // Create wrapper for waveform and timer
    const waveformWrapper = document.createElement('div');
    waveformWrapper.className = 'waveform-wrapper';
    waveformWrapper.appendChild(this.canvas);
    waveformWrapper.appendChild(this.timeDisplay);

    this.container.appendChild(this.playButton);
    this.container.appendChild(waveformWrapper);
    this.container.appendChild(this.speedButton);

    this.shadow.appendChild(style);
    this.shadow.appendChild(this.container);
    this.shadow.appendChild(this.audio);
  }

  private attachEventListeners() {
    this.playButton.addEventListener('click', () => this.togglePlayPause());

    this.speedButton.addEventListener('click', () => this.cycleSpeed());
    
    this.audio.addEventListener('loadedmetadata', async () => {
      this.timeDisplay.textContent = this.formatTime(this.audio.duration);
      await this.generateWaveform();
      this.drawWaveform();
      this.dispatchEvent(new CustomEvent('vn-ready'));
    });

    this.audio.addEventListener('timeupdate', () => {
      if (this.isPlaying) {
        this.timeDisplay.textContent = this.formatTime(this.audio.currentTime);
      }
      this.currentProgress = this.audio.currentTime / this.audio.duration;
      this.drawWaveform();
      
      this.dispatchEvent(new CustomEvent('vn-timeupdate', {
        detail: {
          currentTime: this.audio.currentTime,
          duration: this.audio.duration
        }
      }));
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.playButton.setAttribute('aria-pressed', 'false');
      // Reset to beginning when playback ends
      this.audio.currentTime = 0;
      this.currentProgress = 0;
      this.timeDisplay.textContent = this.formatTime(this.audio.duration); // Show full duration
      this.clickedBar = null; // Clear any clicked bar
      this.drawWaveform();
      this.dispatchEvent(new CustomEvent('vn-ended'));
    });

    this.audio.addEventListener('error', () => {
      const error = this.audio.error;
      this.handleError(error?.code?.toString() || 'unknown', error?.message || 'Audio failed to load');
    });

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;

      // Calculate bar index with dynamic spacing
      const barWidth = 2;
      const minGap = 1;
      const maxBars = Math.floor(width / (barWidth + minGap));
      const targetBars = 80;
      const barCount = Math.min(maxBars, targetBars);
      const barGap = barCount > 1 ? (width - (barCount * barWidth)) / (barCount - 1) : 0;

      const barIndex = Math.floor(x / (barWidth + barGap));
      this.clickedBar = barIndex;

      const percent = x / rect.width;
      this.seek(this.audio.duration * percent);
      this.drawWaveform();
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;

      // Calculate bar index with dynamic spacing
      const barWidth = 2;
      const minGap = 1;
      const maxBars = Math.floor(width / (barWidth + minGap));
      const targetBars = 80;
      const barCount = Math.min(maxBars, targetBars);
      const barGap = barCount > 1 ? (width - (barCount * barWidth)) / (barCount - 1) : 0;

      const barIndex = Math.floor(x / (barWidth + barGap));

      if (this.hoveredBar !== barIndex) {
        this.hoveredBar = barIndex;
        this.drawWaveform();
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      if (this.hoveredBar !== null) {
        this.hoveredBar = null;
        this.drawWaveform();
      }
    });

    this.addEventListener('keydown', (e) => {
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          this.togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.seek(Math.max(0, this.audio.currentTime - 5));
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.seek(Math.min(this.audio.duration, this.audio.currentTime + 5));
          break;
      }
    });
  }

  connectedCallback() {
    const src = this.getAttribute('src');
    if (src) {
      this.audio.src = src;
      this.cacheKey = `voice-note-peaks-${src}`;

      const cachedPeaks = localStorage.getItem(this.cacheKey);
      if (cachedPeaks) {
        try {
          this.peaks = JSON.parse(cachedPeaks);
        } catch (e) {
          this.peaks = [];
        }
      }
    }

    // Set up canvas with proper dimensions
    this.setupCanvasSize();
    this.ctx = this.canvas.getContext('2d');
    this.drawWaveform();

    // Set up ResizeObserver to handle container size changes
    this.resizeObserver = new ResizeObserver(() => {
      this.setupCanvasSize();
    });
    this.resizeObserver.observe(this.canvas);
  }

  private setupCanvasSize() {
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Set canvas internal size to match CSS size * device pixel ratio
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      
      // Get context without scaling - we'll handle DPR in drawing
      this.ctx = this.canvas.getContext('2d');
      
      this.drawWaveform();
    });
  }

  disconnectedCallback() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'src':
        if (newValue) {
          this.load(newValue);
          this.cacheKey = `voice-note-peaks-${newValue}`;
        }
        break;
    }
  }

  private async generateWaveform() {
    if (this.isGeneratingWaveform || this.peaks.length > 0) return;
    
    this.isGeneratingWaveform = true;
    this.container.classList.add('loading');

    try {
      const response = await fetch(this.audio.src);
      const arrayBuffer = await response.arrayBuffer();
      
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
      
      const channelData = audioBuffer.getChannelData(0);
      const samples = 80; // More samples for finer detail
      const blockSize = Math.floor(channelData.length / samples);
      const peaks: number[] = [];
      
      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(channelData[i * blockSize + j]);
        }
        peaks.push(sum / blockSize);
      }
      
      const maxPeak = Math.max(...peaks);
      this.peaks = peaks.map(p => p / maxPeak);
      
      localStorage.setItem(this.cacheKey, JSON.stringify(this.peaks));
      
    } catch (error) {
      console.warn('Failed to generate waveform:', error);
      this.peaks = this.generateFallbackPeaks();
    } finally {
      this.isGeneratingWaveform = false;
      this.container.classList.remove('loading');
      this.setupCanvasSize(); // Redraw with proper size
    }
  }

  private generateFallbackPeaks(): number[] {
    const peaks = [];
    for (let i = 0; i < 80; i++) {
      peaks.push(0.3 + Math.random() * 0.7);
    }
    return peaks;
  }

  private drawWaveform() {
    if (!this.ctx) return;

    // Get dimensions and DPR
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const height = rect.height;

    // Fixed bar width, calculate dynamic spacing
    const barWidth = 2; // Fixed bar width
    const minGap = 1; // Minimum gap between bars

    // Calculate maximum number of bars that can fit with minimum gap
    const maxBars = Math.floor(width / (barWidth + minGap));

    // Use the smaller of maxBars or desired bar count (80)
    const targetBars = 80;
    const barCount = Math.min(maxBars, targetBars);

    // Calculate the actual gap to distribute bars evenly across full width
    // Formula: totalWidth = barCount * barWidth + (barCount - 1) * gap
    // Solving for gap: gap = (width - barCount * barWidth) / (barCount - 1)
    const barGap = barCount > 1 ? (width - (barCount * barWidth)) / (barCount - 1) : 0;

    // Clear entire canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.peaks.length === 0) {
      for (let i = 0; i < barCount; i++) {
        // Calculate precise x position to fill entire width
        const x = i * (barWidth + barGap);
        const barHeight = height * 0.3;
        const y = (height - barHeight) / 2;

        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.drawRoundedBar(x * dpr, y * dpr, barWidth * dpr, barHeight * dpr);
      }
      return;
    }

    const peaksToShow = Math.min(barCount, this.peaks.length);
    const playedBars = Math.floor(peaksToShow * this.currentProgress);

    for (let i = 0; i < peaksToShow; i++) {
      const peakIndex = Math.floor(i * this.peaks.length / peaksToShow);
      const peak = this.peaks[peakIndex];
      // Calculate precise x position to fill entire width
      const x = i * (barWidth + barGap);
      const barHeight = Math.max(4, peak * height * 0.7);
      const y = (height - barHeight) / 2;

      // Determine bar color based on state
      if (i === this.clickedBar) {
        // Clicked bar - bright white
        this.ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      } else if (i === this.hoveredBar) {
        // Hovered bar - slightly brighter
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      } else if (i < playedBars) {
        // Played bars - white
        this.ctx.fillStyle = 'white';
      } else {
        // Unplayed bars - semi-transparent
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      }

      // Draw bars with rounded tops and bottoms, scaled by DPR
      this.drawRoundedBar(x * dpr, y * dpr, barWidth * dpr, barHeight * dpr);
    }
  }

  private drawRoundedBar(x: number, y: number, width: number, height: number) {
    if (!this.ctx) return;
    
    const radius = width / 2;
    
    // For very short bars, just draw a circle
    if (height <= width) {
      this.ctx.beginPath();
      this.ctx.arc(x + radius, y + height / 2, height / 2, 0, Math.PI * 2);
      this.ctx.fill();
      return;
    }
    
    // Draw rounded rectangle with smooth anti-aliased curves
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.arc(x + width - radius, y + radius, radius, -Math.PI / 2, 0);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.arc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.arc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI);
    this.ctx.lineTo(x, y + radius);
    this.ctx.arc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private formatTime(seconds: number): string {
    if (isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private togglePlayPause() {
    if (!this.hasUserInteracted) {
      this.hasUserInteracted = true;
    }

    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  private cycleSpeed() {
    this.currentSpeedIndex = (this.currentSpeedIndex + 1) % this.speeds.length;
    const newSpeed = this.speeds[this.currentSpeedIndex];
    this.audio.playbackRate = newSpeed;
    this.updateSpeedDisplay();
  }

  private updateSpeedDisplay() {
    const speed = this.speeds[this.currentSpeedIndex];
    // Format speed with proper multiplication symbol
    if (speed === 1) {
      this.speedButton.textContent = '1×';
    } else if (speed === 1.25) {
      this.speedButton.textContent = '1.25×';
    } else if (speed === 1.5) {
      this.speedButton.textContent = '1.5×';
    } else if (speed === 2) {
      this.speedButton.textContent = '2×';
    }
  }

  private handleError(code: string, message: string) {
    this.container.classList.add('error-state');
    this.dispatchEvent(new CustomEvent('vn-error', {
      detail: { code, message }
    }));
  }

  public play(): Promise<void> {
    return this.audio.play().then(() => {
      this.isPlaying = true;
      this.playButton.setAttribute('aria-pressed', 'true');
      this.playButton.setAttribute('aria-label', 'Pause');
      this.dispatchEvent(new CustomEvent('vn-play'));
    });
  }

  public pause(): void {
    this.audio.pause();
    this.isPlaying = false;
    this.playButton.setAttribute('aria-pressed', 'false');
    this.playButton.setAttribute('aria-label', 'Play');
    // Keep showing current time when paused, not total duration
    this.timeDisplay.textContent = this.formatTime(this.audio.currentTime);
    this.dispatchEvent(new CustomEvent('vn-pause'));
  }

  public seek(seconds: number): void {
    if (!isNaN(seconds) && seconds >= 0 && seconds <= this.audio.duration) {
      this.audio.currentTime = seconds;
      this.currentProgress = seconds / this.audio.duration;
      
      // Update clicked bar based on seek position
      const rect = this.canvas.getBoundingClientRect();
      const barWidth = 2;
      const barGap = 1;
      const barCount = Math.floor(rect.width / (barWidth + barGap));
      this.clickedBar = Math.floor(barCount * this.currentProgress);
      
      this.drawWaveform();
      // Always show current time, whether playing or paused
      this.timeDisplay.textContent = this.formatTime(seconds);
    }
  }

  public load(src?: string): void {
    if (src) {
      this.audio.src = src;
      this.cacheKey = `voice-note-peaks-${src}`;
      this.peaks = [];

      const cachedPeaks = localStorage.getItem(this.cacheKey);
      if (cachedPeaks) {
        try {
          this.peaks = JSON.parse(cachedPeaks);
          this.setupCanvasSize();
        } catch (e) {
          this.peaks = [];
        }
      }
    }
    this.audio.load();
    this.isPlaying = false;
    this.playButton.setAttribute('aria-pressed', 'false');
    this.currentProgress = 0;
    // Reset speed to 1x when loading new audio
    this.currentSpeedIndex = 0;
    this.audio.playbackRate = 1;
    this.updateSpeedDisplay();
  }

  get currentTime(): number {
    return this.audio.currentTime;
  }

  set currentTime(value: number) {
    this.audio.currentTime = value;
  }

  get duration(): number {
    return this.audio.duration;
  }

  get paused(): boolean {
    return this.audio.paused;
  }

  get playbackRate(): number {
    return this.audio.playbackRate;
  }

  set playbackRate(value: number) {
    this.audio.playbackRate = value;
  }
}

customElements.define('voice-note', VoiceNoteElement);

export { VoiceNoteElement };
export type { VoiceNoteEvent };