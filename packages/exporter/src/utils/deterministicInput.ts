/**
 * Deterministic Input - Auto-respond to choices and inputs
 */

import type { Page } from 'playwright';
import type { BranchScript } from '../types.js';

/**
 * Browser injection script for auto-responding to interactive elements
 */
export const DETERMINISTIC_INPUT_SCRIPT = `
(function() {
  window.__AUTO_RESPONSES__ = {
    choices: {},
    inputs: {},
    choiceIndex: 0,
    inputIndex: 0,
  };

  window.__setupAutoResponses__ = function(branchScript) {
    if (branchScript) {
      window.__AUTO_RESPONSES__.choices = branchScript.choices || {};
      window.__AUTO_RESPONSES__.inputs = branchScript.inputs || {};
    }
  };

  // Auto-click title screen to enter game
  const autoEnterGame = setInterval(() => {
    const titleEnter = document.querySelector('.title__enter-game-target');
    if (titleEnter) {
      console.log('[Auto] Clicking title screen to enter game');
      titleEnter.click();
      clearInterval(autoEnterGame);
    }
  }, 100);

  // Auto-advance dialogue with cooldown and success confirmation
  // This helps progress through say commands that block on user input
  window.__AUTO_ADVANCE_ENABLED__ = true;
  window.__LAST_ADVANCE_AT__ = 0;
  window.__LAST_SENTENCE_ID__ = -1;
  window.__FAILED_ADVANCE_COUNT__ = 0;

  let checkCount = 0;
  const waitForWebGAL = setInterval(() => {
    checkCount++;
    const hasWebGAL = typeof WebGAL !== 'undefined';
    const hasGameplay = hasWebGAL && WebGAL.gameplay;
    const hasController = hasGameplay && WebGAL.gameplay.performController;

    if (checkCount % 50 === 0) {
      console.log('[Auto] Waiting for WebGAL... (check:', checkCount, 'WebGAL:', hasWebGAL, 'gameplay:', hasGameplay, 'controller:', hasController, ')');
    }

    if (!hasController) {
      return;
    }
    clearInterval(waitForWebGAL);

    console.log('[Auto] WebGAL loaded, starting auto-advance mechanism');

    // WebGAL is loaded, start auto-advance
    const autoAdvanceInterval = setInterval(() => {
      if (!window.__AUTO_ADVANCE_ENABLED__) return;

      const controller = WebGAL.gameplay.performController;
      const sceneData = WebGAL.sceneManager?.sceneData;
      const hasActivePerforms = controller?.performList?.length > 0;

      // Check if we're at title screen
      const hasStore = !!window.webgalStore && typeof window.webgalStore.getState === 'function';
      if (!hasStore && (window.__AUTO_DEBUG__ ?? true)) {
        console.warn('[Auto] webgalStore not available on window');
      }
      const GUIState = hasStore ? window.webgalStore.getState().GUI : undefined;
      const showTitle = GUIState?.showTitle;

      // Check if there are interactive elements (choices or inputs)
      const chooseContainer = document.getElementById('chooseContainer');
      const hasChoice = !!(chooseContainer && chooseContainer.querySelector('[class*="Choose_item"]:not([class*="Choose_item_disabled"])'));
      const hasInput = !!(chooseContainer && chooseContainer.querySelector('#user-input'));

      // Cooldown mechanism: prevent rapid-fire advances
      // Configurable via window.__AUTO_COOLDOWN__ and window.__AUTO_BACKOFF__ for DP-1.4 integration
      const COOLDOWN_MS = window.__AUTO_COOLDOWN__ ?? 600; // Minimum time between advances
      const BACKOFF_MS = window.__AUTO_BACKOFF__ ?? 2000;  // Backoff time after failed advances
      const now = Date.now();

      // If we failed to advance multiple times, use longer backoff
      const cooldown = window.__FAILED_ADVANCE_COUNT__ >= 3 ? BACKOFF_MS : COOLDOWN_MS;
      if (now - window.__LAST_ADVANCE_AT__ < cooldown) {
        return; // Still in cooldown period
      }

      // Check if sentence ID changed (advance was successful)
      const currentSentenceId = sceneData?.currentSentenceId ?? -1;
      if (window.__LAST_SENTENCE_ID__ !== -1 && currentSentenceId === window.__LAST_SENTENCE_ID__) {
        // Sentence didn't change, increment failed count
        window.__FAILED_ADVANCE_COUNT__++;
      } else if (currentSentenceId !== window.__LAST_SENTENCE_ID__) {
        // Sentence changed, reset failed count
        window.__FAILED_ADVANCE_COUNT__ = 0;
        window.__LAST_SENTENCE_ID__ = currentSentenceId;
      }

      // Handle interactive elements first
      if (!showTitle && hasChoice) {
        const choiceIndex = window.__AUTO_RESPONSES__.choiceIndex;
        const selectedOption = window.__AUTO_RESPONSES__.choices[choiceIndex] ?? 0;
        const nodeList = document.querySelectorAll('#chooseContainer [class*="Choose_item"]:not([class*="Choose_item_disabled"])');
        const choices = Array.prototype.slice.call(nodeList);
        if (choices.length > 0) {
          const idx = Math.min(selectedOption, choices.length - 1);
          console.log('[Auto] Selecting choice', choiceIndex, 'option', idx);
          // Use native click to ensure React onClick fires reliably
          choices[idx].click();
          window.__AUTO_RESPONSES__.choiceIndex++;
          window.__LAST_ADVANCE_AT__ = now;

          // Fallback: if sentence ID didn't change, programmatically jump to target label
          setTimeout(() => {
            try {
              const sceneData = WebGAL?.sceneManager?.sceneData;
              if (!sceneData) return;
              const unchanged = sceneData.currentSentenceId === (window.__LAST_SENTENCE_ID__ ?? -1);
              const stillHasChoice = !!document.querySelector('#chooseContainer [class*="Choose_item"]');
              if (!unchanged && !stillHasChoice) return;
              const list = sceneData.currentScene?.sentenceList || [];
              const current = list[sceneData.currentSentenceId];
              if (!current) return;
              const raw = (current.commandRaw || '').trim();
              console.log('[Auto][Fallback] currentSentenceId=', sceneData.currentSentenceId, 'command=', current.command, 'commandRaw=', raw, 'content=', current.content);
              // Expect like: "choose:Text1:label1|Text2:label2;"
              let jumpLabel = '';
              if (/^choose:/.test(raw)) {
                const rawBody = raw.replace(/^choose:/, '').replace(/;\s*$/, '');
                const parts = rawBody.split(/(?<!\\\\)\\|/);
                const pick = parts[idx] || parts[0] || '';
                const main = pick.split('->').length > 1 ? pick.split('->')[1] : pick;
                const nodes = main.split(/(?<!\\\\):/);
                jumpLabel = (nodes[1] || '').trim();
                console.log('[Auto][Fallback] parsed jumpLabel from choose:', jumpLabel, 'pick=', pick);
              }
              let target = sceneData.currentSentenceId;
              if (!jumpLabel) {
                // Fallback 2: find the first forward label line
                for (let i = sceneData.currentSentenceId + 1; i < list.length; i++) {
                  const s = list[i];
                  const r = (s?.commandRaw || '').trim();
                  if (r.startsWith('label:')) {
                    target = i;
                    jumpLabel = s.content || r.replace(/^label:/, '').replace(/;\s*$/, '');
                    console.log('[Auto][Fallback] using first forward label as target:', jumpLabel, 'at', target);
                    break;
                  }
                }
              } else {
                // Normal path: find the specified label
                for (let i = 0; i < list.length; i++) {
                  const s = list[i];
                  const r = (s?.commandRaw || '').trim();
                  if (r.startsWith('label:') && s.content === jumpLabel && i !== sceneData.currentSentenceId) {
                    target = i;
                    break;
                  }
                }
              }
              console.log('[Auto][Fallback] set currentSentenceId', target, 'label=', jumpLabel);
              sceneData.currentSentenceId = target;
              try { WebGAL.gameplay.performController?.unmountPerform?.('choose'); } catch (_){ }
              setTimeout(() => {
                try { WebGAL.gameplay.performController?.goNextWhenOver?.(); } catch (_){ }
                try { document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true })); } catch (_) {}
              }, 1);
            } catch (e) {
              console.warn('[Auto] Fallback jmp failed:', e);
            }
          }, 200);
        }
        return;
      }

      if (!showTitle && hasInput) {
        const inputIndex = window.__AUTO_RESPONSES__.inputIndex;
        const inputValue = window.__AUTO_RESPONSES__.inputs[inputIndex] || '';
        const inputField = document.querySelector('#user-input');
        const submitButton = document.querySelector('#chooseContainer [class*="button"]');
        if (inputField) {
          try { inputField.value = inputValue; } catch (_) {}
          inputField.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (submitButton) {
          console.log('[Auto] Filling input', inputIndex, 'with', inputValue);
          setTimeout(() => {
            // Use native click to ensure React onClick fires reliably
            submitButton.click();
          }, 50);
          window.__AUTO_RESPONSES__.inputIndex++;
          window.__LAST_ADVANCE_AT__ = now;
        }
        return;
      }

      // Advance when not at title and no interactive elements. Even if performs are active,
      // we simulate user pressing Space which stops performs (useHotkey.stopAll) before nextSentence.
      if (!showTitle) {
        const details = {
          showTitle,
          showMenuPanel: GUIState?.showMenuPanel,
          showBacklog: GUIState?.showBacklog,
          showPanicOverlay: GUIState?.showPanicOverlay,
          showTextBox: GUIState?.showTextBox,
          hasActivePerforms,
          currentSentenceId,
        };
        console.log('[Auto] Advancing... (sentence:', currentSentenceId, 'failed:', window.__FAILED_ADVANCE_COUNT__, ')');
        console.log('[Auto] State check:', details);
        try {
          // Ensure backlog closed and textbox visible to avoid gating
          if (hasStore) {
            if (GUIState?.showBacklog) {
              window.webgalStore.dispatch({ type: 'gui/setVisibility', payload: { component: 'showBacklog', visibility: false } });
            }
            if (GUIState?.showTextBox === false) {
              window.webgalStore.dispatch({ type: 'gui/setVisibility', payload: { component: 'showTextBox', visibility: true } });
            }
          }

          // Try 1: Simulate space key press to trigger the hotkey handler
          const evDown = new KeyboardEvent('keydown', {
            key: ' ',
            code: 'Space',
            // keyCode/which are readonly in modern browsers; included for legacy handlers
            bubbles: true,
            cancelable: true
          });
          Object.defineProperty(evDown, 'keyCode', { get: () => 32 });
          Object.defineProperty(evDown, 'which', { get: () => 32 });
          document.dispatchEvent(evDown);

          // Also dispatch keyup to release lock
          setTimeout(() => {
            const evUp = new KeyboardEvent('keyup', {
              key: ' ',
              code: 'Space',
              bubbles: true,
              cancelable: true
            });
            Object.defineProperty(evUp, 'keyCode', { get: () => 32 });
            Object.defineProperty(evUp, 'which', { get: () => 32 });
            document.dispatchEvent(evUp);
          }, 50);

          // Try 2 removed: Wheel fallback can unintentionally open backlog; rely on Space only

          // Record advance attempt
          window.__LAST_ADVANCE_AT__ = now;
        } catch (e) {
          console.error('[Auto] Failed to advance:', e);
        }
      }
    }, 300); // Check every 300ms
  }, 100);

  // Stop timeout after 30 seconds
  setTimeout(() => {
    clearInterval(waitForWebGAL);
    console.warn('[Auto] Timeout waiting for WebGAL');
  }, 30000);

  // Wait for WebGAL to load
  const waitForChoice = setInterval(() => {
    if (!window.WebGAL?.gameplay) return;

    // Monitor for choice dialogs and input dialogs
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const element = node;

            // Check if a choice dialog appeared inside #chooseContainer
            if (element.id === 'chooseContainer' || element.querySelector?.('#chooseContainer') || element.querySelector?.('[class*="Choose_item"]')) {

              setTimeout(() => {
                const choiceIndex = window.__AUTO_RESPONSES__.choiceIndex;
                const selectedOption = window.__AUTO_RESPONSES__.choices[choiceIndex] || 0;

                // Find choice buttons inside chooseContainer (CSS Modules friendly)
                const choices = document.querySelectorAll('#chooseContainer [class*="Choose_item"]:not([class*="Choose_item_disabled"])');
                if (choices.length > 0) {
                  const idx = Math.min(selectedOption, choices.length - 1);
                  console.log('[Auto] Selecting choice', choiceIndex, 'option', idx);
                  choices[idx].click();
                  window.__AUTO_RESPONSES__.choiceIndex++;
                }
              }, 100);
            }

            // Check if it's an input dialog (uses #user-input and CSS Modules .button)
            if (element.querySelector?.('#user-input')) {

              setTimeout(() => {
                const inputIndex = window.__AUTO_RESPONSES__.inputIndex;
                const inputValue = window.__AUTO_RESPONSES__.inputs[inputIndex] || '';

                // Find input field (ID is user-input)
                const inputField = document.querySelector('#user-input');
                // Find submit button (class name is CSS Modules based)
                const submitButton = document.querySelector('#chooseContainer [class*="button"]');

                if (inputField && submitButton) {
                  console.log('[Auto] Filling input', inputIndex, 'with', inputValue);
                  try { inputField.value = inputValue; } catch (_) {}

                  // Trigger input event
                  inputField.dispatchEvent(new Event('input', { bubbles: true }));

                  // Click submit
                  setTimeout(() => {
                    submitButton.click();
                    window.__AUTO_RESPONSES__.inputIndex++;
                  }, 50);
                }
              }, 100);
            }
          }
        });
      });
    });

    // Observe the entire document for choice/input dialogs
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    clearInterval(waitForChoice);
  }, 100);
})();
`;

export class DeterministicInput {
  private page: Page;
  private branchScript?: BranchScript;
  private verbose: boolean;

  constructor(page: Page, branchScript?: BranchScript, verbose = false) {
    this.page = page;
    this.branchScript = branchScript;
    this.verbose = verbose;
  }

  /**
   * Initialize deterministic input handling
   */
  async initialize(): Promise<void> {
    // Inject the script
    await this.page.addScriptTag({
      content: DETERMINISTIC_INPUT_SCRIPT,
    });

    // Set up auto responses
    if (this.branchScript) {
      await this.page.evaluate((script) => {
        // @ts-expect-error - window is available in browser context
        window.__setupAutoResponses__(script);
      }, this.branchScript);
    }

    if (this.verbose) {
      console.log('[DeterministicInput] Initialized with', this.branchScript);
    }
  }

  /**
   * Update branch script on the fly
   */
  async updateBranchScript(branchScript: BranchScript): Promise<void> {
    this.branchScript = branchScript;

    await this.page.evaluate((script) => {
      // @ts-expect-error - window is available in browser context
      window.__setupAutoResponses__(script);
    }, branchScript);

    if (this.verbose) {
      console.log('[DeterministicInput] Updated branch script');
    }
  }

  /**
   * Get current choice/input index
   */
  async getProgress(): Promise<{ choiceIndex: number; inputIndex: number }> {
    return await this.page.evaluate(() => {
      return {
        // @ts-expect-error - window is available in browser context
        choiceIndex: window.__AUTO_RESPONSES__?.choiceIndex || 0,
        // @ts-expect-error - window is available in browser context
        inputIndex: window.__AUTO_RESPONSES__?.inputIndex || 0,
      };
    });
  }
}
