import React from 'react';

/**
 * client/src/utils/lazyWithRetry.js
 * 
 * Resilient dynamic component loader that catches chunk loading errors
 * (e.g., 'TypeError: Importing a module script failed' or 'Failed to fetch dynamically imported module')
 * which occur when deployment hashes change or during transient network interruptions.
 * 
 * Automatically triggers a single fresh browser reload to fetch updated asset manifests.
 */
export function lazyWithRetry(componentImport) {
  return React.lazy(async () => {
    const pageHasBeenForceRefreshed = Boolean(
      window.sessionStorage.getItem('campussphere_chunk_retry') === 'true'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.removeItem('campussphere_chunk_retry');
      return component;
    } catch (error) {
      const errorMessage = error?.message || '';
      const isChunkError =
        error?.name === 'ChunkLoadError' ||
        errorMessage.includes('Importing a module script failed') ||
        errorMessage.includes('Failed to fetch dynamically imported module') ||
        errorMessage.includes('error loading dynamically imported module');

      if (isChunkError && !pageHasBeenForceRefreshed) {
        window.sessionStorage.setItem('campussphere_chunk_retry', 'true');
        console.warn('[CampusSphere] Chunk fetch failure detected. Reloading application with latest manifests...', error);
        window.location.reload();
        return new Promise(() => {}); // Hang promise while browser reloads
      }

      console.error('[CampusSphere] Fatal module import failure:', error);
      throw error;
    }
  });
}

export default lazyWithRetry;

