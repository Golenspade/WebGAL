import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('http://localhost:3000');

await page.waitForTimeout(5000);

const result = await page.evaluate(() => {
  return {
    webgalExists: typeof window.WebGAL !== 'undefined',
    webgalKeys: typeof window.WebGAL !== 'undefined' ? Object.keys(window.WebGAL) : [],
    gameplayExists: typeof window.WebGAL !== 'undefined' && typeof window.WebGAL.gameplay !== 'undefined',
    performControllerExists: typeof window.WebGAL !== 'undefined' && window.WebGAL.gameplay && typeof window.WebGAL.gameplay.performController !== 'undefined',
    changeSceneExists: typeof window.__webgal_changeScene === 'function',
  };
});

console.log('WebGAL State:', JSON.stringify(result, null, 2));

await browser.close();
