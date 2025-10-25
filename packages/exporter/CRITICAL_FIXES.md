# Critical Fixes for WebGAL Exporter

**Status: COMPLETED** ✅ (2025-10-25)

All critical fixes have been successfully implemented:
1. ✅ Fixed Timeline Hook - Uses `arrangeNewPerform` instead of non-existent `addPerform`
2. ✅ Fixed Audio Timeline - Implemented DOM observation for BGM/vocal/SE tracking
3. ✅ Fixed Scene Loading - Exposed `__webgal_changeScene` API in WebGAL core
4. ✅ Fixed Frame Capture - Implemented Playwright video recording + ffmpeg extraction
5. ✅ Updated Exporter Flow - Integrated all fixes into main export pipeline

**Files Modified**:
- `packages/webgal/src/Core/WebGAL.ts` - Exposed scene loading API
- `packages/exporter/src/timeline/timelineCapture.ts` - Already fixed
- `packages/exporter/src/capture/browserCapture.ts` - Updated to use new API and video recording
- `packages/exporter/src/capture/frameCapture.ts` - Added video extraction method
- `packages/exporter/src/exporter.ts` - Updated flow to use video recording

---

## Issues Found and Solutions

### Issue 1: `performController.addPerform` doesn't exist ❌
**Problem**: The injection script tries to hook `WebGAL.gameplay.performController.addPerform`, but this method doesn't exist.

**Root Cause**: The actual method is `arrangeNewPerform(perform, script, syncPerformState)` (see `packages/webgal/src/Core/Modules/perform/performController.ts:21`)

**Fix**:
```javascript
// WRONG (current):
const originalAddPerform = WebGAL.gameplay.performController.addPerform.bind(...)
WebGAL.gameplay.performController.addPerform = function(perform) { ... }

// CORRECT:
const originalArrangeNewPerform = WebGAL.gameplay.performController.arrangeNewPerform.bind(...)
WebGAL.gameplay.performController.arrangeNewPerform = function(perform, script, syncPerformState) {
  // Log the perform
  window.__logTimelineEvent__({
    type: 'perform',
    startTime: Date.now() - window.__EXPORT_TIMELINE__.startTime,
    duration: perform.duration || 0,
    data: {
      performName: perform.performName,
      commandType: script?.command || 'unknown',  // Get from script, not perform name
      blockingNext: perform.blockingNext ? perform.blockingNext() : false,
      blockingAuto: perform.blockingAuto ? perform.blockingAuto() : false,
      goNextWhenOver: perform.goNextWhenOver || false,
      content: script?.content || '',
    },
  });

  // Call original
  return originalArrangeNewPerform(perform, script, syncPerformState);
}
```

**Files to update**:
- `packages/exporter/src/timeline/timelineCapture.ts` (lines 47-68)

---

### Issue 2: `loadScene` API doesn't exist ❌
**Problem**: `browserCapture.ts` calls `window.WebGAL.gameplay.loadScene(path)` which doesn't exist anywhere in WebGAL.

**Root Cause**: The actual scene loading function is `changeScene(sceneUrl, sceneName)` from `packages/webgal/src/Core/controller/scene/changeScene.ts`

**Fix**:
```javascript
// In browserCapture.ts, loadScene method:

// WRONG (current):
await this.page.evaluate((path) => {
  if (window.WebGAL?.gameplay?.loadScene) {
    window.WebGAL.gameplay.loadScene(path);
  }
}, scenePath);

// CORRECT - Option A: Direct call if exposed
await this.page.evaluate((path) => {
  const sceneName = path.split('/').pop()?.replace('.txt', '') || 'scene';

  // changeScene is imported and used throughout WebGAL
  // We need to access it via dynamic import or expose it globally
  if (window.WebGAL?.sceneManager) {
    // The cleanest way: expose changeScene to window in WebGAL itself
    // Add to packages/webgal/src/Core/WebGAL.ts or initializeScript.ts:
    // window.__webgal_changeScene = changeScene;

    if (window.__webgal_changeScene) {
      window.__webgal_changeScene(path, sceneName);
    }
  }
}, scenePath);

// CORRECT - Option B: Use existing UI paths
// Instead of calling changeScene directly, simulate what the UI does
await this.page.evaluate((path) => {
  // WebGAL has a scene selector or we can trigger via URL params
  // Or use the editor sync mechanism if available
});
```

**Recommended approach**:
1. Add to `packages/webgal/src/Core/WebGAL.ts`:
```typescript
import { changeScene } from './controller/scene/changeScene';

// Expose for exporter
if (typeof window !== 'undefined') {
  (window as any).__webgal_changeScene = changeScene;
}
```

2. Then use it in the exporter

**Files to update**:
- `packages/webgal/src/Core/WebGAL.ts` or `initializeScript.ts` (expose changeScene)
- `packages/exporter/src/capture/browserCapture.ts` (use exposed function)

---

### Issue 3: Frame capture happens AFTER scene completion ❌
**Problem**: The exporter waits for the scene to complete (`waitForSceneComplete`), THEN captures frames. This means all frames are identical (the final frame).

**Root Cause**: Bad architecture - capture must happen DURING playback, not after.

**Fix**:

**Option A: Real-time capture with requestAnimationFrame**
```typescript
// NEW approach in frameCapture.ts:

async captureFramesDuringPlayback(
  page: Page,
  onProgress?: (frame: CaptureFrame) => void
): Promise<CaptureFrame[]> {
  const { frameRate } = this.config;
  const frameDuration = 1000 / frameRate;

  // Start capture BEFORE scene starts
  await page.evaluate((interval) => {
    window.__EXPORT_TIMELINE__.capturing = true;
    window.__EXPORT_TIMELINE__.frames = [];

    let frameCount = 0;
    const captureInterval = setInterval(() => {
      if (!window.__EXPORT_TIMELINE__.capturing) {
        clearInterval(captureInterval);
        return;
      }

      const canvas = document.querySelector('#pixiCanvas');
      if (canvas) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          window.__EXPORT_TIMELINE__.frames.push({
            frameNumber: frameCount++,
            timestamp: Date.now() - window.__EXPORT_TIMELINE__.startTime,
            dataUrl,
          });
        } catch (e) {
          console.error('Frame capture failed:', e);
        }
      }
    }, interval);
  }, frameDuration);

  // Wait for scene to complete
  await waitForSceneComplete(page);

  // Stop capture
  await page.evaluate(() => {
    window.__EXPORT_TIMELINE__.capturing = false;
  });

  // Extract frames
  const frames = await page.evaluate(() => {
    return window.__EXPORT_TIMELINE__.frames || [];
  });

  // Save to disk
  for (const frame of frames) {
    const buffer = Buffer.from(frame.dataUrl.split(',')[1], 'base64');
    const filename = `frame_${frame.frameNumber.toString().padStart(5, '0')}.png`;
    const filePath = join(this.framesDir, filename);
    await writeFile(filePath, buffer);

    if (onProgress) {
      onProgress({ ...frame, filePath }, frames.length);
    }
  }

  return frames;
}
```

**Option B: Puppeteer video recording (simpler)**
```typescript
// Use Playwright's built-in video recording
const context = await browser.newContext({
  recordVideo: {
    dir: this.tempDir,
    size: { width: 1920, height: 1080 },
  },
});

// After scene completes:
await context.close();
// Video is saved automatically

// Then extract frames with ffmpeg:
ffmpeg(videoPath)
  .outputOptions('-vf', `fps=${frameRate}`)
  .output('frame_%05d.png')
  .run();
```

**Files to update**:
- `packages/exporter/src/capture/frameCapture.ts` (complete rewrite)
- `packages/exporter/src/exporter.ts` (change flow: start capture -> start scene -> wait -> stop capture)

---

### Issue 4: Audio timeline is never populated ❌
**Problem**:
1. Store is accessed via `WebGAL.gameplay.pixiStage?.webgalStore` which doesn't exist
2. BGM dispatch payload is `{ src, enter, volume }` object, not a string
3. Even if hooked, the check `typeof bgmValue === 'string'` would fail

**Root Cause**:
- `webgalStore` is not exposed on window or pixiStage
- BGM payload structure misunderstood (see `packages/webgal/src/Core/controller/stage/playBgm.ts:33,36,40`)

**Fix**:

**Option A: Observe audio DOM elements (SIMPLEST)**
```javascript
// Already partially implemented in the fixed timeline script above
// Observe audio elements directly instead of hooking Redux

const observeAudioElements = () => {
  // Track BGM element
  const bgmElement = document.getElementById('currentBgm');
  if (bgmElement) {
    bgmElement.addEventListener('play', function() {
      window.__logTimelineEvent__({
        type: 'bgm',
        startTime: Date.now() - window.__EXPORT_TIMELINE__.startTime,
        duration: -1,
        data: {
          audioType: 'bgm',
          url: this.src,  // Full resolved URL
          volume: this.volume * 100,
          loop: this.loop,
        },
      });
    });
  }

  // Observe for vocal/SE audio elements
  const observer = new MutationObserver((mutations) => {
    // ... (see fixed script above)
  });
};
```

**Option B: Expose store (requires WebGAL changes)**
```typescript
// In packages/webgal/src/Core/WebGAL.ts:
import { webgalStore } from '@/store/store';

if (typeof window !== 'undefined') {
  (window as any).webgalStore = webgalStore;
}

// Then in exporter:
const store = window.webgalStore;
const originalDispatch = store.dispatch.bind(store);
store.dispatch = function(action) {
  if (action.payload?.key === 'bgm') {
    const bgm = action.payload.value;  // { src, enter, volume }
    if (bgm && bgm.src) {
      window.__logTimelineEvent__({
        type: 'bgm',
        data: {
          audioType: 'bgm',
          url: bgm.src,
          volume: bgm.volume || 100,
          fadeIn: bgm.enter > 0 ? bgm.enter : undefined,
          fadeOut: bgm.enter < 0 ? -bgm.enter : undefined,
        },
      });
    }
  }
  return originalDispatch(action);
};
```

**Recommended**: Use Option A (DOM observation) - no WebGAL changes needed

**Files to update**:
- `packages/exporter/src/timeline/timelineCapture.ts` (already fixed above)

---

## Summary of Required Changes

### High Priority (Blocking):
1. ✅ Fix `arrangeNewPerform` hook (timeline capture)
2. ⚠️ Fix scene loading (needs WebGAL exposure or workaround)
3. ❌ Fix frame capture timing (complete redesign needed)
4. ✅ Fix audio capture (use DOM observation)

### Changes to WebGAL Core (Optional but Recommended):
```typescript
// packages/webgal/src/Core/WebGAL.ts or initializeScript.ts

import { changeScene } from './controller/scene/changeScene';
import { webgalStore } from '@/store/store';

// Expose for exporter and debugging
if (typeof window !== 'undefined') {
  const w = window as any;
  w.__webgal_changeScene = changeScene;
  w.__webgal_store = webgalStore;  // Optional
}
```

### Changes to Exporter:

**1. timeline/timelineCapture.ts**: ✅ DONE
- Hook `arrangeNewPerform` instead of `addPerform`
- Use DOM audio observation instead of store hooks

**2. capture/browserCapture.ts**: ⚠️ NEEDS FIX
- Use `window.__webgal_changeScene` to load scenes
- OR: Don't load scenes at all, just use whatever is currently loaded (for MVP)

**3. capture/frameCapture.ts**: ❌ NEEDS COMPLETE REWRITE
- Capture frames DURING playback using `setInterval` + `canvas.toDataURL()`
- OR: Use Playwright video recording + ffmpeg frame extraction

**4. exporter.ts**: ⚠️ NEEDS FLOW CHANGE
- Start frame capture BEFORE scene starts
- Trigger scene start
- Wait for scene complete
- Stop frame capture
- Process captured frames

---

## Quick MVP Fix (Minimal Changes)

For a working MVP without modifying WebGAL core:

### 1. Fix timeline capture (DONE ✅)
Already fixed in the updated script above

### 2. Skip custom scene loading (WORKAROUND)
```typescript
// In browserCapture.ts:
async loadScene(scenePath: string): Promise<void> {
  // WORKAROUND: Don't load custom scene, just use what's already loaded
  // This means the exporter will export whatever scene WebGAL boots into

  if (this.config.verbose) {
    console.log(`[Browser] Skipping custom scene load, using default scene`);
    console.log(`[Browser] Requested: ${scenePath}`);
  }

  // Just wait for WebGAL to be ready
  await this.page.waitForFunction(
    () => window.__EXPORT_TIMELINE__?.sceneStarted === true,
    { timeout: 10000 }
  );
}
```

### 3. Use Playwright video recording (SIMPLER)
```typescript
// In browserCapture.ts:
const context = await this.browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: {
    dir: join(this.tempDir, 'video'),
    size: { width: 1920, height: 1080 },
  },
});

// After scene complete:
await context.close();

// Then in exporter.ts, extract frames:
const videoPath = /* path to saved video */;
await ffmpeg(videoPath)
  .output(join(this.tempDir, 'frames', 'frame_%05d.png'))
  .outputOptions(['-vf', `fps=${this.config.frameRate}`])
  .run();
```

### 4. Audio already works with DOM observation ✅

---

## Testing Plan

After applying fixes:

1. **Test timeline capture**:
   ```bash
   # Run exporter with verbose
   # Check browser console for "[Timeline]" logs
   # Verify events are logged
   ```

2. **Test scene loading**:
   ```bash
   # For MVP: manually navigate to desired scene first
   # Then run exporter
   ```

3. **Test frame capture**:
   ```bash
   # Check frames directory after export
   # Verify frames are different (not all identical)
   # Use: montage frame_*.png -geometry 100x100 preview.jpg
   ```

4. **Test audio**:
   ```bash
   # Check timeline.json for audio events
   # Verify URLs are correct
   # Test mixed audio plays correctly
   ```

---

## Next Steps

1. Apply timeline capture fix ✅ (DONE)
2. Decide on scene loading approach (WebGAL mod vs workaround)
3. Redesign frame capture (video recording vs setInterval)
4. Test end-to-end
5. Document limitations and workarounds
