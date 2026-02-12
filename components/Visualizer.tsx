import React from 'react';
import { clsx } from 'clsx';

interface VisualizerProps {
  isPlaying: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ isPlaying }) => {
  // Generate a symmetric pattern of heights
  const bars = 32;
  
  return (
    <div className="flex items-center justify-center gap-[2px] h-16 w-full max-w-xs mx-auto opacity-60">
      {[...Array(bars)].map((_, i) => {
        // Calculate delay for a wave effect from center outwards or linear
        // Let's do a symmetric wave from center
        const center = bars / 2;
        const dist = Math.abs(i - center);
        const delay = dist * 0.05; 
        
        return (
          <div
            key={i}
            className={clsx(
              "w-1 bg-indigo-500 rounded-full transition-all ease-in-out",
              isPlaying ? "animate-music-bar" : "h-1 opacity-20"
            )}
            style={{
              animationDuration: `${0.8 + (i % 3) * 0.1}s`,
              animationDelay: `-${delay}s`,
              height: isPlaying ? undefined : '4px'
            }}
          />
        );
      })}
    </div>
  );
};

export default Visualizer;