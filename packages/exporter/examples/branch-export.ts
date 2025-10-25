/**
 * Branch Export Example
 *
 * This example shows how to export a scene with choices using deterministic responses
 */

import { WebGALExporter, type ExportConfig, type BranchScript } from '../src/index.js';

async function main() {
  // Define deterministic responses for branches
  const branchScript: BranchScript = {
    choices: {
      0: 0, // First choice: select option 0 (e.g., "Yes")
      1: 1, // Second choice: select option 1 (e.g., "Go right")
      2: 0, // Third choice: select option 0
    },
    inputs: {
      0: 'Player', // First input: player name
      1: '25', // Second input: age
    },
  };

  const config: ExportConfig = {
    scenePath: 'game/scene/branching-story.txt',
    outputPath: 'output/branching-story.mp4',
    resolution: { width: 1920, height: 1080 },
    frameRate: 60,
    codec: 'h264',
    quality: 18,

    // Provide branch script for deterministic playback
    branchScript,

    webgalUrl: 'http://localhost:3000',
    verbose: true,
  };

  console.log('Starting export with branch script...\n');
  console.log('Branch choices:', branchScript.choices);
  console.log('Input values:', branchScript.inputs);
  console.log('');

  const exporter = new WebGALExporter(config, (progress) => {
    console.log(`${progress.phase}: ${progress.message}`);
  });

  const result = await exporter.export();

  if (result.success) {
    console.log('\n✅ Export successful!');
    console.log(`   Output: ${result.outputPath}`);
  } else {
    console.error('\n❌ Export failed:', result.error?.message);
  }
}

main();
