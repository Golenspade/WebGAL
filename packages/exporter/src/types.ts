/**
 * WebGAL Video Exporter - Type Definitions
 */

export interface ExportConfig {
  /** Scene file path to export */
  scenePath: string;
  /** Output video file path */
  outputPath: string;
  /** Video resolution */
  resolution: {
    width: number;
    height: number;
  };
  /** Frame rate (fps) */
  frameRate: number;
  /** Text speed override (1-10, higher = faster) */
  textSpeed?: number;
  /** Auto mode speed (ms per sentence) */
  autoSpeed?: number;
  /** Video codec (prores, h264, etc.) */
  codec: 'prores' | 'h264' | 'vp9';
  /** Video quality (for h264/vp9) */
  quality?: number;
  /** Deterministic input script for branches */
  branchScript?: BranchScript;
  /** WebGAL dev server URL */
  webgalUrl?: string;
  /** Temporary directory for frames */
  tempDir?: string;
  /** Enable verbose logging */
  verbose?: boolean;
}

export interface BranchScript {
  /** Map of choice index to selected option */
  choices: Record<number, number>;
  /** Map of input prompt to user input */
  inputs: Record<string, string>;
}

export interface TimelineEvent {
  /** Event type */
  type: 'perform' | 'bgm' | 'vocal' | 'se' | 'scene_start' | 'scene_end';
  /** Start time in milliseconds */
  startTime: number;
  /** Duration in milliseconds */
  duration: number;
  /** Event-specific data */
  data: PerformData | AudioData | SceneData;
}

export interface PerformData {
  /** Perform name/ID */
  performName: string;
  /** Command type */
  commandType: string;
  /** Whether it blocks next */
  blockingNext: boolean;
  /** Whether it blocks auto mode */
  blockingAuto: boolean;
  /** Go to next when over */
  goNextWhenOver?: boolean;
  /** Sentence content */
  content?: string;
}

export interface AudioData {
  /** Audio type */
  audioType: 'bgm' | 'vocal' | 'se';
  /** Asset URL */
  url: string;
  /** Volume (0-100) */
  volume: number;
  /** Whether to loop */
  loop?: boolean;
  /** Fade in duration (ms) */
  fadeIn?: number;
  /** Fade out duration (ms) */
  fadeOut?: number;
}

export interface SceneData {
  /** Scene name */
  sceneName: string;
  /** Scene file path */
  scenePath: string;
}

export interface CaptureFrame {
  /** Frame number */
  frameNumber: number;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Frame image data (PNG base64) */
  imageData: string;
  /** Frame file path */
  filePath?: string;
}

export interface AudioTrack {
  /** Track type */
  type: 'bgm' | 'vocal' | 'se';
  /** Audio file path */
  filePath: string;
  /** Start time in seconds */
  startTime: number;
  /** Duration in seconds */
  duration: number;
  /** Volume (0-1) */
  volume: number;
  /** Fade in duration in seconds */
  fadeIn?: number;
  /** Fade out duration in seconds */
  fadeOut?: number;
  /** Whether to loop */
  loop?: boolean;
  /** Loop end time in seconds (for trimming) */
  loopEndTime?: number;
}

export interface ExportProgress {
  /** Current phase */
  phase: 'init' | 'capture' | 'audio' | 'encode' | 'done' | 'error';
  /** Progress percentage (0-100) */
  progress: number;
  /** Current frame (for capture phase) */
  currentFrame?: number;
  /** Total frames */
  totalFrames?: number;
  /** Status message */
  message: string;
  /** Error if any */
  error?: Error;
}

export interface ExportResult {
  /** Success status */
  success: boolean;
  /** Output file path */
  outputPath?: string;
  /** Timeline data path */
  timelinePath?: string;
  /** Total duration in seconds */
  duration?: number;
  /** Total frames captured */
  totalFrames?: number;
  /** Error if any */
  error?: Error;
}
