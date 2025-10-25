#!/usr/bin/env node

/**
 * WebGAL Video Exporter CLI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { resolve, basename, extname } from 'path';
import { readFile } from 'fs/promises';
import type { ExportConfig, BranchScript, ExportProgress } from '../types.js';
import { WebGALExporter } from '../exporter.js';

const program = new Command();

program
  .name('webgal-export')
  .description('Export WebGAL scenes to video files')
  .version('0.1.0');

program
  .command('export')
  .description('Export a scene to video')
  .argument('<scene>', 'Path to scene file (e.g., game/scene/start.txt)')
  .option('-o, --output <path>', 'Output video file path', 'output.mov')
  .option('-w, --width <number>', 'Video width', '1920')
  .option('-h, --height <number>', 'Video height', '1080')
  .option('-f, --framerate <number>', 'Frame rate (fps)', '60')
  .option('-c, --codec <codec>', 'Video codec (prores|h264|vp9)', 'h264')
  .option('-q, --quality <number>', 'Video quality (h264: 0-51, vp9: 0-63, lower=better)', '18')
  .option('-t, --text-speed <number>', 'Text speed override (1-10)', undefined)
  .option('-a, --auto-speed <number>', 'Auto mode speed (ms per sentence)', undefined)
  .option('-b, --branch-script <path>', 'JSON file with deterministic branch choices')
  .option('-u, --url <url>', 'WebGAL dev server URL', 'http://localhost:3000')
  .option('--temp-dir <path>', 'Temporary directory for frames')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (scenePath: string, options: any) => {
    const spinner = ora('Initializing export...').start();

    try {
      // Parse options
      const config = await buildConfig(scenePath, options);

      // Log configuration
      if (options.verbose) {
        console.log(chalk.cyan('\nExport Configuration:'));
        console.log(JSON.stringify(config, null, 2));
        console.log('');
      }

      spinner.succeed('Configuration loaded');

      // Start export
      const exporter = new WebGALExporter(config, (progress: ExportProgress) => {
        updateSpinner(spinner, progress);
      });

      const result = await exporter.export();

      if (result.success) {
        spinner.succeed(
          chalk.green(
            `✓ Export complete!\n  Output: ${result.outputPath}\n  Duration: ${result.duration?.toFixed(2)}s\n  Frames: ${result.totalFrames}`
          )
        );
        process.exit(0);
      } else {
        spinner.fail(chalk.red(`Export failed: ${result.error?.message}`));
        if (options.verbose && result.error) {
          console.error(result.error);
        }
        process.exit(1);
      }
    } catch (error: any) {
      spinner.fail(chalk.red(`Error: ${error.message}`));
      if (options.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Generate a default configuration file')
  .option('-o, --output <path>', 'Output config file path', 'webgal-export.json')
  .action(async (options: any) => {
    const defaultConfig: Partial<ExportConfig> = {
      scenePath: 'game/scene/start.txt',
      outputPath: 'output.mov',
      resolution: {
        width: 1920,
        height: 1080,
      },
      frameRate: 60,
      codec: 'h264',
      quality: 18,
      webgalUrl: 'http://localhost:3000',
      verbose: false,
    };

    const { writeFile } = await import('fs/promises');
    await writeFile(options.output, JSON.stringify(defaultConfig, null, 2));

    console.log(chalk.green(`✓ Configuration file created: ${options.output}`));
  });

program
  .command('branch-script')
  .description('Generate a template branch script file')
  .option('-o, --output <path>', 'Output branch script file path', 'branch-script.json')
  .action(async (options: any) => {
    const templateScript: BranchScript = {
      choices: {
        0: 0, // First choice, select option 0
        1: 1, // Second choice, select option 1
      },
      inputs: {
        0: 'Player Name', // First input
        1: 'Some Value', // Second input
      },
    };

    const { writeFile } = await import('fs/promises');
    await writeFile(options.output, JSON.stringify(templateScript, null, 2));

    console.log(chalk.green(`✓ Branch script template created: ${options.output}`));
    console.log(chalk.yellow('\nEdit this file to specify your deterministic choices and inputs.'));
  });

/**
 * Build export configuration from CLI options
 */
async function buildConfig(scenePath: string, options: any): Promise<ExportConfig> {
  let branchScript: BranchScript | undefined;

  if (options.branchScript) {
    const branchScriptPath = resolve(process.cwd(), options.branchScript);
    const branchScriptContent = await readFile(branchScriptPath, 'utf-8');
    branchScript = JSON.parse(branchScriptContent);
  }

  // Determine output path
  let outputPath = options.output;
  if (!extname(outputPath)) {
    // If no extension, add based on codec
    const ext = options.codec === 'prores' ? '.mov' : options.codec === 'vp9' ? '.webm' : '.mp4';
    outputPath += ext;
  }

  const config: ExportConfig = {
    scenePath: resolve(process.cwd(), scenePath),
    outputPath: resolve(process.cwd(), outputPath),
    resolution: {
      width: parseInt(options.width),
      height: parseInt(options.height),
    },
    frameRate: parseInt(options.framerate),
    codec: options.codec as 'prores' | 'h264' | 'vp9',
    quality: options.quality ? parseInt(options.quality) : undefined,
    textSpeed: options.textSpeed ? parseInt(options.textSpeed) : undefined,
    autoSpeed: options.autoSpeed ? parseInt(options.autoSpeed) : undefined,
    branchScript,
    webgalUrl: options.url,
    tempDir: options.tempDir ? resolve(process.cwd(), options.tempDir) : undefined,
    verbose: options.verbose,
  };

  return config;
}

/**
 * Update spinner based on progress
 */
function updateSpinner(spinner: any, progress: ExportProgress): void {
  const percentage = progress.progress.toFixed(1);
  let icon = '⏳';

  switch (progress.phase) {
    case 'init':
      icon = '🔧';
      break;
    case 'capture':
      icon = '📹';
      break;
    case 'audio':
      icon = '🎵';
      break;
    case 'encode':
      icon = '🎬';
      break;
    case 'done':
      icon = '✅';
      break;
    case 'error':
      icon = '❌';
      break;
  }

  const frameInfo =
    progress.currentFrame && progress.totalFrames ? ` [${progress.currentFrame}/${progress.totalFrames}]` : '';

  spinner.text = `${icon} ${progress.message}${frameInfo} (${percentage}%)`;

  if (progress.phase === 'error') {
    spinner.fail(chalk.red(progress.message));
  }
}

// Parse and execute
program.parse();
