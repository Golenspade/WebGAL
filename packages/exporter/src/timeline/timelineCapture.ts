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

        // Special handling for playEffect (SE) - commandType 34
        // SE audio elements are not inserted into DOM, so we need to capture them here
        if (script?.command === 34) { // commandType.playEffect
          const url = script.content;
          const volume = script.args?.find(arg => arg.key === 'volume')?.value || 100;
          const isLoop = script.args?.find(arg => arg.key === 'id')?.value ? true : false;

          window.__logTimelineEvent__({
            type: 'se',
            startTime: Date.now() - window.__EXPORT_TIMELINE__.startTime,
            duration: -1, // SE duration is unknown until it ends
            data: {
              audioType: 'se',
              url: url,
              volume: volume,
              loop: isLoop,
            },
          });
        }

        // Call original
        return originalArrangeNewPerform(perform, script, syncPerformState);
      };

      console.log('[Exporter] Successfully hooked arrangeNewPerform');

      // Observe audio elements for BGM, vocal, and video tracking
      const observeAudioElements = () => {
        // Track BGM element
        const bgmElement = document.getElementById('currentBgm');
        if (bgmElement) {
          bgmElement.addEventListener('play', function() {
            const src = this.src;
            if (src && !src.includes('blob:')) {
              window.__logTimelineEvent__({
                type: 'bgm',
                startTime: Date.now() - window.__EXPORT_TIMELINE__.startTime,
                duration: -1, // BGM duration is unknown, will be estimated
                data: {
                  audioType: 'bgm',
                  url: src,
                  volume: this.volume * 100,
                  loop: this.loop,
                },
              });
            }
          });

          // Track BGM volume changes (for fade in/out)
          bgmElement.addEventListener('volumechange', function() {
            console.log('[Exporter] BGM volume changed to', this.volume);
            // TODO: Record volume change events for accurate timeline
          });

          // Track BGM pause/stop
          bgmElement.addEventListener('pause', function() {
            console.log('[Exporter] BGM paused');
            // TODO: Record BGM stop event
          });
        }

        // Track Vocal element (currentVocal)
        const vocalElement = document.getElementById('currentVocal');
        if (vocalElement) {
          vocalElement.addEventListener('play', function() {
            const src = this.src;
            if (src && !src.includes('blob:')) {
              window.__logTimelineEvent__({
                type: 'vocal',
                startTime: Date.now() - window.__EXPORT_TIMELINE__.startTime,
                duration: (this.duration || 0) * 1000,
                data: {
                  audioType: 'vocal',
                  url: src,
                  volume: this.volume * 100,
                  loop: this.loop,
                },
              });
            }
          });

          vocalElement.addEventListener('ended', function() {
            console.log('[Exporter] Vocal ended');
          });
        }

        // Observe for video elements (for video audio tracks)
        const observeVideos = () => {
          const videos = document.querySelectorAll('video');
          videos.forEach((videoElement) => {
            videoElement.addEventListener('play', function() {
              const src = this.src || this.currentSrc;
              if (src && !src.includes('blob:')) {
                window.__logTimelineEvent__({
                  type: 'video_audio',
                  startTime: Date.now() - window.__EXPORT_TIMELINE__.startTime,
                  duration: (this.duration || 0) * 1000,
                  data: {
                    audioType: 'video',
                    url: src,
                    volume: this.volume * 100,
                    loop: this.loop,
                  },
                });
              }
            });
          });
        };

        observeVideos();

        // Observe for new video elements
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeName === 'VIDEO') {
                const videoElement = node;
                videoElement.addEventListener('play', function() {
                  const src = this.src || this.currentSrc;
                  if (src && !src.includes('blob:')) {
                    window.__logTimelineEvent__({
                      type: 'video_audio',
                      startTime: Date.now() - window.__EXPORT_TIMELINE__.startTime,
                      duration: (this.duration || 0) * 1000,
                      data: {
                        audioType: 'video',
                        url: src,
                        volume: this.volume * 100,
                        loop: this.loop,
                      },
                    });
                  }
                });
              }
            });
          });
        });

        observer.observe(document.body, { childList: true, subtree: true });
        console.log('[Exporter] Audio and video observer installed');
      };

      observeAudioElements();

      // Monitor Redux store for UI sound effects
      // UI SE is triggered via store.dispatch(setStage({ key: 'uiSe', value: url }))
      if (window.webgalStore) {
        let previousUiSe = '';
        window.webgalStore.subscribe(() => {
          const state = window.webgalStore.getState();
          const currentUiSe = state?.stage?.uiSe;

          if (currentUiSe && currentUiSe !== previousUiSe && currentUiSe !== '') {
            window.__logTimelineEvent__({
              type: 'ui_se',
              startTime: Date.now() - window.__EXPORT_TIMELINE__.startTime,
              duration: -1, // UI SE duration is unknown
              data: {
                audioType: 'ui_se',
                url: currentUiSe,
                volume: 50, // Default UI SE volume
                loop: false,
              },
            });
            previousUiSe = currentUiSe;
          }
        });
        console.log('[Exporter] UI SE monitor installed');
      }

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
 *
 * Improved logic:
 * - Don't just check if performList is empty (dialogue waits have empty performList)
 * - Check if we're back at title screen (showTitle = true)
 * - Check if scene has ended (end command)
 * - Check for sustained idle period (no performs, no audio, no text changes)
 */
export async function waitForSceneComplete(page: any, timeoutMs = 60000): Promise<void> {
  const startTime = Date.now();
  let lastActivityTime = Date.now();
  let lastSentenceId = -1;
  let idleCount = 0;
  const IDLE_THRESHOLD = 30; // 30 checks * 100ms = 3 seconds of idle

  // Poll for scene completion
  while (Date.now() - startTime < timeoutMs) {
    const status = await page.evaluate(() => {
      // @ts-expect-error - window is available in browser context
      if (!window.WebGAL?.gameplay?.performController) return { complete: false, reason: 'not_loaded' };

      // @ts-expect-error - window is available in browser context
      const controller = window.WebGAL.gameplay.performController;
      // @ts-expect-error - window is available in browser context
      const GUIState = window.webgalStore?.getState?.()?.GUI;
      // @ts-expect-error - window is available in browser context
      const sceneData = window.WebGAL.sceneManager?.sceneData;

      // Check if we're back at title screen
      if (GUIState?.showTitle === true) {
        return { complete: true, reason: 'title_screen' };
      }

      // Check if scene has ended (reached end of sentence list)
      const currentSentenceId = sceneData?.currentSentenceId || 0;
      const totalSentences = sceneData?.currentScene?.sentenceList?.length || 0;
      const hasActivePerforms = controller.performList?.length > 0;

      // Check for audio activity
      // @ts-expect-error - document is available in browser context
      const bgmElement = document.getElementById('currentBgm');
      // @ts-expect-error - document is available in browser context
      const vocalElement = document.getElementById('currentVocal');
      const hasAudioActivity =
        (bgmElement && !bgmElement.paused) ||
        (vocalElement && !vocalElement.paused);

      return {
        complete: false,
        hasActivePerforms,
        hasAudioActivity,
        currentSentenceId,
        totalSentences,
        atEnd: currentSentenceId >= totalSentences - 1,
      };
    });

    if (status.complete) {
      console.log(`[Exporter] Scene complete: ${status.reason}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return;
    }

    // Track activity
    const hasActivity = status.hasActivePerforms || status.hasAudioActivity;
    const sentenceChanged = status.currentSentenceId !== lastSentenceId;

    if (hasActivity || sentenceChanged) {
      lastActivityTime = Date.now();
      idleCount = 0;
      lastSentenceId = status.currentSentenceId;
    } else {
      idleCount++;
    }

    // If we've been idle for long enough AND we're at the end of the scene, consider it complete
    if (idleCount >= IDLE_THRESHOLD && status.atEnd) {
      console.log('[Exporter] Scene complete: sustained idle at end of scene');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Scene completion timeout');
}
