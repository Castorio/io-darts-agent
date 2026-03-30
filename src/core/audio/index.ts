/**
 * Audio Services
 *
 * Re-exports audio services from darts-caller module
 */

export {
  LocalAudioPlayer,
} from '../../../modules/darts-caller/src/index.js';

export type {
  LocalAudioPlayerConfig,
} from '../../../modules/darts-caller/src/index.js';

// Factory function for backward compatibility
import { LocalAudioPlayer } from '../../../modules/darts-caller/src/index.js';
import type { LocalAudioPlayerConfig } from '../../../modules/darts-caller/src/index.js';
export function createLocalAudioPlayer(config?: LocalAudioPlayerConfig): LocalAudioPlayer {
  return new LocalAudioPlayer(config || {});
}
