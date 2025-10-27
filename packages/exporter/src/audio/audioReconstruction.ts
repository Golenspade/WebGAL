/**
 * Audio Reconstruction - Build audio timeline from captured events
 */

import type { TimelineEvent, AudioTrack, AudioData } from '../types.js';
import { resolve, join } from 'path';
import { writeFile } from 'fs/promises';

export class AudioReconstruction {
  private gameAssetsPath: string;
  private verbose: boolean;

  constructor(gameAssetsPath: string, verbose = false) {
    this.gameAssetsPath = gameAssetsPath;
    this.verbose = verbose;
  }

  /**
   * Build audio tracks from timeline events
   */
  buildAudioTracks(events: TimelineEvent[]): AudioTrack[] {
    const tracks: AudioTrack[] = [];
    // Include video_audio and ui_se events
    const audioEvents = events.filter((e) =>
      e.type === 'bgm' || e.type === 'vocal' || e.type === 'se' || e.type === 'video_audio' || e.type === 'ui_se'
    );

    for (const event of audioEvents) {
      const audioData = event.data as AudioData;

      // Resolve audio file path
      const filePath = this.resolveAudioPath(audioData.url);

      // Calculate timing
      const startTime = event.startTime / 1000; // Convert to seconds
      let duration = event.duration / 1000;

      // For BGM with unknown duration, estimate from next BGM or scene end
      if (duration < 0 && audioData.audioType === 'bgm') {
        const nextBgmEvent = audioEvents.find(
          (e) => e.type === 'bgm' && e.startTime > event.startTime
        );
        if (nextBgmEvent) {
          duration = (nextBgmEvent.startTime - event.startTime) / 1000;
        } else {
          // Use a default long duration, will be trimmed during encoding
          duration = 3600; // 1 hour
        }
      }

      // Normalize video and ui_se to 'se' type for mixing
      const normalizedType =
        (audioData.audioType === 'video' || audioData.audioType === 'ui_se') ? 'se' : audioData.audioType;

      const track: AudioTrack = {
        type: normalizedType as 'bgm' | 'vocal' | 'se',
        filePath,
        startTime,
        duration,
        volume: audioData.volume / 100, // Normalize to 0-1
        loop: audioData.loop,
        fadeIn: audioData.fadeIn ? audioData.fadeIn / 1000 : undefined,
        fadeOut: audioData.fadeOut ? audioData.fadeOut / 1000 : undefined,
      };

      tracks.push(track);
    }

    if (this.verbose) {
      console.log(`[Audio] Built ${tracks.length} audio tracks`);
    }

    return tracks;
  }

  /**
   * Resolve audio file path from URL
   */
  private resolveAudioPath(url: string): string {
    // Remove leading slash and 'game/' prefix if present
    let relativePath = url.replace(/^\//, '').replace(/^game\//, '');

    // Resolve to absolute path
    return resolve(this.gameAssetsPath, relativePath);
  }

  /**
   * Export audio timeline as JSON for debugging
   */
  async exportTimelineJson(tracks: AudioTrack[], outputPath: string): Promise<void> {
    const json = JSON.stringify(
      {
        version: '1.0',
        tracks,
        metadata: {
          generatedAt: new Date().toISOString(),
          trackCount: tracks.length,
        },
      },
      null,
      2
    );

    await writeFile(outputPath, json, 'utf-8');

    if (this.verbose) {
      console.log(`[Audio] Timeline exported to ${outputPath}`);
    }
  }

  /**
   * Group tracks by type for mixing
   */
  groupTracksByType(tracks: AudioTrack[]): {
    bgm: AudioTrack[];
    vocal: AudioTrack[];
    se: AudioTrack[];
  } {
    return {
      bgm: tracks.filter((t) => t.type === 'bgm'),
      vocal: tracks.filter((t) => t.type === 'vocal'),
      se: tracks.filter((t) => t.type === 'se'),
    };
  }

  /**
   * Calculate total duration from tracks
   */
  calculateTotalDuration(tracks: AudioTrack[]): number {
    let maxEndTime = 0;

    for (const track of tracks) {
      const endTime = track.startTime + track.duration;
      if (endTime > maxEndTime) {
        maxEndTime = endTime;
      }
    }

    return maxEndTime;
  }
}
