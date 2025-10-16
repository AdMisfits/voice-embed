interface VoiceNoteEvent extends CustomEvent {
    detail: {
        currentTime?: number;
        duration?: number;
        code?: string;
        message?: string;
    };
}
declare class VoiceNoteElement extends HTMLElement {
    private shadow;
    private audio;
    private playButton;
    private timeDisplay;
    private speedButton;
    private canvas;
    private ctx;
    private container;
    private audioContext;
    private isPlaying;
    private peaks;
    private animationFrame;
    private hasUserInteracted;
    private currentProgress;
    private isGeneratingWaveform;
    private cacheKey;
    private hoveredBar;
    private clickedBar;
    private speeds;
    private currentSpeedIndex;
    static get observedAttributes(): string[];
    constructor();
    private setupDOM;
    private attachEventListeners;
    connectedCallback(): void;
    private setupCanvasSize;
    disconnectedCallback(): void;
    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void;
    private generateWaveform;
    private generateFallbackPeaks;
    private drawWaveform;
    private drawRoundedBar;
    private formatTime;
    private togglePlayPause;
    private cycleSpeed;
    private updateSpeedDisplay;
    private handleError;
    play(): Promise<void>;
    pause(): void;
    seek(seconds: number): void;
    load(src?: string): void;
    get currentTime(): number;
    set currentTime(value: number);
    get duration(): number;
    get paused(): boolean;
    get playbackRate(): number;
    set playbackRate(value: number);
}
export { VoiceNoteElement };
export type { VoiceNoteEvent };
