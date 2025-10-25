/**
 * Frame Capture - Capture frames from Pixi canvas and DOM overlay
 */

import type { Page } from 'playwright';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';
import type { CaptureFrame, ExportConfig } from '../types.js';

export class FrameCapture {
  private config: ExportConfig;
  private frameCount: number = 0;
  private framesDir: string;

  constructor(config: ExportConfig, framesDir: string) {
    this.config = config;
    this.framesDir = framesDir;
  }

  /**
   * Capture a single frame from the page
   */
  async captureFrame(page: Page, timestamp: number): Promise<CaptureFrame> {
    const frameNumber = this.frameCount++;
    const filename = `frame_${frameNumber.toString().padStart(5, '0')}.png`;
    const filePath = join(this.framesDir, filename);

    // Capture full page screenshot (includes Pixi canvas + DOM)
    const screenshotBuffer = await page.screenshot({
      type: 'png',
      fullPage: false,
    });

    // Save to disk
    await writeFile(filePath, screenshotBuffer);

    return {
      frameNumber,
      timestamp,
      imageData: screenshotBuffer.toString('base64'),
      filePath,
    };
  }

  /**
   * Capture frames at specified intervals
   */
  async *captureFrames(
    page: Page,
    startTime: number,
    endTime: number,
    frameRate: number = 60
  ): AsyncGenerator<CaptureFrame> {
    const frameDuration = 1000 / frameRate; // ms per frame
    let currentTime = startTime;

    while (currentTime <= endTime) {
      // Wait until the game reaches this timestamp
      await this.waitForTimestamp(page, currentTime);

      // Capture the frame
      const frame = await this.captureFrame(page, currentTime);
      yield frame;

      currentTime += frameDuration;
    }
  }

  /**
   * Wait for game to reach a specific timestamp
   */
  private async waitForTimestamp(page: Page, targetTime: number): Promise<void> {
    // This is a simplified version - in reality, you might need to
    // step through the game's animation frames or control time more precisely
    await page.waitForTimeout(16); // Wait one frame (~60fps)
  }

  /**
   * Alternative: Capture by stepping through performs
   */
  async captureByPerforms(
    page: Page,
    onProgress?: (frame: CaptureFrame, total: number) => void
  ): Promise<CaptureFrame[]> {
    const frames: CaptureFrame[] = [];
    const { frameRate, verbose } = this.config;
    const frameDuration = 1000 / frameRate;

    // Get initial timeline length
    let lastEventTime = await page.evaluate(() => {
      // @ts-expect-error - window is available in browser context
      const events = window.__EXPORT_TIMELINE__?.events || [];
      if (events.length === 0) return 0;
      const lastEvent = events[events.length - 1];
      return lastEvent.timestamp + (lastEvent.duration || 0);
    });

    let currentTime = 0;
    const estimatedFrames = Math.ceil(lastEventTime / frameDuration);

    if (verbose) {
      console.log(`[FrameCapture] Estimated frames: ${estimatedFrames}`);
    }

    // Capture frames at regular intervals
    while (currentTime <= lastEventTime) {
      // Check if timeline has extended
      const newLastEventTime = await page.evaluate(() => {
        // @ts-expect-error - window is available in browser context
        const events = window.__EXPORT_TIMELINE__?.events || [];
        if (events.length === 0) return 0;
        const lastEvent = events[events.length - 1];
        return lastEvent.timestamp + (lastEvent.duration || 0);
      });

      if (newLastEventTime > lastEventTime) {
        lastEventTime = newLastEventTime;
      }

      // Capture frame
      const frame = await this.captureFrame(page, currentTime);
      frames.push(frame);

      if (onProgress) {
        onProgress(frame, estimatedFrames);
      }

      currentTime += frameDuration;

      // Small delay to let the browser render
      await page.waitForTimeout(5);
    }

    return frames;
  }

  /**
   * Get frame count
   */
  getFrameCount(): number {
    return this.frameCount;
  }

  /**
   * Reset frame counter
   */
  reset(): void {
    this.frameCount = 0;
  }

  /**
   * Extract frames from recorded video using ffmpeg
   */
  async extractFromVideo(
    videoPath: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<number> {
    const { frameRate, verbose } = this.config;

    if (verbose) {
      console.log(`[FrameCapture] Extracting frames from video: ${videoPath}`);
      console.log(`[FrameCapture] Target frame rate: ${frameRate} fps`);
    }

    return new Promise((resolve, reject) => {
      // Use ffmpeg to extract frames
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-vf', `fps=${frameRate}`,
        '-pix_fmt', 'yuv420p',
        join(this.framesDir, 'frame_%05d.png'),
      ]);

      let totalFrames = 0;
      let errorOutput = '';

      // Capture stderr for progress
      ffmpeg.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        errorOutput += output;

        if (verbose) {
          // Parse frame number from ffmpeg output
          const frameMatch = output.match(/frame=\s*(\d+)/);
          if (frameMatch) {
            const currentFrame = parseInt(frameMatch[1], 10);
            totalFrames = Math.max(totalFrames, currentFrame);
            if (onProgress && currentFrame % 30 === 0) {
              onProgress(currentFrame, totalFrames);
            }
          }
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          this.frameCount = totalFrames;
          if (verbose) {
            console.log(`[FrameCapture] Extracted ${totalFrames} frames successfully`);
          }
          resolve(totalFrames);
        } else {
          reject(new Error(`ffmpeg exited with code ${code}: ${errorOutput}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`Failed to spawn ffmpeg: ${error.message}`));
      });
    });
  }
}

/**
 * Alternative frame capture using requestAnimationFrame in browser
 */
export const RAF_CAPTURE_SCRIPT = `
(function() {
  window.__FRAME_CAPTURE__ = {
    frames: [],
    capturing: false,
    canvas: null,

    start: function() {
      this.capturing = true;
      this.canvas = document.querySelector('#pixiCanvas');
      this.captureLoop();
    },

    stop: function() {
      this.capturing = false;
    },

    captureLoop: function() {
      if (!this.capturing) return;

      if (this.canvas) {
        const timestamp = Date.now() - window.__EXPORT_TIMELINE__.startTime;

        // Convert canvas to data URL
        try {
          const dataUrl = this.canvas.toDataURL('image/png');
          this.frames.push({
            timestamp,
            dataUrl,
          });
        } catch (e) {
          console.error('Failed to capture frame:', e);
        }
      }

      requestAnimationFrame(() => this.captureLoop());
    },

    getFrames: function() {
      return this.frames;
    },

    clear: function() {
      this.frames = [];
    },
  };
})();
`;
