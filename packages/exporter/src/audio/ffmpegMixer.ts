/**
 * FFmpeg Audio Mixer - Mix multiple audio tracks with timing and effects
 */

import ffmpeg from 'fluent-ffmpeg';
import type { AudioTrack } from '../types.js';
import { join } from 'path';

export class FFmpegMixer {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  /**
   * Mix audio tracks into a single WAV file
   * Returns null if no tracks to mix
   */
  async mixAudioTracks(tracks: AudioTrack[], outputPath: string, totalDuration: number): Promise<string | null> {
    if (tracks.length === 0) {
      if (this.verbose) {
        console.log('[FFmpeg] No audio tracks to mix, skipping audio generation');
      }
      return null;
    }

    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Group tracks by type for better mixing
      const bgmTracks = tracks.filter((t) => t.type === 'bgm');
      const vocalTracks = tracks.filter((t) => t.type === 'vocal');
      const seTracks = tracks.filter((t) => t.type === 'se');

      // Build filter complex
      const filters: string[] = [];
      const inputs: string[] = [];
      let inputIndex = 0;

      // Process BGM tracks
      for (const track of bgmTracks) {
        command.input(track.filePath);
        const filterChain = this.buildAudioFilter(track, inputIndex);
        filters.push(filterChain);
        inputs.push(`[a${inputIndex}]`);
        inputIndex++;
      }

      // Process vocal tracks
      for (const track of vocalTracks) {
        command.input(track.filePath);
        const filterChain = this.buildAudioFilter(track, inputIndex);
        filters.push(filterChain);
        inputs.push(`[a${inputIndex}]`);
        inputIndex++;
      }

      // Process SE tracks
      for (const track of seTracks) {
        command.input(track.filePath);
        const filterChain = this.buildAudioFilter(track, inputIndex);
        filters.push(filterChain);
        inputs.push(`[a${inputIndex}]`);
        inputIndex++;
      }

      // Mix all inputs
      const mixFilter = `${inputs.join('')}amix=inputs=${inputs.length}:duration=longest:dropout_transition=2[aout]`;
      filters.push(mixFilter);

      // Apply filters
      command.complexFilter(filters);

      // Output settings
      command
        .outputOptions(['-map', '[aout]'])
        .audioCodec('pcm_s16le')
        .audioFrequency(48000)
        .audioChannels(2)
        .output(outputPath);

      if (this.verbose) {
        command.on('start', (cmd) => {
          console.log('[FFmpeg] Command:', cmd);
        });

        command.on('progress', (progress) => {
          console.log(`[FFmpeg] Processing: ${progress.percent?.toFixed(1)}% done`);
        });
      }

      command.on('error', (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`));
      });

      command.on('end', () => {
        if (this.verbose) {
          console.log(`[FFmpeg] Audio mixed to ${outputPath}`);
        }
        resolve(outputPath);
      });

      command.run();
    });
  }

  /**
   * Build audio filter for a single track
   */
  private buildAudioFilter(track: AudioTrack, inputIndex: number): string {
    const filters: string[] = [];

    // Delay (adelay)
    if (track.startTime > 0) {
      const delayMs = Math.floor(track.startTime * 1000);
      filters.push(`adelay=${delayMs}|${delayMs}`);
    }

    // Volume
    if (track.volume !== 1.0) {
      filters.push(`volume=${track.volume}`);
    }

    // Fade in
    if (track.fadeIn && track.fadeIn > 0) {
      filters.push(`afade=t=in:st=${track.startTime}:d=${track.fadeIn}`);
    }

    // Fade out
    if (track.fadeOut && track.fadeOut > 0) {
      const fadeOutStart = track.startTime + track.duration - track.fadeOut;
      filters.push(`afade=t=out:st=${fadeOutStart}:d=${track.fadeOut}`);
    }

    // Loop (aloop) - for BGM
    if (track.loop && track.loopEndTime) {
      const loopCount = Math.ceil(track.loopEndTime / track.duration);
      if (loopCount > 1) {
        filters.push(`aloop=loop=${loopCount - 1}:size=${Math.floor(track.duration * 48000 * 4)}`);
      }
    }

    // Trim to duration
    filters.push(`atrim=0:${track.duration}`);

    const filterStr = filters.join(',');
    return `[${inputIndex}:a]${filterStr}[a${inputIndex}]`;
  }

  /**
   * Create a silent audio track
   */
  private async createSilentTrack(outputPath: string, duration: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();
      command
        .input('anullsrc=channel_layout=stereo:sample_rate=48000')
        .inputFormat('lavfi')
        .duration(duration)
        .audioCodec('pcm_s16le')
        .audioFrequency(48000)
        .audioChannels(2)
        .output(outputPath)
        .on('error', reject)
        .on('end', () => resolve())
        .run();
    });
  }

  /**
   * Mux audio and video into final output
   */
  async muxAudioVideo(
    videoPath: string,
    audioPath: string,
    outputPath: string,
    codec: 'prores' | 'h264' | 'vp9' = 'h264',
    quality?: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions(['-map', '0:v:0', '-map', '1:a:0', '-shortest']);

      // Video codec settings
      switch (codec) {
        case 'prores':
          command.videoCodec('prores_ks').outputOptions(['-profile:v', '3', '-pix_fmt', 'yuv422p10le']);
          break;
        case 'h264':
          command
            .videoCodec('libx264')
            .outputOptions(['-preset', 'slow', '-crf', (quality || 18).toString(), '-pix_fmt', 'yuv420p']);
          break;
        case 'vp9':
          command
            .videoCodec('libvpx-vp9')
            .outputOptions(['-crf', (quality || 30).toString(), '-b:v', '0']);
          break;
      }

      // Audio codec
      command.audioCodec('aac').audioBitrate('320k');

      command.output(outputPath);

      if (this.verbose) {
        command.on('start', (cmd) => {
          console.log('[FFmpeg] Muxing command:', cmd);
        });

        command.on('progress', (progress) => {
          console.log(`[FFmpeg] Muxing: ${progress.percent?.toFixed(1)}% done`);
        });
      }

      command.on('error', reject);
      command.on('end', () => {
        if (this.verbose) {
          console.log(`[FFmpeg] Video muxed to ${outputPath}`);
        }
        resolve();
      });

      command.run();
    });
  }

  /**
   * Encode frames to video
   */
  async encodeVideo(
    framesPattern: string,
    outputPath: string,
    frameRate: number,
    codec: 'prores' | 'h264' | 'vp9' = 'h264',
    quality?: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg()
        .input(framesPattern)
        .inputOptions(['-framerate', frameRate.toString()])
        .outputOptions(['-r', frameRate.toString()]);

      // Video codec settings
      switch (codec) {
        case 'prores':
          command.videoCodec('prores_ks').outputOptions(['-profile:v', '3', '-pix_fmt', 'yuv422p10le']);
          break;
        case 'h264':
          command
            .videoCodec('libx264')
            .outputOptions(['-preset', 'slow', '-crf', (quality || 18).toString(), '-pix_fmt', 'yuv420p']);
          break;
        case 'vp9':
          command
            .videoCodec('libvpx-vp9')
            .outputOptions(['-crf', (quality || 30).toString(), '-b:v', '0']);
          break;
      }

      command.output(outputPath);

      if (this.verbose) {
        command.on('start', (cmd) => {
          console.log('[FFmpeg] Encode command:', cmd);
        });

        command.on('progress', (progress) => {
          console.log(`[FFmpeg] Encoding: ${progress.percent?.toFixed(1)}% done`);
        });
      }

      command.on('error', reject);
      command.on('end', () => {
        if (this.verbose) {
          console.log(`[FFmpeg] Video encoded to ${outputPath}`);
        }
        resolve();
      });

      command.run();
    });
  }
}
