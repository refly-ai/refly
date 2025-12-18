// Global audio manager to ensure only one audio plays at a time
class AudioManager {
  private currentAudio: HTMLAudioElement | null = null;
  private audioInstances = new Set<HTMLAudioElement>();

  /**
   * Register an audio element
   * @param audioElement - The audio element to register
   * @returns Unregister function
   */
  register(audioElement: HTMLAudioElement): () => void {
    this.audioInstances.add(audioElement);

    // Listen for play event to stop other audios
    const handlePlay = () => {
      this.stopAllExcept(audioElement);
      this.currentAudio = audioElement;
    };

    // Listen for pause/end events to clear current audio
    const handlePause = () => {
      if (this.currentAudio === audioElement) {
        this.currentAudio = null;
      }
    };

    const handleEnded = () => {
      if (this.currentAudio === audioElement) {
        this.currentAudio = null;
      }
    };

    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handleEnded);

    // Return unregister function
    return () => {
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('ended', handleEnded);
      this.audioInstances.delete(audioElement);
      if (this.currentAudio === audioElement) {
        this.currentAudio = null;
      }
    };
  }

  /**
   * Stop all audio except the specified one
   * @param exceptAudio - Audio element to keep playing
   */
  private stopAllExcept(exceptAudio: HTMLAudioElement): void {
    for (const audio of this.audioInstances) {
      if (audio !== exceptAudio && !audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
  }

  /**
   * Stop all playing audios
   */
  stopAll(): void {
    for (const audio of this.audioInstances) {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
    this.currentAudio = null;
  }
}

// Export singleton instance
export const audioManager = new AudioManager();
