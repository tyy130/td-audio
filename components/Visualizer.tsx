import React, { useEffect, useRef } from "react";
import { clsx } from "clsx";
import WaveSurfer from "wavesurfer.js";

interface VisualizerProps {
  isPlaying: boolean;
  waveformData: number[];
  peaks?: number[];
  duration: number;
  currentTime: number;
  progress: number;
  onSeek: (time: number) => void;
}

const Visualizer: React.FC<VisualizerProps> = ({
  isPlaying,
  waveformData,
  peaks,
  duration,
  currentTime,
  progress,
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (!containerRef.current || !peaks?.length || !duration) {
      waveSurferRef.current?.destroy();
      waveSurferRef.current = null;
      return;
    }

    const waveSurfer = WaveSurfer.create({
      container: containerRef.current,
      height: 56,
      peaks: [peaks],
      duration,
      waveColor: "rgba(138, 138, 133, 0.4)",
      progressColor: "#c3f53c",
      cursorWidth: 0,
      barWidth: 3,
      barGap: 2,
      barRadius: 0,
      barMinHeight: 2,
      normalize: true,
      dragToSeek: { debounceTime: 50 },
      interact: true,
      hideScrollbar: true,
    });

    waveSurfer.on("interaction", (time) => {
      onSeek(time);
    });

    waveSurferRef.current = waveSurfer;

    return () => {
      waveSurfer.destroy();
      waveSurferRef.current = null;
    };
  }, [duration, onSeek, peaks]);

  useEffect(() => {
    if (!waveSurferRef.current || !duration) return;
    const boundedTime = Math.max(0, Math.min(currentTime, duration));
    waveSurferRef.current.setTime(boundedTime);
  }, [currentTime, duration]);

  if (peaks?.length && duration) {
    return (
      <div
        ref={containerRef}
        className={clsx(
          "w-full overflow-hidden border border-line bg-panel px-3 py-2 transition-opacity",
          isPlaying ? "opacity-100" : "opacity-70",
        )}
      />
    );
  }

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
