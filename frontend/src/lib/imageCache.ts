import { getImageUrl } from '@/lib/api';

/**
 * In-memory set to track which URLs have been preloaded this session.
 * Prevents duplicate preload attempts.
 */
const preloadedUrls = new Set<string>();

/**
 * Preload a batch of image URLs using Image() objects.
 * Browser will cache them in memory/disk; subsequent <img> renders are instant.
 * 
 * @param urls Array of image URLs to preload
 * @param batchSize Number of concurrent preloads (default 15)
 */
export async function preloadImages(
  urls: string[],
  batchSize = 15
): Promise<void> {
  // Filter out already preloaded and empty URLs
  const toLoad = urls.filter((url) => url && !preloadedUrls.has(url));
  if (toLoad.length === 0) return;

  // Process in batches to avoid overwhelming the browser
  for (let i = 0; i < toLoad.length; i += batchSize) {
    const batch = toLoad.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(
        (url) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              preloadedUrls.add(url);
              resolve();
            };
            img.onerror = () => {
              preloadedUrls.add(url); // Don't retry failed images
              resolve();
            };
            img.src = url;
          })
      )
    );
  }
}

/**
 * Extract photo URLs from player objects and preload them all.
 * Call this after fetching player data from the API.
 */
export function prefetchPlayerImages(
  players: Array<{ photo?: string | null }>
): void {
  const urls = players
    .map((p) => (p.photo ? getImageUrl(p.photo) : ''))
    .filter(Boolean);
  
  // Use requestIdleCallback if available to avoid blocking the main thread
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
      preloadImages(urls);
    });
  } else {
    // Fallback: use setTimeout to defer
    setTimeout(() => preloadImages(urls), 100);
  }
}

/**
 * Preload team logo images
 */
export function prefetchTeamImages(
  teams: Array<{ logo?: string | null }>
): void {
  const urls = teams
    .map((t) => (t.logo ? getImageUrl(t.logo) : ''))
    .filter(Boolean);
  
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
      preloadImages(urls);
    });
  } else {
    setTimeout(() => preloadImages(urls), 200);
  }
}
