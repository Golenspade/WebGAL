# WebGAL Video Exporter

Export WebGAL visual novel scenes to video files (.mov, .mp4, .webm).

## Features

- 🎬 Export full scenes with animations, transitions, and effects
- 🎵 Automatic audio mixing (BGM, vocals, sound effects)
- 📹 High-quality video encoding (ProRes, H.264, VP9)
- 🎮 Deterministic branch handling for automated exports
- ⚡ Headless browser capture using Playwright
- 🔧 Configurable resolution, frame rate, and quality

## Installation

```bash
cd packages/exporter
yarn install
yarn build
```

## Quick Start

### 1. Start WebGAL Dev Server

```bash
# In the root directory
yarn dev
```

### 2. Export a Scene

```bash
# Using the CLI
yarn export game/scene/start.txt -o output.mp4

# With custom settings
yarn export game/scene/start.txt \
  -o output.mov \
  -w 1920 \
  -h 1080 \
  -f 60 \
  -c prores \
  -v
```

## CLI Usage

### Basic Export

```bash
webgal-export export <scene-file> [options]
```

### Options

- `-o, --output <path>` - Output video file path (default: `output.mov`)
- `-w, --width <number>` - Video width (default: `1920`)
- `-h, --height <number>` - Video height (default: `1080`)
- `-f, --framerate <number>` - Frame rate in fps (default: `60`)
- `-c, --codec <codec>` - Video codec: `prores`, `h264`, or `vp9` (default: `h264`)
- `-q, --quality <number>` - Video quality (default: `18` for h264)
- `-t, --text-speed <number>` - Text speed override (1-10)
- `-a, --auto-speed <number>` - Auto mode speed (ms per sentence)
- `-b, --branch-script <path>` - JSON file with deterministic branch choices
- `-u, --url <url>` - WebGAL dev server URL (default: `http://localhost:3000`)
- `--temp-dir <path>` - Temporary directory for frames
- `-v, --verbose` - Enable verbose logging

### Generate Configuration

```bash
# Create a default config file
webgal-export config -o webgal-export.json

# Create a branch script template
webgal-export branch-script -o branch-script.json
```

## Branch Scripts

For scenes with choices or user inputs, create a branch script to provide deterministic responses:

```json
{
  "choices": {
    "0": 0,  // First choice: select option 0
    "1": 1   // Second choice: select option 1
  },
  "inputs": {
    "0": "Player Name",  // First input prompt
    "1": "Some Value"    // Second input prompt
  }
}
```

Then use it with:

```bash
webgal-export export scene.txt -b branch-script.json
```

## Programmatic Usage

```typescript
import { WebGALExporter, ExportConfig } from 'webgal-exporter';

const config: ExportConfig = {
  scenePath: 'game/scene/start.txt',
  outputPath: 'output.mp4',
  resolution: { width: 1920, height: 1080 },
  frameRate: 60,
  codec: 'h264',
  quality: 18,
  verbose: true,
};

const exporter = new WebGALExporter(config, (progress) => {
  console.log(`${progress.phase}: ${progress.progress}%`);
});

const result = await exporter.export();

if (result.success) {
  console.log('Export complete:', result.outputPath);
} else {
  console.error('Export failed:', result.error);
}
```

## Architecture

The exporter works in four phases:

1. **Capture** - Launches headless Chrome, injects timeline hooks, captures frames
2. **Timeline** - Intercepts PerformController to log all events and timings
3. **Audio** - Reconstructs audio timeline and mixes tracks with ffmpeg
4. **Encode** - Encodes frames to video and muxes with audio

### Key Components

- **BrowserCapture** - Manages Playwright/Chromium instance
- **TimelineCapture** - Hooks into WebGAL to log performs
- **FrameCapture** - Captures PNG frames from canvas
- **AudioReconstruction** - Builds audio timeline from events
- **FFmpegMixer** - Mixes audio and encodes video
- **DeterministicInput** - Auto-responds to choices/inputs

## Requirements

- Node.js >= 18
- FFmpeg installed and in PATH
- WebGAL dev server running

## Troubleshooting

### FFmpeg not found

Install FFmpeg:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

### Browser launch fails

Make sure Playwright browsers are installed:

```bash
npx playwright install chromium
```

### Audio tracks missing

Check that:
- Audio files exist in the game directory
- File paths in timeline.json are correct
- FFmpeg supports the audio format

## Performance Tips

- Lower frame rate (30fps) for faster exports
- Use H.264 instead of ProRes for smaller files
- Disable verbose mode for cleaner output
- Keep temp files (`--temp-dir`) to debug issues

## License

MPL-2.0
