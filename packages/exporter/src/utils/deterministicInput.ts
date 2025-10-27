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

  const waitForWebGAL = setInterval(() => {
    // @ts-expect-error - WebGAL is available in browser context
    if (typeof WebGAL === 'undefined' || !WebGAL.gameplay?.performController) {
      return;
    }
    clearInterval(waitForWebGAL);

    console.log('[Auto] WebGAL loaded, starting auto-advance mechanism');

    // WebGAL is loaded, start auto-advance
    const autoAdvanceInterval = setInterval(() => {
      if (!window.__AUTO_ADVANCE_ENABLED__) return;

      // @ts-expect-error - WebGAL is available in browser context
      const controller = WebGAL.gameplay.performController;
      // @ts-expect-error - WebGAL is available in browser context
      const sceneData = WebGAL.sceneManager?.sceneData;
      const hasActivePerforms = controller?.performList?.length > 0;

      // Check if we're at title screen
      const GUIState = window.webgalStore?.getState?.()?.GUI;
      const showTitle = GUIState?.showTitle;

      // Check if there are interactive elements (choices or inputs)
      // @ts-expect-error - document is available in browser context
      const hasChoice = document.querySelector('.Choose_item') !== null;
      // @ts-expect-error - document is available in browser context
      const hasInput = document.querySelector('#user-input') !== null;

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

      // If there are no active performs, not at title screen, and no interactive elements,
      // try to advance to next sentence
      if (!hasActivePerforms && !showTitle && !hasChoice && !hasInput) {
        console.log('[Auto] Advancing... (sentence:', currentSentenceId, 'failed:', window.__FAILED_ADVANCE_COUNT__, ')');
        try {
          // Simulate space key press to trigger the hotkey handler
          const event = new KeyboardEvent('keydown', {
            key: ' ',
            code: 'Space',
            keyCode: 32,
            which: 32,
            bubbles: true,
            cancelable: true
          });
          // @ts-expect-error - document is available in browser context
          document.dispatchEvent(event);

          // Also dispatch keyup to prevent lock
          setTimeout(() => {
            const eventUp = new KeyboardEvent('keyup', {
              key: ' ',
              code: 'Space',
              keyCode: 32,
              which: 32,
              bubbles: true,
              cancelable: true
            });
            // @ts-expect-error - document is available in browser context
            document.dispatchEvent(eventUp);
          }, 50);

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

            // Check if it's a choice dialog (actual class name is Choose_item with underscore)
            if (element.classList?.contains('Choose_Main') ||
                element.querySelector?.('.Choose_item')) {

              setTimeout(() => {
                const choiceIndex = window.__AUTO_RESPONSES__.choiceIndex;
                const selectedOption = window.__AUTO_RESPONSES__.choices[choiceIndex] || 0;

                // Find choice buttons (actual class name is Choose_item, not ChooseItem)
                const choices = document.querySelectorAll('.Choose_item:not(.Choose_item_disabled)');
                if (choices[selectedOption]) {
                  console.log('[Auto] Selecting choice', choiceIndex, 'option', selectedOption);
                  choices[selectedOption].click();
                  window.__AUTO_RESPONSES__.choiceIndex++;
                }
              }, 100);
            }

            // Check if it's an input dialog (uses #user-input and .button)
            if (element.querySelector?.('#user-input')) {

              setTimeout(() => {
                const inputIndex = window.__AUTO_RESPONSES__.inputIndex;
                const inputValue = window.__AUTO_RESPONSES__.inputs[inputIndex] || '';

                // Find input field (ID is user-input)
                const inputField = document.querySelector('#user-input');
                // Find submit button (class is .button in getUserInput.module.scss)
                const submitButton = element.querySelector('.button');

                if (inputField && submitButton) {
                  console.log('[Auto] Filling input', inputIndex, 'with', inputValue);
                  inputField.value = inputValue;

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
