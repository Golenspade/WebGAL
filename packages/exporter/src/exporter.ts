/**
 * Main Exporter - Orchestrates the entire export process
 */

import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ExportConfig, ExportResult, ExportProgress, TimelineEvent } from './types.js';
import { BrowserCapture } from './capture/browserCapture.js';
import { FrameCapture } from './capture/frameCapture.js';
import { extractTimeline, waitForSceneComplete } from './timeline/timelineCapture.js';
import { AudioReconstruction } from './audio/audioReconstruction.js';
import { FFmpegMixer } from './audio/ffmpegMixer.js';
import { DeterministicInput } from './utils/deterministicInput.js';

export class WebGALExporter {
  private config: ExportConfig;
  private tempDir: string;
  private onProgress?: (progress: ExportProgress) => void;

  constructor(config: ExportConfig, onProgress?: (progress: ExportProgress) => void) {
    this.config = {
      ...config,
      tempDir: config.tempDir || join(tmpdir(), `webgal-export-${Date.now()}`),
      verbose: config.verbose ?? false,
    };
    this.tempDir = this.config.tempDir!;
    this.onProgress = onProgress;
  }

  /**
   * Export scene to video
   */
  async export(): Promise<ExportResult> {
    const startTime = Date.now();

    try {
      // Initialize
      await this.reportProgress({
        phase: 'init',
        progress: 0,
        message: 'Initializing export...',
      });

      await this.initialize();

      // Capture phase
      await this.reportProgress({
        phase: 'capture',
        progress: 10,
        message: 'Starting browser capture...',
      });

      const { timeline, totalFrames } = await this.captureScene();

      // Audio phase
      await this.reportProgress({
        phase: 'audio',
        progress: 50,
        message: 'Reconstructing audio...',
      });

      const audioPath = await this.reconstructAudio(timeline);

      // Encoding phase
      await this.reportProgress({
        phase: 'encode',
        progress: 70,
        message: 'Encoding video...',
      });

      const videoPath = await this.encodeVideo();

      // Final muxing
      if (audioPath) {
        await this.reportProgress({
          phase: 'encode',
          progress: 90,
          message: 'Muxing audio and video...',
        });

        await this.muxFinal(videoPath, audioPath);
      } else {
        // No audio - just copy video to output
        await this.reportProgress({
          phase: 'encode',
          progress: 90,
          message: 'Finalizing video (no audio)...',
        });

        await this.copyVideoToOutput(videoPath);
      }

      // Done
      const duration = (Date.now() - startTime) / 1000;

      await this.reportProgress({
        phase: 'done',
        progress: 100,
        message: `Export complete in ${duration.toFixed(1)}s`,
      });

      return {
        success: true,
        outputPath: this.config.outputPath,
        timelinePath: join(this.tempDir, 'timeline.json'),
        duration: timeline[timeline.length - 1]?.startTime / 1000 || 0,
        totalFrames,
      };
    } catch (error) {
      const err = error as Error;
      await this.reportProgress({
        phase: 'error',
        progress: 0,
        message: `Export failed: ${err.message}`,
        error: err,
      });

      return {
        success: false,
        error: err,
      };
    } finally {
      // Cleanup
      if (!this.config.verbose) {
        await this.cleanup();
      }
    }
  }

  /**
   * Initialize temp directories
   */
  private async initialize(): Promise<void> {
    await mkdir(this.tempDir, { recursive: true });
    await mkdir(join(this.tempDir, 'frames'), { recursive: true });
    await mkdir(join(this.tempDir, 'audio'), { recursive: true });
    await mkdir(join(this.tempDir, 'raw-video'), { recursive: true });

    if (this.config.verbose) {
      console.log(`[Exporter] Temp directory: ${this.tempDir}`);
    }
  }

  /**
   * Capture scene with browser (using video recording)
   */
  private async captureScene(): Promise<{ timeline: TimelineEvent[]; totalFrames: number }> {
    const browser = new BrowserCapture(this.config);
    let totalFrames = 0;
    const videoDir = join(this.tempDir, 'raw-video');

    try {
      // Launch browser with video recording enabled
      const page = await browser.initialize(true, videoDir);

      // Set up deterministic input (always inject for auto-advance and title click)
      const deterministicInput = new DeterministicInput(page, this.config.branchScript, this.config.verbose);
      await deterministicInput.initialize();

      // Apply CLI runtime overrides for DP-1.4 (cooldown/backoff/textSpeed)
      if (typeof this.config.autoSpeed === 'number') {
        await page.evaluate((ms: number) => {
          // @ts-expect-error - window is available in browser context
          window.__AUTO_COOLDOWN__ = Math.max(200, ms);
        }, this.config.autoSpeed);
      }
      if (typeof this.config.textSpeed === 'number') {
        await page.evaluate((speed: number) => {
          // @ts-expect-error - window is available in browser context
          window.__TEXT_SPEED__ = speed;
        }, this.config.textSpeed);
      }

      // Load scene
      await browser.loadScene(this.config.scenePath);

      // Wait for scene to complete
      await waitForSceneComplete(page, 300000); // 5 min timeout

      // Extract timeline
      const timelineData = await extractTimeline(page);

      if (this.config.verbose) {
        console.log(`[Exporter] Captured ${timelineData.events.length} timeline events`);
      }

      // Close browser to finalize video recording
      await browser.close();

      // Get the recorded video path
      const videoPath = browser.getSavedVideoPath();

      if (!videoPath) {
        throw new Error('Failed to get recorded video path');
      }

      if (this.config.verbose) {
        console.log(`[Exporter] Video recorded at: ${videoPath}`);
      }

      // Extract frames from video
      const frameCapture = new FrameCapture(this.config, join(this.tempDir, 'frames'));

      totalFrames = await frameCapture.extractFromVideo(videoPath, (current, total) => {
        this.reportProgress({
          phase: 'capture',
          progress: 10 + (current / Math.max(total, 1)) * 40,
          currentFrame: current,
          totalFrames: total,
          message: `Extracting frames: ${current}/${total}`,
        });
      });

      if (this.config.verbose) {
        console.log(`[Exporter] Extracted ${totalFrames} frames from video`);
      }

      return {
        timeline: timelineData.events,
        totalFrames,
      };
    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  /**
   * Reconstruct audio from timeline
   * Returns null if no audio tracks found
   */
  private async reconstructAudio(timeline: TimelineEvent[]): Promise<string | null> {
    // Resolve game assets base to packages/webgal/public/game (repo path)
    const assetsBase = join(process.cwd(), 'packages/webgal/public/game');
    const audioReconstruction = new AudioReconstruction(assetsBase, this.config.verbose);

    // Build audio tracks
    const tracks = audioReconstruction.buildAudioTracks(timeline);

    // Export timeline JSON
    const timelineJsonPath = join(this.tempDir, 'timeline.json');
    await audioReconstruction.exportTimelineJson(tracks, timelineJsonPath);

    // Calculate total duration
    const totalDuration = audioReconstruction.calculateTotalDuration(tracks);

    // Mix audio
    const ffmpegMixer = new FFmpegMixer(this.config.verbose);
    const audioPath = join(this.tempDir, 'audio', 'mixed.wav');

    return await ffmpegMixer.mixAudioTracks(tracks, audioPath, totalDuration);
  }

  /**
   * Encode frames to video
   */
  private async encodeVideo(): Promise<string> {
    const ffmpegMixer = new FFmpegMixer(this.config.verbose);
    const framesPattern = join(this.tempDir, 'frames', 'frame_%05d.png');
    const videoPath = join(this.tempDir, 'video_temp.mp4');

    await ffmpegMixer.encodeVideo(framesPattern, videoPath, this.config.frameRate, this.config.codec, this.config.quality);

    return videoPath;
  }

  /**
   * Mux video and audio
   */
  private async muxFinal(videoPath: string, audioPath: string): Promise<void> {
    const ffmpegMixer = new FFmpegMixer(this.config.verbose);

    await ffmpegMixer.muxAudioVideo(videoPath, audioPath, this.config.outputPath, this.config.codec, this.config.quality);
  }

  /**
   * Copy video to output (no audio)
   */
  private async copyVideoToOutput(videoPath: string): Promise<void> {
    const { copyFile } = await import('fs/promises');
    await copyFile(videoPath, this.config.outputPath);
  }

  /**
   * Cleanup temp files
   */
  private async cleanup(): Promise<void> {
    try {
      await rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('[Exporter] Failed to cleanup temp directory:', error);
    }
  }

  /**
   * Report progress
   */
  private async reportProgress(progress: ExportProgress): Promise<void> {
    if (this.onProgress) {
      this.onProgress(progress);
    }

    if (this.config.verbose) {
      console.log(`[Exporter] ${progress.message} (${progress.progress.toFixed(1)}%)`);
    }
  }
}
