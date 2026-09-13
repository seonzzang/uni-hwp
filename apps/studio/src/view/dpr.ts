import type { PageInfo } from '@/core/types';

export const MAX_CANVAS_PIXELS = 67_108_864;

/** Resolves a device pixel ratio without coupling rendering to browser globals. */
export function calculateCanvasDpr(
  page: Pick<PageInfo, 'width' | 'height'>,
  zoom: number,
  requestedDpr: number,
  maxPixels = MAX_CANVAS_PIXELS,
): number {
  const dpr = Math.max(1, requestedDpr || 1);
  const logicalPixels = page.width * zoom * page.height * zoom;
  if (logicalPixels <= 0 || logicalPixels * dpr * dpr <= maxPixels) return dpr;
  return Math.max(1, Math.floor(Math.sqrt(maxPixels / logicalPixels)));
}

export function getPhysicalCanvasSize(
  page: Pick<PageInfo, 'width' | 'height'>,
  zoom: number,
  dpr: number,
): { width: number; height: number } {
  return {
    width: Math.ceil(page.width * zoom * dpr),
    height: Math.ceil(page.height * zoom * dpr),
  };
}
