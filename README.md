# Voice Note Component - iMessage Style

A lightweight Web Component that perfectly replicates Apple's iMessage voice note UI. Features automatic waveform generation, progress visualization, and a minimal API. **Only 2.91 KB gzipped!**

## Features

- 🎯 **Exact iMessage replica** - Blue bubble, white play button, waveform progress
- 🎵 **Automatic waveform generation** - Analyzes audio using Web Audio API
- 📊 **Progress in waveform** - No separate progress bar, fills waveform bars
- 🎨 **Canvas rendering** - Smooth 60fps performance
- 💾 **Waveform caching** - Stores in localStorage for instant loads
- ⌨️ **Keyboard controls** - Space to play/pause, arrow keys to seek
- 📱 **Mobile optimized** - Touch-friendly with responsive design
- 🪶 **Ultra lightweight** - < 3KB gzipped, zero dependencies

## Quick Start

### Installation

```html
<script src="https://cdn.jsdelivr.net/npm/voice-note-imessage/dist/voice-note.min.js" defer></script>
```

### Usage

```html
<voice-note src="audio.m4a"></voice-note>
```

That's it! The component handles everything automatically.

## Demo

Open `demo/index.html` to see the component in a full iMessage-style interface.

## How It Works

1. **Audio loads** → Component fetches and analyzes the audio file
2. **Waveform generation** → Uses Web Audio API to extract amplitude data
3. **Canvas rendering** → Draws waveform bars with rounded rectangles
4. **Progress animation** → Fills bars white as audio plays
5. **Caching** → Stores waveform data in localStorage for instant reloads

## API

### Attributes

| Attribute | Description |
|-----------|-------------|
| `src` | URL to the audio file (required) |

### Methods

```javascript
const player = document.querySelector('voice-note');

player.play();           // Start playback
player.pause();          // Pause playback
player.seek(30);         // Seek to 30 seconds
```

### Properties

```javascript
player.currentTime;      // Current playback position
player.duration;         // Total duration
player.paused;          // Playback state
player.playbackRate;    // Playback speed
```

### Events

```javascript
player.addEventListener('vn-play', () => console.log('Started'));
player.addEventListener('vn-pause', () => console.log('Paused'));
player.addEventListener('vn-ended', () => console.log('Finished'));
player.addEventListener('vn-timeupdate', (e) => {
  console.log(e.detail.currentTime, e.detail.duration);
});
```

## Keyboard Shortcuts

- **Space/Enter** - Play/pause
- **←** - Seek back 5 seconds
- **→** - Seek forward 5 seconds

## Browser Support

- Chrome/Edge 88+
- Safari 14+ (iOS & macOS)
- Firefox 85+

## Audio Format Support

- `.m4a` - Recommended for iOS compatibility
- `.mp3` - Universal support
- `.wav` - Uncompressed audio
- `.ogg` - Open format

## Implementation Details

### Waveform Generation

The component automatically generates waveforms by:
1. Fetching the audio file
2. Decoding with Web Audio API
3. Extracting 50 amplitude samples
4. Normalizing to 0-1 range
5. Caching in localStorage

### Canvas Rendering

Uses HTML5 Canvas for optimal performance:
- 3px wide bars with 2px gaps
- Rounded rectangles for iOS aesthetic
- White fill for played portions
- 40% opacity for unplayed portions

### Performance

- **Bundle size**: 2.91 KB gzipped
- **First paint**: < 50ms
- **Waveform generation**: < 200ms for typical voice notes
- **Frame rate**: Consistent 60fps during playback

## Comparison to Original

| Feature | iMessage | This Component |
|---------|----------|----------------|
| Visual design | ✅ | ✅ Exact replica |
| Waveform generation | ✅ Server-side | ✅ Client-side |
| Progress in waveform | ✅ | ✅ |
| Click to seek | ✅ | ✅ |
| Keyboard controls | ❌ | ✅ Bonus feature |
| Size | N/A | 2.91 KB |

## Use Cases

- Chat applications
- Voice message interfaces
- Audio previews
- Podcast players
- Voice note recordings
- Customer support systems

## License

MIT

## Contributing

Issues and PRs welcome!