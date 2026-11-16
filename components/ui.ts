import type React from "react";
import { DEFAULT_COVER } from "../constants";

/** Shared keyboard focus ring for every interactive element. */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export const formatTime = (time: number) => {
  if (!Number.isFinite(time) || time < 0) return "0:00";
  const min = Math.floor(time / 60);
  const sec = Math.floor(time % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
};

export const pad = (n: number) => String(n).padStart(2, "0");

/** Swap a broken cover image for the placeholder, once. */
export const onCoverError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  img.onerror = null;
  if (img.src !== DEFAULT_COVER) img.src = DEFAULT_COVER;
};
