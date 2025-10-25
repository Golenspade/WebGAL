/**
 * High Quality Export Example
 *
 * This example shows how to export with ProRes codec for maximum quality
 */

import { WebGALExporter, type ExportConfig } from '../src/index.js';

async function main() {
  const config: ExportConfig = {
    scenePath: 'game/scene/cinematic.txt',
    outputPath: 'output/cinematic-prores.mov',

    // High quality settings
    resolution: {
      width: 3840, // 4K
      height: 2160,
    },
    frameRate: 60,
    codec: 'prores', // ProRes for best quality

    webgalUrl: 'http://localhost:3000',
    verbose: true,
  };

  console.log('Starting high-quality ProRes export...\n');
  console.log('⚠️  This will produce a large file!\n');

  const exporter = new WebGALExporter(config, (progress) => {
    if (progress.currentFrame && progress.totalFrames) {
      const frameProgress = `Frame ${progress.currentFrame}/${progress.totalFrames}`;
      console.log(`${progress.phase}: ${frameProgress} - ${progress.progress.toFixed(1)}%`);
    } else {
      console.log(`${progress.phase}: ${progress.message}`);
    }
  });

  const result = await exporter.export();

  if (result.success) {
    console.log('\n✅ Export successful!');
    console.log(`   Output: ${result.outputPath}`);
    console.log(`   Duration: ${result.duration?.toFixed(2)}s`);
    console.log(`   Estimated file size: Very large (ProRes)`);
  } else {
    console.error('\n❌ Export failed:', result.error?.message);
  }
}

main();
