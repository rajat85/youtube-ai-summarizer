// utils/caption-fetch-helper.js
// This script runs in the page's main context to bypass CORS restrictions

(function() {
  window.addEventListener('message', async function(event) {
    // Only handle our messages
    if (event.source !== window) return;

    if (event.data.type === 'FETCH_CAPTIONS_REQUEST') {
      try {
        console.log('[CaptionFetchHelper] Fetching captions from page context:', event.data.url);
        const response = await fetch(event.data.url);
        const text = await response.text();

        window.postMessage({
          type: 'FETCH_CAPTIONS_RESPONSE',
          requestId: event.data.requestId,
          success: true,
          data: text
        }, '*');
      } catch (error) {
        window.postMessage({
          type: 'FETCH_CAPTIONS_RESPONSE',
          requestId: event.data.requestId,
          success: false,
          error: error.message
        }, '*');
      }
    }
  });

  // Signal that the helper is ready
  window.postMessage({ type: 'CAPTION_FETCHER_READY' }, '*');
})();
