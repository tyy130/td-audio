import React from 'react';
import { clsx } from 'clsx';

interface VisualizerProps {
  isPlaying: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ isPlaying }) => {
  return (
    <div className="flex items-end justify-center gap-1 h-12 w-full opacity-50">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className={clsx(
            "w-1.5 bg-indigo-500 rounded-t-sm transition-all duration-300 ease-in-out",
            isPlaying ? "animate-pulse" : "h-1"
          )}
          style={{
            height: isPlaying ? `${Math.random() * 100}%` : '4px',
            animationDuration: `${0.4 + Math.random() * 0.5}s`,
            animationDelay: `${Math.random() * 0.2}s`
          }}
        />
      ))}
    </div>
  );
};

export default Visualizer;