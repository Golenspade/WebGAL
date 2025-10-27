import { WebgalCore } from '@/Core/webgalCore';
import { Live2DCore } from '@/Core/live2DCore';
import { changeScene } from '@/Core/controller/scene/changeScene';
import { startGame, continueGame } from '@/Core/controller/gamePlay/startContinueGame';
import { setVisibility } from '@/store/GUIReducer';

export const WebGAL = new WebgalCore();
export const Live2D = new Live2DCore();

// Expose WebGAL to window for debugging and exporter
if (typeof window !== 'undefined') {
  const w = window as any;
  w.WebGAL = WebGAL;
  w.Live2D = Live2D;
  w.__webgal_changeScene = changeScene;
  // Additional helpers for automated capture/exporter
  w.__webgal_startGame = startGame;
  w.__webgal_continueGame = continueGame;
  w.__webgal_hideTitle = () => {
    const store = (window as any).webgalStore;
    if (store && typeof store.dispatch === 'function') {
      store.dispatch(setVisibility({ component: 'showTitle', visibility: false }));
    }
  };
}
