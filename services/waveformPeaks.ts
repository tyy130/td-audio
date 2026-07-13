const PEAK_SAMPLES = 180;
const waveformCache = new Map<string, WaveformAnalysis>();

const normalizePeaks = (values: number[]) => {
  const max = Math.max(...values, 0.0001);
  return values.map((value) => {
    const normalized = value / max;
    return Number(Math.max(0.02, Math.sqrt(normalized)).toFixed(4));
  });
};

export interface WaveformAnalysis {
  duration: number;
  peaks?: number[];
}

const analyzeWaveformBlob = async (blob: Blob): Promise<WaveformAnalysis> => {
  const context = new AudioContext();

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    const channelCount = audioBuffer.numberOfChannels;
    const sampleCount = Math.min(PEAK_SAMPLES, Math.max(24, Math.floor(audioBuffer.length / 1024)));
    const blockSize = Math.max(1, Math.floor(audioBuffer.length / sampleCount));
    const channels = Array.from({ length: channelCount }, (_, index) => audioBuffer.getChannelData(index));
    const rawPeaks = Array.from({ length: sampleCount }, (_, peakIndex) => {
      const start = peakIndex * blockSize;
      const end = peakIndex === sampleCount - 1 ? audioBuffer.length : Math.min(audioBuffer.length, start + blockSize);
      let peak = 0;

      for (let cursor = start; cursor < end; cursor += 1) {
        let value = 0;
        for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
          value += Math.abs(channels[channelIndex][cursor] || 0);
        }
        peak = Math.max(peak, value / channelCount);
      }

      return peak;
    });

    return {
      duration: audioBuffer.duration,
      peaks: normalizePeaks(rawPeaks),
    };
  } catch (error) {
    console.warn('Unable to extract waveform peaks', error);
    return { duration: 0 };
  } finally {
    await context.close().catch(() => {});
  }
};

export const extractWaveformPeaks = async (file: File): Promise<WaveformAnalysis> => {
  return analyzeWaveformBlob(file);
};

export const extractWaveformPeaksFromUrl = async (url: string): Promise<WaveformAnalysis> => {
  if (waveformCache.has(url)) {
    return waveformCache.get(url) as WaveformAnalysis;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unable to fetch audio for waveform (${response.status})`);
    }

    const blob = await response.blob();
    const analysis = await analyzeWaveformBlob(blob);
    waveformCache.set(url, analysis);
    return analysis;
  } catch (error) {
    console.warn('Unable to extract waveform peaks from URL', error);
    return { duration: 0 };
  }
};
