/**
 * Animation Generator Types
 * For AI-generated animations with transparent backgrounds
 */

/**
 * Dart event types that can trigger animations
 */
export type DartEventType =
  | '180'
  | '171'
  | '170'
  | '160+'
  | 'bull'
  | 'double-bull'
  | 'checkout'
  | 'high-checkout'
  | 'bust'
  | 'leg-won'
  | 'match-won'
  | 'hat-trick'
  | 'ton-plus';

/**
 * All available dart event types
 */
export const DART_EVENT_TYPES: DartEventType[] = [
  '180',
  '171',
  '170',
  '160+',
  'bull',
  'double-bull',
  'checkout',
  'high-checkout',
  'bust',
  'leg-won',
  'match-won',
  'hat-trick',
  'ton-plus',
];

/**
 * Animation style definition
 */
export interface AnimationStyle {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Base prompt for AI generation */
  prompt: string;
  /** Optional preview image URL */
  previewUrl?: string;
  /** Style category */
  category?: 'celebration' | 'effect' | 'minimal' | 'custom';
  /** Color palette hints */
  colors?: string[];
}

/**
 * Animation job status
 */
export type AnimationJobStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Animation generation job
 */
export interface AnimationJob {
  /** Unique job ID */
  id: string;
  /** Current status */
  status: AnimationJobStatus;
  /** Target event type */
  eventType: DartEventType;
  /** Style used for generation */
  style: AnimationStyle;
  /** Custom prompt override (if any) */
  customPrompt?: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Result URL when completed */
  resultUrl?: string;
  /** Result filename */
  resultFilename?: string;
  /** Error message if failed */
  error?: string;
  /** External provider job ID */
  providerJobId?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Start processing timestamp */
  startedAt?: Date;
  /** Completion timestamp */
  completedAt?: Date;
}

/**
 * Animation generation options
 */
export interface AnimationGenerationOptions {
  /** Duration in seconds (default: 5) */
  duration?: number;
  /** Width in pixels (default: 512) */
  width?: number;
  /** Height in pixels (default: 512) */
  height?: number;
  /** Whether to include transparency (default: true) */
  transparent?: boolean;
  /** Output format */
  format?: 'webm' | 'gif' | 'mp4';
  /** Quality/style emphasis */
  quality?: 'fast' | 'balanced' | 'quality';
  /** Color palette for base image generation */
  colors?: string[];
}

/**
 * Batch generation request
 */
export interface BatchGenerationRequest {
  /** Style to use */
  style: AnimationStyle;
  /** Event types to generate (default: all) */
  eventTypes?: DartEventType[];
  /** Generation options */
  options?: AnimationGenerationOptions;
}

/**
 * Single generation request
 */
export interface SingleGenerationRequest {
  /** Event type */
  eventType: DartEventType;
  /** Style to use */
  style: AnimationStyle;
  /** Custom prompt override */
  customPrompt?: string;
  /** Generation options */
  options?: AnimationGenerationOptions;
}

/**
 * Provider generation result
 */
export interface ProviderGenerationResult {
  /** Whether generation succeeded */
  success: boolean;
  /** Provider job ID for polling */
  jobId?: string;
  /** Direct result URL (if immediately available) */
  resultUrl?: string;
  /** Error message */
  error?: string;
}

/**
 * Provider job status result
 */
export interface ProviderJobStatus {
  /** Current status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Progress percentage */
  progress: number;
  /** Result URL when completed */
  resultUrl?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Event prompt templates
 */
export const EVENT_PROMPT_TEMPLATES: Record<DartEventType, string> = {
  '180': 'Perfect score celebration, maximum points, triumphant explosion',
  '171': 'Amazing high score, impressive achievement, dynamic burst',
  '170': 'Perfect checkout possible, exciting moment, energetic flash',
  '160+': 'High score achievement, impressive throw, powerful impact',
  'bull': 'Bullseye hit, center target, precise impact',
  'double-bull': 'Double bullseye, perfect center, ultimate precision',
  'checkout': 'Game winning throw, victory moment, finishing strike',
  'high-checkout': 'High score finish, impressive checkout, skillful ending',
  'bust': 'Over score, reset moment, dramatic effect',
  'leg-won': 'Leg victory, partial win, celebratory moment',
  'match-won': 'Match victory, ultimate champion, grand celebration',
  'hat-trick': 'Three bullseyes, perfect precision, triple impact',
  'ton-plus': 'Score over 100, solid performance, strong impact',
};
