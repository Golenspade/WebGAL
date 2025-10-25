/**
 * Browser Capture - Headless browser management with Playwright
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import type { ExportConfig } from '../types.js';
import { TIMELINE_INJECTION_SCRIPT } from '../timeline/timelineCapture.js';

export class BrowserCapture {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: ExportConfig;
  private videoPath: string | null = null;

  constructor(config: ExportConfig) {
    this.config = config;
  }

  /**
   * Initialize browser and load WebGAL
   */
  async initialize(enableVideoRecording: boolean = false, videoDir?: string): Promise<Page> {
    const { resolution, webgalUrl = 'http://localhost:3000', verbose, tempDir } = this.config;

    if (verbose) {
      console.log('[Browser] Launching Chromium...');
    }

    // Launch browser
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--autoplay-policy=no-user-gesture-required',
      ],
    });

    // Prepare video recording options
    const recordVideoOptions = enableVideoRecording && videoDir ? {
      recordVideo: {
        dir: videoDir,
        size: resolution,
      },
    } : {};

    // Create context with viewport and optional video recording
    this.context = await this.browser.newContext({
      viewport: {
        width: resolution.width,
        height: resolution.height,
      },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      locale: 'zh-CN',
      ...recordVideoOptions,
    });

    // Create page
    this.page = await this.context.newPage();

    // Enable console logging in verbose mode
    if (verbose) {
      this.page.on('console', (msg) => {
        const text = msg.text();
        if (text.startsWith('[Timeline]') || text.startsWith('[Exporter]')) {
          console.log('[Browser]', text);
        }
      });
    }

    // Listen for errors
    this.page.on('pageerror', (error) => {
      console.error('[Browser] Page error:', error);
    });

    if (verbose) {
      console.log(`[Browser] Loading WebGAL from ${webgalUrl}...`);
    }

    // Navigate to WebGAL
    await this.page.goto(webgalUrl, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Inject timeline capture script
    await this.page.addScriptTag({
      content: TIMELINE_INJECTION_SCRIPT,
    });

    if (verbose) {
      console.log('[Browser] WebGAL loaded and timeline capture injected');
    }

    return this.page;
  }

  /**
   * Load and start a specific scene
   */
  async loadScene(scenePath: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const { verbose } = this.config;

    if (verbose) {
      console.log(`[Browser] Loading scene: ${scenePath}`);
    }

    // Wait for WebGAL to be ready
    await this.page.waitForFunction(
      `typeof window.WebGAL !== 'undefined' && window.WebGAL.gameplay`,
      { timeout: 10000 }
    );

    // Load the scene using the exposed API
    const sceneLoaded = await this.page.evaluate((path) => {
      // @ts-expect-error - window is available in browser context
      if (typeof window.__webgal_changeScene === 'function') {
        const sceneName = path.split('/').pop()?.replace('.txt', '') ?? 'scene';
        // @ts-expect-error - window is available in browser context
        window.__webgal_changeScene(path, sceneName);
        return true;
      }

      // Fallback warning
      console.warn('[Exporter] __webgal_changeScene API not available. Using default scene.');
      return false;
    }, scenePath);

    if (!sceneLoaded && verbose) {
      console.warn('[Browser] Scene loading API not available, continuing with default scene');
    }

    // Wait for scene to start
    await this.page.waitForFunction(
      `window.__EXPORT_TIMELINE__?.sceneStarted === true`,
      { timeout: 5000 }
    );

    if (verbose) {
      console.log('[Browser] Scene loaded and started');
    }
  }

  /**
   * Get the current page
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    return this.page;
  }

  /**
   * Get recorded video path
   */
  async getVideoPath(): Promise<string | null> {
    if (!this.page) {
      return null;
    }

    try {
      const videoPath = await this.page.video()?.path();
      if (videoPath) {
        this.videoPath = videoPath;
      }
      return videoPath || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Close browser and finalize video recording
   */
  async close(): Promise<void> {
    // Get video path before closing
    if (this.page && this.page.video()) {
      try {
        this.videoPath = await this.page.video()?.path() || null;
      } catch (error) {
        // Ignore errors
      }
    }

    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Get the saved video path after closing
   */
  getSavedVideoPath(): string | null {
    return this.videoPath;
  }
}
