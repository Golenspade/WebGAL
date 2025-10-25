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

  // Hook into WebGAL choice system
  const originalAddChoice = window.WebGAL?.gameplay?.performController?.addPerform;

  // Wait for WebGAL to load
  const waitForChoice = setInterval(() => {
    if (!window.WebGAL?.gameplay) return;

    // Monitor for choice dialogs
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const element = node;

            // Check if it's a choice dialog
            if (element.classList?.contains('ChooseItem') ||
                element.querySelector?.('.ChooseItem')) {

              setTimeout(() => {
                const choiceIndex = window.__AUTO_RESPONSES__.choiceIndex;
                const selectedOption = window.__AUTO_RESPONSES__.choices[choiceIndex] || 0;

                // Find choice buttons
                const choices = document.querySelectorAll('.ChooseItem');
                if (choices[selectedOption]) {
                  console.log('[Auto] Selecting choice', choiceIndex, 'option', selectedOption);
                  choices[selectedOption].click();
                  window.__AUTO_RESPONSES__.choiceIndex++;
                }
              }, 100);
            }

            // Check if it's an input dialog
            if (element.classList?.contains('UserInput') ||
                element.querySelector?.('.UserInput')) {

              setTimeout(() => {
                const inputIndex = window.__AUTO_RESPONSES__.inputIndex;
                const inputValue = window.__AUTO_RESPONSES__.inputs[inputIndex] || '';

                // Find input field
                const inputField = document.querySelector('.UserInput input');
                const submitButton = document.querySelector('.UserInput button');

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
