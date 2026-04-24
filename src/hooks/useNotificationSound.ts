// Simple notification sound using audio file
let audioElement: HTMLAudioElement | null = null;

export function playNotificationSound() {
  try {
    // Create or reuse audio element
    if (!audioElement) {
      audioElement = new Audio('/sounds/notification.mp3');
      audioElement.volume = 0.5;
    }
    
    // Reset and play
    audioElement.currentTime = 0;
    audioElement.play().catch((error) => {
      // Silently fail - audio may be blocked by browser autoplay policy
      console.debug('Could not play notification sound:', error);
    });
  } catch (error) {
    console.debug('Could not play notification sound:', error);
  }
}

// Preload the audio file for faster playback
export function preloadNotificationSound() {
  if (!audioElement) {
    audioElement = new Audio('/sounds/notification.mp3');
    audioElement.volume = 0.5;
    audioElement.load();
  }
}
