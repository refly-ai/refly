/**
 * Type declarations for fish-audio.cjs wrapper
 * Provides async loader for the fish-audio ESM module
 */
import type * as FishAudio from 'fish-audio';

export function loadFishAudio(): Promise<typeof FishAudio>;
export default loadFishAudio;

// Re-export types for convenience
export type {
  FishAudioClient,
  TTSRequest,
  STTRequest,
  ReferenceAudio,
  STTResponse,
} from 'fish-audio';
