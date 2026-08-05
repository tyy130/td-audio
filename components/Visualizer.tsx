import React from "react";
import { clsx } from "clsx";

interface VisualizerProps {
  isPlaying: boolean;
  waveformData: number[];
  progress: number;
}

const Visualizer: React.FC<VisualizerProps> = ({
  isPlaying,
  waveformData,
  progress,
}) => {
  return (
    <div className="flex h-14 w-full items-end gap-[2px]" aria-hidden="true">
      {waveformData.map((value, i) => {
        const active =
          progress > 0 ? i / waveformData.length <= progress : false;
        return (
          <div
            key={i}
            className={clsx(
              "flex-1 transition-all ease-in-out",
              active ? "bg-acid" : "bg-dim/40",
              isPlaying ? "opacity-90" : "opacity-40",
            )}
            style={{
              height: `${Math.max(4, Math.round(value * 52))}px`,
            }}
          />
        );
      })}
    </div>
  );
};

export default Visualizer;
