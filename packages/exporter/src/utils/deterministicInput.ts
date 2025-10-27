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

  // Auto-advance dialogue by calling nextSentence directly
  // This helps progress through say commands that block on user input
  window.__AUTO_ADVANCE_ENABLED__ = true;

  const waitForWebGAL = setInterval(() => {
    if (!window.WebGAL?.gameplay) return;

    // WebGAL is loaded, start auto-advance
    const autoAdvanceInterval = setInterval(() => {
      if (!window.__AUTO_ADVANCE_ENABLED__) return;

      const controller = window.WebGAL.gameplay.performController;
      const hasActivePerforms = controller?.performList?.length > 0;

      // Check if we're at title screen
      const GUIState = window.webgalStore?.getState?.()?.GUI;
      const showTitle = GUIState?.showTitle;

      // If there are no active performs and we're not at title screen,
      // try to advance to next sentence
      if (!hasActivePerforms && !showTitle) {
        // Directly call nextSentence (exposed via WebGAL)
        // This is safer than simulating keyboard events
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
            document.dispatchEvent(eventUp);
          }, 50);
        } catch (e) {
          console.error('[Auto] Failed to advance:', e);
        }
      }
    }, 300); // Check every 300ms

    clearInterval(waitForWebGAL);
  }, 100);

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
