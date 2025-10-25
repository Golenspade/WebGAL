/**
 * Basic Export Example
 *
 * This example shows how to export a WebGAL scene to video programmatically
 */

import { WebGALExporter, type ExportConfig } from '../src/index.js';

async function main() {
  const config: ExportConfig = {
    // Scene to export
    scenePath: 'game/scene/start.txt',

    // Output path
    outputPath: 'output/my-scene.mp4',

    // Video settings
    resolution: {
      width: 1920,
      height: 1080,
    },
    frameRate: 60,
    codec: 'h264',
    quality: 18,

    // WebGAL server
    webgalUrl: 'http://localhost:3000',

    // Enable verbose logging
    verbose: true,
  };

  console.log('Starting export...\n');

  const exporter = new WebGALExporter(config, (progress) => {
    // Progress callback
    const bar = '█'.repeat(Math.floor(progress.progress / 2));
    const empty = '░'.repeat(50 - Math.floor(progress.progress / 2));

    console.log(`[${bar}${empty}] ${progress.progress.toFixed(1)}% - ${progress.message}`);
  });

  try {
    const result = await exporter.export();

    if (result.success) {
      console.log('\n✅ Export successful!');
      console.log(`   Output: ${result.outputPath}`);
      console.log(`   Duration: ${result.duration?.toFixed(2)}s`);
      console.log(`   Frames: ${result.totalFrames}`);
    } else {
      console.error('\n❌ Export failed:', result.error?.message);
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
