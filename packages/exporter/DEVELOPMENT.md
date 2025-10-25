# WebGAL Exporter - Development Guide

## Architecture Overview

The exporter is structured into several modules:

```
packages/exporter/
├── src/
│   ├── capture/          # Browser and frame capture
│   │   ├── browserCapture.ts
│   │   └── frameCapture.ts
│   ├── timeline/         # Timeline extraction
│   │   └── timelineCapture.ts
│   ├── audio/            # Audio reconstruction
│   │   ├── audioReconstruction.ts
│   │   └── ffmpegMixer.ts
│   ├── utils/            # Utilities
│   │   └── deterministicInput.ts
│   ├── cli/              # CLI interface
│   │   └── index.ts
│   ├── types.ts          # TypeScript definitions
│   ├── exporter.ts       # Main orchestrator
│   └── index.ts          # Public API
└── examples/             # Usage examples
```

## Development Setup

1. **Install dependencies**

```bash
cd packages/exporter
yarn install
```

2. **Build**

```bash
yarn build
```

3. **Watch mode (for development)**

```bash
yarn dev
```

## Key Concepts

### 1. Timeline Capture

The timeline capture works by injecting JavaScript into the WebGAL page that hooks into the `PerformController`. Every time a perform is added, it's logged to a global timeline object.

**Injection point**: [src/timeline/timelineCapture.ts](src/timeline/timelineCapture.ts)

The script creates `window.__EXPORT_TIMELINE__` which stores:
- All perform events
- Audio state changes (BGM, vocal, SE)
- Scene start/end markers

### 2. Frame Capture

Frames are captured by taking screenshots of the entire browser viewport, which includes:
- Pixi.js canvas (#pixiCanvas)
- React DOM overlays (textbox, UI elements)

**Capture method**: Playwright's `page.screenshot()`

Frames are saved as PNG files in sequence: `frame_00000.png`, `frame_00001.png`, etc.

### 3. Audio Reconstruction

Audio tracks are reconstructed from the timeline events:

1. Extract all audio events (bgm, vocal, se)
2. Resolve file paths relative to game directory
3. Build FFmpeg filter chains with:
   - Delays (adelay)
   - Volume adjustments
   - Fades (afade)
   - Looping (aloop)
4. Mix all tracks with `amix`

**Key files**:
- [src/audio/audioReconstruction.ts](src/audio/audioReconstruction.ts) - Timeline → AudioTrack[]
- [src/audio/ffmpegMixer.ts](src/audio/ffmpegMixer.ts) - FFmpeg operations

### 4. Deterministic Input

For scenes with choices or user inputs, we inject handlers that automatically respond based on a provided script.

**How it works**:
1. Inject mutation observer to detect choice/input dialogs
2. When detected, auto-select/fill based on `BranchScript`
3. Simulate user clicks/inputs

**File**: [src/utils/deterministicInput.ts](src/utils/deterministicInput.ts)

## Testing

### Unit Testing

Currently, unit tests are not implemented. Contributions welcome!

### Integration Testing

To test the exporter end-to-end:

1. Start WebGAL dev server:
```bash
yarn dev
```

2. Run a test export:
```bash
cd packages/exporter
yarn build
node build/cli/index.js export ../../game/scene/start.txt -o test.mp4 -v
```

3. Check output:
```bash
ffprobe test.mp4
```

### Manual Testing Checklist

- [ ] Basic scene export (no choices)
- [ ] Scene with BGM
- [ ] Scene with vocals
- [ ] Scene with sound effects
- [ ] Scene with choices (using branch script)
- [ ] Scene with user inputs
- [ ] Different resolutions (1080p, 4K)
- [ ] Different frame rates (30fps, 60fps)
- [ ] Different codecs (h264, prores, vp9)
- [ ] Long scenes (>5 minutes)
- [ ] Scenes with complex animations

## Debugging

### Enable Verbose Mode

```bash
webgal-export export scene.txt -o output.mp4 -v
```

This will show:
- Browser console logs
- FFmpeg commands
- Progress details
- Timeline events

### Keep Temp Files

```bash
webgal-export export scene.txt --temp-dir ./debug-output -v
```

This preserves:
- All captured frames
- Timeline JSON
- Intermediate audio files
- Temp video files

### Inspect Timeline

The timeline is saved as JSON for debugging:

```bash
cat ./debug-output/timeline.json | jq
```

## Common Issues

### 1. FFmpeg not found

**Solution**: Install FFmpeg and ensure it's in PATH

```bash
which ffmpeg  # Should output a path
```

### 2. Browser launch fails

**Solution**: Install Playwright browsers

```bash
npx playwright install chromium
```

### 3. Frame capture is black

**Problem**: Canvas isn't rendered yet

**Solution**: Add delays in frame capture or wait for specific elements

### 4. Audio out of sync

**Problem**: Timeline timings are incorrect

**Solution**:
- Check that perform durations are accurate
- Verify audio file paths are correct
- Inspect timeline.json

### 5. Missing audio

**Problem**: Audio files not found

**Solution**: Ensure game assets are in correct location relative to scene path

## Performance Optimization

### Faster Exports

- Lower frame rate (30fps instead of 60fps)
- Lower resolution (1080p instead of 4K)
- Use H.264 instead of ProRes
- Disable verbose logging

### Quality vs Speed

| Setting | Speed | Quality | File Size |
|---------|-------|---------|-----------|
| 720p 30fps H.264 | Fast | Good | Small |
| 1080p 60fps H.264 | Medium | Better | Medium |
| 4K 60fps ProRes | Slow | Best | Very Large |

## Contributing

When adding new features:

1. Update types in [src/types.ts](src/types.ts)
2. Add JSDoc comments
3. Follow existing code style (Prettier + TypeScript)
4. Update README with new options
5. Add examples if applicable

### Code Style

- Single quotes for strings
- Semicolons required
- 120 char line width
- Trailing commas
- Arrow functions for callbacks

## Future Improvements

Potential enhancements:

- [ ] Parallel frame capture for speed
- [ ] GPU-accelerated encoding
- [ ] Live preview during export
- [ ] Resume interrupted exports
- [ ] Cloud export support
- [ ] Batch export multiple scenes
- [ ] Custom watermarks/overlays
- [ ] Variable frame rate (VFR) export
- [ ] HDR support
- [ ] Subtitle track generation

## License

MPL-2.0
