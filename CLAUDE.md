# WebGAL Engine - Codebase Architecture Guide

Last Updated: 2025-10-25

## Project Overview

WebGAL is a modern, web-based Visual Novel engine written in TypeScript and React. It enables developers to create visual novels using either the WebGAL Script format or a graphical editor. The engine renders to the web with beautiful animations, character sprites, backgrounds, and interactive UI - all without requiring traditional game development knowledge.

**Repository**: https://github.com/OpenWebGAL/WebGAL
**License**: MPL-2.0
**Current Version**: 4.5+
**Node Requirement**: >=18
**Package Manager**: Yarn 1.22.22

---

## Monorepo Structure

WebGAL is organized as a Yarn workspaces monorepo with the following packages:

### Core Packages

#### 1. **packages/parser** - WebGAL Script Parser
- **Purpose**: Parse and compile WebGAL Script files into executable instructions
- **Language**: TypeScript
- **Build Tool**: Rollup
- **Key Components**:
  - `scriptParser/`: Parses individual script commands (say, changeBg, changeFigure, etc.)
  - `sceneParser.ts`: Orchestrates parsing of entire scene files
  - `configParser/`: Parses game configuration files
  - `styleParser/`: Converts SCSS to CSS-in-JS objects
  - `sceneTextPreProcessor.ts`: Two-pass preprocessor handling multiline sequences
  - `scriptConfig.ts`: Maps script commands to command types (e.g., "changeBg" -> commandType.changeBg)

**Key Classes**:
- `SceneParser`: Main parser class (exported as default)
  - `parse(rawScene, sceneName, sceneUrl)`: Parses raw scene text
  - `parseConfig(configText)`: Parses game config
  - `parseScssToWebgalStyleObj(scssString)`: Converts SCSS to CSS-in-JS
  - `stringifyConfig(config)`: Converts config back to text format

**Supported Commands** (30+):
- Dialogue: `say`
- Assets: `changeBg`, `changeFigure`, `bgm`, `playVideo`
- Effects: `pixiPerform`, `pixiInit`, `playEffect`
- Narrative: `changeScene`, `label`, `jumpLabel`, `callScene`
- Interactivity: `choose`, `chooseLabel`, `getUserInput`
- Game Logic: `setVar`, `if`, `unlockCg`, `unlockBgm`
- UI: `filmMode`, `setTextbox`, `intro`
- Animation: `setAnimation`, `setComplexAnimation`, `setTempAnimation`, `setTransform`, `setTransition`
- Styling: `applyStyle`, `setFilter`

**Output Formats**: ES Module, CommonJS, IIFE (UMD)

#### 2. **packages/webgal** - Core Engine & React Frontend
- **Purpose**: Game engine runtime, UI rendering, and game state management
- **Languages**: TypeScript, TSX, SCSS
- **Build Tool**: Vite (dev) with React 17 + Redux
- **Key Directories**:
  ```
  src/
  ├── Core/                    # Game engine logic
  │   ├── Modules/             # Core game managers
  │   │   ├── animations.ts    # Animation state & manager
  │   │   ├── backlog.ts       # Dialog history manager
  │   │   ├── events.ts        # Event emission system
  │   │   ├── gamePlay.ts      # Game state & playback
  │   │   ├── perform/         # Visual effect performers
  │   │   └── scene.ts         # Scene management
  │   ├── gameScripts/         # Game command implementations
  │   │   ├── pixi/            # Pixi.js visual effects
  │   │   │   └── performs/    # Individual effect files (rain, snow, cherryBlossoms)
  │   │   ├── bgm.ts           # Background music
  │   │   ├── changeBg.ts      # Background changes
  │   │   ├── changeFigure.ts  # Character sprite changes
  │   │   ├── choose.ts        # Choice/branching
  │   │   ├── end.ts           # Game ending
  │   │   ├── intro.tsx        # Opening animation
  │   │   ├── jumpLabel.ts     # Branching logic
  │   │   ├── playEffect.ts    # Sound effects
  │   │   └── [40+ other command files]
  │   ├── parser/              # Parser instance management
  │   ├── util/                # Utility modules
  │   │   ├── coreInitialFunction/  # Bootstrap utilities
  │   │   ├── gameAssetsAccess/     # Asset loading
  │   │   ├── pixiPerformManager/   # Effect registration
  │   │   ├── prefetcher/           # Resource preloading
  │   │   └── syncWithEditor/       # WebSocket editor sync
  │   ├── controller/          # Scene & gameplay control
  │   ├── WebGAL.ts            # Engine singleton class
  │   ├── webgalCore.ts        # Core manager holder
  │   └── initializeScript.ts  # Initialization routine
  ├── Stage/                   # React render layer
  │   ├── MainStage/           # Main game canvas
  │   ├── TextBox/             # Dialog display
  │   ├── FigureContainer/     # Character sprites
  │   ├── AudioContainer/      # Audio management
  │   └── Stage.tsx            # Main stage component
  ├── UI/                      # UI Components
  │   ├── Title/               # Title screen
  │   ├── Menu/                # Main menu
  │   ├── Extra/               # Extra/gallery screens
  │   ├── BottomControlPanel/  # Controls UI
  │   ├── Backlog/             # Dialog history
  │   ├── GlobalDialog/        # System dialogs
  │   ├── DevPanel/            # Developer tools
  │   └── [other UI components]
  ├── store/                   # Redux state management
  │   ├── GUIReducer.ts        # UI visibility state
  │   ├── stageReducer.ts      # Game stage state
  │   ├── userDataReducer.ts   # Save/load data
  │   ├── savesReducer.ts      # Save slots
  │   └── store.ts             # Store configuration
  ├── hooks/                   # Custom React hooks
  │   ├── useHotkey.tsx        # Keyboard input handling
  │   ├── useConfigData.ts     # Game config loading
  │   ├── useLanguage.ts       # i18n support
  │   └── [other hooks]
  ├── config/                  # Static configuration
  │   ├── language.ts          # i18n setup
  │   ├── info.ts              # Version info
  │   └── index.ts
  ├── assets/                  # Static assets
  ├── translations/            # i18n strings (Chinese, English, Japanese, French, Korean)
  ├── App.tsx                  # Root React component
  ├── main.tsx                 # React entry point
  └── index.scss               # Global styles
  ```

**Key Classes/Singletons**:
- `WebgalCore`: Main engine singleton containing all managers
  - `sceneManager`: Current scene and scene loading
  - `backlogManager`: Dialog history
  - `animationManager`: Animation definitions and state
  - `gameplay`: Game progress, variables, saves
  - `events`: Event bus (mitt-based)
  
- `PixiStage`: WebGL rendering layer powered by Pixi.js
- Redux Store: Manages React component UI state

**Key Technologies**:
- React 17 with React-Redux
- Redux Toolkit for state management
- Pixi.js for WebGL rendering
- i18next for internationalization
- Sass for styling
- Vite for dev/build

#### 3. **packages/server** - Development Server & CLI
- **Purpose**: Local development server for testing games
- **Language**: JavaScript (Node.js)
- **Main File**: `index.js`
- **Features**:
  - Express.js HTTP server
  - Auto-detection of WebGAL game directories
  - Command-line mode for specified paths
  - Launches browser automatically
- **Port**: 3000 (default)
- **Usage**:
  ```bash
  npm start                    # Auto-detect mode
  node index.js /path/to/game # Specified path mode
  ```

#### 4. **packages/yukimi** - Legacy Compiler (Optional)
- Contains executable compilers (`ykmc.exe`) for other platforms
- Appears to be legacy/archived (only contains binary executables)
- Not actively used in current development

#### 5. **packages/webgal-next** (In Progress)
- Framework directory for potential Next.js migration
- Currently minimal/placeholder status

---

## Build Pipeline & Command Sequence

### Root Level Commands (from root `package.json`)

```bash
# Main build pipeline
yarn build          # Parser + Engine: yarn parser:build && yarn webgal:build
yarn build-ci       # CI variant: yarn parser:build-ci && yarn webgal:build
yarn dev            # Development: yarn parser:build && yarn webgal:dev

# Individual package builds
yarn parser:build          # Build parser (Rollup)
yarn parser:build-ci       # Build parser without cleanup
yarn webgal:build         # Build engine (Vite prod)
yarn webgal:dev           # Dev server (Vite dev mode, port 3000)

# Testing
yarn parser:test          # Run parser unit tests (Vitest)
yarn parser:test-coverage # Coverage report

# Navigation helpers
yarn webgal:dev           # cd packages/webgal && yarn dev
yarn webgal:build         # cd packages/webgal && yarn build
```

### Build Dependency Chain

```
Root build command
  └─> Parser build (Rollup)
       └─> TypeScript compilation
       └─> Output: build/es, build/cjs, build/umd
       └─> Type definitions in build/types
  └─> WebGAL build (Vite)
       └─> React compilation
       └─> Asset bundling
       └─> Output: packages/webgal/dist
```

### Key Build Details

**Parser (Rollup)**:
- Generates three output formats: ES Module, CommonJS, IIFE
- Source maps only in development
- Uses rollup-plugin-typescript2 for TS compilation
- Outputs to `build/` directory

**WebGAL (Vite)**:
- Development: Hot module replacement on port 3000
- Production: Optimized bundle with `--base=./` for relative imports
- Plugins:
  - React plugin
  - vite-plugin-package-version (injects version)
  - unplugin-info
  - vite-plugin-compression (gzip/brotli)
- Auto-generates `initRegister.ts` for pixi effects from files in `src/Core/gameScripts/pixi/performs/`

---

## Architecture Patterns

### 1. Singleton Pattern - WebGAL Core
```typescript
// WebGAL.ts - Exported singleton instances
export const WebGAL = new WebgalCore();
export const Live2D = new Live2DCore();

// Used throughout codebase with:
import { WebGAL } from '@/Core/WebGAL';
```

### 2. Redux for UI State
```typescript
// store/store.ts - Redux store combining:
- GUIReducer: UI component visibility (textbox, menu, etc.)
- stageReducer: Game stage state (animations, effects)
- userDataReducer: Player progress and variables
- savesReducer: Save slots
```

### 3. Parser-Engine Separation
- **Parser Package**: Converts text scripts to data structures
- **Engine Package**: Consumes parsed data to render and execute

**Data Flow**:
```
Script Text → SceneParser → IScene (interface with sentences, assets)
           → Engine State → React Render
```

### 4. Effect Registration Pattern
Pixi effects auto-register via module imports:
```typescript
// vite.config.ts watches gameScripts/pixi/performs/
// and auto-generates initRegister.ts with:
import '../../gameScripts/pixi/performs/cherryBlossoms';
import '../../gameScripts/pixi/performs/rain';
import '../../gameScripts/pixi/performs/snow';

// Each effect file registers itself on import
```

### 5. Event-Driven Architecture
```typescript
// Events via mitt library
WebGAL.events.fullscreenDbClick.emit();
WebGAL.events.fullscreenDbClick.on(() => { /* handler */ });
```

### 6. Asset Prefetching
- Assets declared in scripts are collected by parser
- `assetsPrefetcher()` callback preloads resources before commands execute
- Prevents stuttering during playback

---

## Development Workflow

### Quick Start
```bash
# Install dependencies
yarn install

# Start development server
yarn dev  # Builds parser, starts webgal dev server on port 3000

# Build for production
yarn build  # Complete build pipeline

# Run tests (parser only)
yarn parser:test
yarn parser:test-coverage
```

### Editor Synchronization
- WebSocket connection for hot-reload with WebGAL editor
- Implemented in `Core/util/syncWithEditor/webSocketFunc.ts`
- Enables real-time preview while editing

### Development Console
- `DevPanel` component provides in-game development tools
- Access variables, reload scenes, debug state

---

## CI/CD Configuration

### GitHub Workflows (`.github/workflows/`)

#### 1. PR Check (`pr-check.yml`)
- Trigger: Pull request opened or synchronized
- Steps:
  1. Checkout code
  2. Setup Node.js from package.json version
  3. Install dependencies (yarn)
  4. Run `yarn build` 
  5. Verify successful build

#### 2. Demo Page Deploy (`deploy-demo-page.yml`)
- Trigger: Push to main branch
- Steps:
  1. Build project (`yarn build`)
  2. Add `.nojekyll` file to dist
  3. Deploy to `live-demo-page` branch using GitHub Pages Action
  4. Live at: https://demo.openwebgal.com

#### 3. Release (`release.yml`)
- Trigger: Git tag push (format: `*.*`)
- Creates GitHub release draft with release notes from `releasenote.md`

### Build Cache
- Uses Yarn cache action for dependency caching
- Speeds up CI runs

---

## Key Technologies & Dependencies

### Core Technologies
- **React 17**: UI rendering
- **Redux Toolkit + React-Redux**: State management
- **Vite**: Development and build tooling
- **TypeScript 4.5+**: Type-safe development
- **Pixi.js 6.3**: WebGL 2D rendering
- **Sass**: CSS preprocessing

### Important Libraries
- **chevrotain 10.5**: Parser generator (used in parser package)
- **i18next + react-i18next**: Internationalization
- **axios 0.30+**: HTTP client (loading scenes, animations)
- **popmotion 11**: Animation library
- **cloudlogjs 1.0**: Logging (console + remote)
- **angular-expressions 1.4**: Expression evaluation (for variables)
- **mitt 3**: Event emitter (lightweight)
- **pixi-live2d-display-webgal**: Live2D character support

### Dev Dependencies
- **Rollup**: Parser bundle optimization
- **ESLint + Prettier**: Code quality
- **Vitest**: Unit testing
- **tsx**: TypeScript execution for debug scripts

---

## Important Code Patterns & Conventions

### Script Commands
All game commands defined in `packages/parser/src/config/scriptConfig.ts`:
- Maps command strings to command types
- Defines which commands auto-advance to next line
- ~40 command types supported

### Scene Parsing Process
1. **Text Preprocessing**: Multiline sequences collapsed into single lines
2. **Line Splitting**: Each line becomes potential instruction
3. **Command Parsing**: Command + arguments extracted
4. **Asset Scanning**: Resources collected for prefetching
5. **Output**: IScene interface with sentences, assets, subscenes

### Game Execution Flow
```
initializeScript()
  → Load game config
  → Load start.txt scene
  → Parse scene
  → Initialize Redux store
  → Start Pixi renderer
  → Bind hotkeys
  → Ready for interaction
```

### Asset Resolution
- Files resolved through `assetSetter()` in core utilities
- Supports multiple file types (image, audio, scene, etc.)
- Relative paths converted to absolute URLs

---

## State Management

### Redux Structure
```typescript
RootState {
  stage: IStageState           // Current game state
  GUI: IGuiState               // UI visibility toggles
  userData: IUserDataState     // Player variables & progress
  saves: ISaveState            // Save slots
}
```

### Key State Properties
- **stage.currentScene**: Currently playing scene
- **stage.sentenceIndex**: Current position in scene
- **GUI.showTextBox**: Textbox visibility
- **userData.vars**: Player variables (setVar values)
- **userData.backlog**: Dialog history
- **saves.saveSlots**: Saved games

---

## Testing

### Parser Unit Tests (Vitest)
- Located in `packages/parser/test/`
- Coverage tracking available
- Tests parsing logic for all command types

### Debug Tools
```bash
# Debug parser on a specific file
cd packages/parser && yarn debug

# Debug CSS parser
cd packages/parser && yarn debug-scss-parser

# Debug linebreak handling
cd packages/parser && yarn debug-linebreak-parser
```

---

## Configuration Files

### Root Level
- `.editorconfig`: Editor configuration
- `.gitignore`: Git exclusions
- `CONTRIBUTING.md`: Contribution guidelines (links to online docs)
- `FRONTEND_MIGRATION_STRATEGY.md`: Notes on next.js migration planning

### Package Level
- `packages/webgal/tsconfig.json`: React project TypeScript config
- `packages/webgal/vite.config.ts`: Vite configuration with auto pixi effect registration
- `packages/parser/rollup.config.js`: Parser bundle configuration
- `packages/parser/tsconfig.json`: Parser TypeScript config

### Build Outputs
- `packages/webgal/dist/`: Static game bundle (index.html + assets)
- `packages/parser/build/`: Three formats (es/, cjs/, umd/)

---

## Common Development Tasks

### Add a New Game Command
1. Add command to `packages/parser/src/config/scriptConfig.ts`
2. Create handler in `packages/webgal/src/Core/gameScripts/`
3. Export handler if needed by Redux
4. Update command type enum if necessary

### Add a New Pixi Effect
1. Create file: `packages/webgal/src/Core/gameScripts/pixi/performs/myEffect.ts`
2. Register in class/export on module load
3. Vite auto-injects to `initRegister.ts`
4. Use in scripts: `pixiPerform: myEffect|arg1|arg2;`

### Modify UI Components
1. Edit `.tsx` files in `packages/webgal/src/UI/`
2. Connect to Redux store if state needed
3. Vite HMR updates automatically during dev
4. Import styles from `.module.scss` for scoping

### Debug in Game
- Open DevPanel (accessible during game)
- View current scene data
- Inspect Redux state
- Check loaded assets

### Deploy to Production
```bash
yarn build              # Full build
# Output: packages/webgal/dist/
# Deploy this directory to web server
```

---

## Important Notes & Gotchas

1. **Yarn Workspaces**: Must run scripts from root or use `cd packages/XXX` before package-specific commands
2. **Parser Must Build First**: Engine depends on parser output; always build parser before webgal
3. **Pixi Effects Auto-Registration**: Don't manually edit `initRegister.ts` - it's auto-generated by Vite
4. **Asset Paths**: Relative to `/game/` folder in deployed game, not repository root
5. **i18n Strings**: Add new strings in `packages/webgal/src/translations/` for multi-language support
6. **iOS Orientation**: Landscape only - detected and alerted in initialization
7. **Version Injection**: Version automatically injected at build time via vite-plugin-package-version

---

## External Resources

- **Official Documentation**: https://docs.openwebgal.com/
- **Developer Guide**: https://docs.openwebgal.com/developers/
- **Discord Community**: https://discord.gg/kPrQkJttJy
- **Live Demo**: https://demo.openwebgal.com/
- **GitHub Repository**: https://github.com/OpenWebGAL/WebGAL

---

## Quick Reference

### Most Important Files for Common Tasks
- Game logic: `/packages/webgal/src/Core/gameScripts/`
- UI components: `/packages/webgal/src/UI/`
- Redux state: `/packages/webgal/src/store/`
- Parser commands: `/packages/parser/src/config/scriptConfig.ts`
- Build config: `/packages/webgal/vite.config.ts`
- Entry points: `/packages/webgal/src/main.tsx` (React), `/packages/webgal/src/App.tsx` (Root component)

