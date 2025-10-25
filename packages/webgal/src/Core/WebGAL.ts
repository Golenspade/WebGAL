import { WebgalCore } from '@/Core/webgalCore';
import { Live2DCore } from '@/Core/live2DCore';
import { changeScene } from '@/Core/controller/scene/changeScene';

export const WebGAL = new WebgalCore();
export const Live2D = new Live2DCore();

// Expose WebGAL to window for debugging and exporter
if (typeof window !== 'undefined') {
  const w = window as any;
  w.WebGAL = WebGAL;
  w.Live2D = Live2D;
  w.__webgal_changeScene = changeScene;
}
