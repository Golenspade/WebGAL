/**
 * Timeline Capture - Intercept WebGAL PerformController to log timeline
 */

import type { TimelineEvent, PerformData, AudioData } from '../types.js';

export interface TimelineCapture {
  events: TimelineEvent[];
  startTime: number;
  endTime: number;
}

/**
 * Browser-side script to inject into WebGAL page
 * This hooks into the PerformController and logs all performs
 *
 * FIXED: Uses arrangeNewPerform (the actual method) instead of addPerform
 * FIXED: Handles audio via DOM observation since store access is complex
 */
export const TIMELINE_INJECTION_SCRIPT = `
(function() {
  // Create global timeline storage
  window.__EXPORT_TIMELINE__ = {
    events: [],
    frames: [],
    startTime: Date.now(),
    currentTime: 0,
    sceneStarted: false,
    capturing: false,
  };

  // Helper to log timeline events
  window.__logTimelineEvent__ = function(event) {
    const timestamp = Date.now() - window.__EXPORT_TIMELINE__.startTime;
    window.__EXPORT_TIMELINE__.events.push({
      ...event,
      timestamp,
    });
    console.log('[Timeline]', event.type, timestamp + 'ms', event);
  };

  // Wait for WebGAL to load
  const waitForWebGAL = setInterval(() => {
    if (typeof WebGAL === 'undefined' || !WebGAL.gameplay?.performController) {
      return;
    }
    clearInterval(waitForWebGAL);

    console.log('[Exporter] WebGAL loaded, hooking into PerformController...');

    try {
      // Hook into PerformController.arrangeNewPerform (the ACTUAL method)
      const performController = WebGAL.gameplay.performController;
      const originalArrangeNewPerform = performController.arrangeNewPerform.bind(performController);

      performController.arrangeNewPerform = function(perform, script, syncPerformState) {
        // Log the perform
        window.__logTimelineEvent__({
          type: 'perform',
          startTime: Date.now() - window.__EXPORT_TIMELINE__.startTime,
          duration: perform.duration || 0,
          data: {
            performName: perform.performName,
            commandType: script?.command || 'unknown',
            blockingNext: perform.blockingNext ? perform.blockingNext() : false,
            blockingAuto: perform.blockingAuto ? perform.blockingAuto() : false,
            goNextWhenOver: perform.goNextWhenOver || false,
            content: script?.content || '',
          },
        });

        // Call original
        return originalArrangeNewPerform(perform, script, syncPerformState);
      };

      console.log('[Exporter] Successfully hooked arrangeNewPerform');

      // Observe audio elements for BGM and vocal tracking
      const observeAudioElements = () => {
        // Track existing audio
        const bgmElement = document.getElementById('currentBgm');
        if (bgmElement) {
          bgmElement.addEventListener('play', function() {
            const src = this.src;
            if (src && !src.includes('blob:')) {
              window.__logTimelineEvent__({
                type: 'bgm',
                startTime: Date.now() - window.__EXPORT_TIMELINE__.startTime,
                duration: -1,
                data: {
                  audioType: 'bgm',
                  url: src,
                  volume: this.volume * 100,
                  loop: this.loop,
                },
              });
            }
          });
        }

        // Observe for new audio elements
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeName === 'AUDIO') {
                const audioElement = node;
                audioElement.addEventListener('play', function() {
                  const src = this.src;
                  if (!src || src.includes('blob:')) return;

                  const isVocal = this.className?.includes('vocal') ||
                                  this.id?.includes('vocal');

                  window.__logTimelineEvent__({
                    type: isVocal ? 'vocal' : 'se',
                    startTime: Date.now() - window.__EXPORT_TIMELINE__.startTime,
                    duration: (this.duration || 0) * 1000,
                    data: {
                      audioType: isVocal ? 'vocal' : 'se',
                      url: src,
                      volume: this.volume * 100,
                      loop: this.loop,
                    },
                  });
                });
              }
            });
          });
        });

        observer.observe(document.body, { childList: true, subtree: true });
        console.log('[Exporter] Audio observer installed');
      };

      observeAudioElements();

      // Mark scene as started
      window.__EXPORT_TIMELINE__.sceneStarted = true;
      window.__logTimelineEvent__({
        type: 'scene_start',
        startTime: 0,
        duration: 0,
        data: {
          sceneName: 'current',
          scenePath: window.location.href,
        },
      });

      console.log('[Exporter] Timeline capture initialized successfully');
    } catch (error) {
      console.error('[Exporter] Failed to hook into PerformController:', error);
      console.error('[Exporter] Error stack:', error.stack);
      // Mark as started anyway to not block the exporter
      window.__EXPORT_TIMELINE__.sceneStarted = true;
    }
  }, 100);

  // Stop timeout after 30 seconds
  setTimeout(() => {
    clearInterval(waitForWebGAL);
    console.warn('[Exporter] Timeout waiting for WebGAL');
  }, 30000);
})();
`;

/**
 * Extract timeline from browser page
 */
export async function extractTimeline(page: any): Promise<TimelineCapture> {
  const timelineData = await page.evaluate(() => {
    // @ts-expect-error - window is available in browser context
    if (!window.__EXPORT_TIMELINE__) {
      return { events: [], startTime: 0, endTime: 0 };
    }

    return {
      // @ts-expect-error - window is available in browser context
      events: window.__EXPORT_TIMELINE__.events,
      // @ts-expect-error - window is available in browser context
      startTime: window.__EXPORT_TIMELINE__.startTime,
      endTime: Date.now(),
    };
  });

  return timelineData;
}

/**
 * Wait for scene to complete
 * NOTE: This is used to determine when to STOP capturing, not when to START
 */
export async function waitForSceneComplete(page: any, timeoutMs = 60000): Promise<void> {
  const startTime = Date.now();

  // Poll for scene completion
  while (Date.now() - startTime < timeoutMs) {
    const isComplete = await page.evaluate(() => {
      // @ts-expect-error - window is available in browser context
      if (!window.WebGAL?.gameplay?.performController) return false;

      // Check if all performs are done
      // @ts-expect-error - window is available in browser context
      const controller = window.WebGAL.gameplay.performController;
      const hasActivePerforms = controller.performList?.length > 0;

      return !hasActivePerforms;
    });

    if (isComplete) {
      // Wait a bit more for final renders
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Scene completion timeout');
}
