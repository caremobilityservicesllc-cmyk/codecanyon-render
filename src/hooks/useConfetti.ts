import { useCallback } from 'react';
import confetti from 'canvas-confetti';

export function useConfetti() {
  const fireConfetti = useCallback(() => {
    // Fire multiple bursts for a more celebratory effect
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    // Initial burst
    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      colors: ['#149073', '#10b981', '#34d399'],
    });

    fire(0.2, {
      spread: 60,
      colors: ['#149073', '#10b981', '#34d399'],
    });

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
      colors: ['#149073', '#10b981', '#34d399', '#fbbf24', '#f59e0b'],
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
      colors: ['#149073', '#10b981', '#34d399'],
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
      colors: ['#149073', '#10b981', '#34d399', '#fbbf24'],
    });
  }, []);

  const fireStars = useCallback(() => {
    const defaults = {
      spread: 360,
      ticks: 50,
      gravity: 0,
      decay: 0.94,
      startVelocity: 30,
      shapes: ['star'] as confetti.Shape[],
      colors: ['#149073', '#10b981', '#34d399', '#fbbf24', '#f59e0b'],
      zIndex: 9999,
    };

    function shoot() {
      confetti({
        ...defaults,
        particleCount: 40,
        scalar: 1.2,
        shapes: ['star'] as confetti.Shape[],
      });

      confetti({
        ...defaults,
        particleCount: 10,
        scalar: 0.75,
        shapes: ['circle'] as confetti.Shape[],
      });
    }

    setTimeout(shoot, 0);
    setTimeout(shoot, 100);
    setTimeout(shoot, 200);
  }, []);

  const fireCelebration = useCallback(() => {
    fireConfetti();
    setTimeout(fireStars, 300);
  }, [fireConfetti, fireStars]);

  return { fireConfetti, fireStars, fireCelebration };
}
