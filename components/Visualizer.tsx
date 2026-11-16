import React, { useEffect, useRef } from "react";

const BAR_COUNT = 32;
const IDLE_LEVEL = 0.08;

interface VisualizerProps {
  isPlaying: boolean;
  progress: number;
  /** Fills the array with bar levels (0..1). Supplied by useAudio. */
  readLevels: (out: number[]) => void;
}

/**
 * Level bars driven by their own requestAnimationFrame loop. Heights are
 * written straight to the DOM so the rest of the player does not re-render
 * on every frame, and the loop stops on its own when the tab is hidden.
 */
const Visualizer: React.FC<VisualizerProps> = ({
  isPlaying,
  progress,
  readLevels,
}) => {
  const barsRef = useRef<Array<HTMLDivElement | null>>([]);
  const levelsRef = useRef<number[]>(Array(BAR_COUNT).fill(IDLE_LEVEL));

  useEffect(() => {
    const paint = () => {
      const levels = levelsRef.current;
      barsRef.current.forEach((bar, index) => {
        if (bar) bar.style.transform = `scaleY(${levels[index]})`;
      });
    };

    if (!isPlaying) {
      levelsRef.current.fill(IDLE_LEVEL);
      paint();
      return;
    }

    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      // Reduced motion: refresh a few times a second instead of every frame.
      if (!reduceMotion || now - last > 250) {
        readLevels(levelsRef.current);
        paint();
        last = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, readLevels]);

  const activeBars = Math.floor(progress * BAR_COUNT);

  return (
    <div
      className="flex h-10 w-full items-end gap-[2px] sm:h-14 md:h-10 xl:h-14"
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
          className={`h-full flex-1 origin-bottom transition-transform duration-100 ease-out ${
            progress > 0 && i <= activeBars ? "bg-acid" : "bg-dim/40"
          } ${isPlaying ? "opacity-90" : "opacity-40"}`}
          style={{ transform: `scaleY(${IDLE_LEVEL})` }}
        />
      ))}
    </div>
  );
};

export default React.memo(Visualizer);
