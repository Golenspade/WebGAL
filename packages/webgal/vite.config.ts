import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import loadVersion from 'vite-plugin-package-version';
import { resolve, relative } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { readdirSync, watch, writeFileSync } from 'fs';
import { isEqual } from 'lodash';
import Info from 'unplugin-info/vite';
import viteCompression from 'vite-plugin-compression';

// https://vitejs.dev/config/

// @ts-ignore
const env = process.env.NODE_ENV;
console.log(env);
(() => {
  const pixiPerformScriptDirPath = './src/Core/gameScripts/pixi/performs/';
  const pixiPerformManagerDirPath = './src/Core/util/pixiPerformManager/';
  const relativePath = relative(pixiPerformManagerDirPath, pixiPerformScriptDirPath).replaceAll('\\', '/');
  let lastFiles: string[] = [];
  const enablePixiWatch = process.env.WEBGAL_PIXI_WATCH !== '0';

  function setInitFile() {
    console.log('正在自动编写pixi特效依赖注入');
    writeFileSync(
      resolve(pixiPerformManagerDirPath, 'initRegister.ts'),
      lastFiles
        .map((v) => {
          const filePath = relativePath + '/' + v.slice(0, v.lastIndexOf('.'));
          return `import '${filePath}';`;
        })
        .join('\n') + '\n',
      { encoding: 'utf-8' },
    );
  }

  function getPixiPerformScriptFiles() {
    const pixiPerformScriptFiles = readdirSync(pixiPerformScriptDirPath, { encoding: 'utf-8' }).filter((v) =>
      ['ts', 'js', 'tsx', 'jsx'].includes(v.slice(v.indexOf('.') + 1, v.length)),
    );
    if (!isEqual(pixiPerformScriptFiles, lastFiles)) {
      lastFiles = pixiPerformScriptFiles;
      setInitFile();
    }
  }

  getPixiPerformScriptFiles();

  if (env !== 'production' && enablePixiWatch) {
    try {
      watch(pixiPerformScriptDirPath, { encoding: 'utf-8' }, getPixiPerformScriptFiles);
    } catch (e: any) {
      console.warn(
        '[vite] Failed to watch Pixi performs dir. You can disable with WEBGAL_PIXI_WATCH=0. Error:',
        e?.message || e,
      );
    }
  }
})();

export default defineConfig({
  plugins: [
    react(),
    loadVersion(),
    Info(),
    viteCompression({
      filter: /^(.*assets).*\.(js|css|ttf)$/,
    }),
    // @ts-ignore
    // visualizer(),
  ],
  resolve: {
    alias: {
      '@': resolve('src'),
    },
  },
  server: {
    watch: {
      // Allow opting into polling to reduce native watchers if hitting EMFILE
      usePolling: process.env.CHOKIDAR_USEPOLLING === '1',
      interval: process.env.CHOKIDAR_INTERVAL ? Number(process.env.CHOKIDAR_INTERVAL) : 200,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/output/**',
        '**/raw-video/**',
        '**/frames/**',
        '**/audio/**',
      ],
    },
  },
  build: {
    // sourcemap: true,
  },
});
