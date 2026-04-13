// utils/caption-extractor.js
// Extracts captions from YouTube videos

class CaptionExtractor {
  /**
   * Wait for ytInitialPlayerResponse to be available
   * @param {number} timeout - Max wait time in ms
   * @returns {Promise<boolean>}
   */
  static async waitForPlayerResponse(timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (window.ytInitialPlayerResponse && 
          window.ytInitialPlayerResponse.videoDetails) {
        console.log('[CaptionExtractor] ytInitialPlayerResponse is now available');
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('[CaptionExtractor] Timeout waiting for ytInitialPlayerResponse');
    return false;
  }

  /**
   * Extract captions for a video
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<string|null>} Transcript text or null
   */
  static async extract(videoId) {
    try {
      console.log('[CaptionExtractor] Starting extraction for video:', videoId);
      
      // Wait for ytInitialPlayerResponse to be available
      await this.waitForPlayerResponse();
      
      // Method 1: Try ytInitialPlayerResponse
      const transcript = await this.extractFromPlayerResponse();
      if (transcript) {
        console.log('[CaptionExtractor] Successfully extracted from player response, length:', transcript.length);
        return transcript;
      }
      
      console.log('[CaptionExtractor] Player response failed, trying timedtext API');

      // Method 2: Try timedtext API
      const timedtextResult = await this.extractFromTimedtext(videoId);
      if (timedtextResult) {
        console.log('[CaptionExtractor] Successfully extracted from timedtext, length:', timedtextResult.length);
      } else {
        console.log('[CaptionExtractor] Timedtext API also failed - no captions available');
      }
      return timedtextResult;
    } catch (error) {
      console.error('[CaptionExtractor] Error extracting captions:', error);
      return null;
    }
  }

  /**
   * Extract from ytInitialPlayerResponse (embedded in page)
   * @returns {Promise<string|null>}
   */
  static async extractFromPlayerResponse() {
    try {
      // YouTube embeds player data in page
      if (typeof window === 'undefined' || typeof window.ytInitialPlayerResponse === 'undefined' || !window.ytInitialPlayerResponse) {
        console.log('[CaptionExtractor] ytInitialPlayerResponse not available');
        return null;
      }

      const playerResponse = window.ytInitialPlayerResponse;
      const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (!captionTracks || captionTracks.length === 0) {
        console.log('[CaptionExtractor] No caption tracks found in player response');
        return null;
      }

      console.log('[CaptionExtractor] Found', captionTracks.length, 'caption tracks:', 
                  captionTracks.map(t => `${t.languageCode} (${t.kind || 'manual'})`).join(', '));

      // Find English captions (prefer manual over auto-generated)
      const englishTrack = captionTracks.find(track =>
        (track.languageCode === 'en' || track.languageCode.startsWith('en-')) &&
        track.kind !== 'asr'
      ) || captionTracks.find(track =>
        track.languageCode === 'en' || track.languageCode.startsWith('en-')
      );

      if (!englishTrack) {
        console.log('[CaptionExtractor] No English caption track found');
        return null;
      }

      console.log('[CaptionExtractor] Using track:', englishTrack.languageCode, englishTrack.kind || 'manual');

      // Fetch caption data
      const response = await fetch(englishTrack.baseUrl);
      if (!response.ok) {
        console.log('[CaptionExtractor] Failed to fetch captions, status:', response.status);
        return null;
      }
      const xmlText = await response.text();

      return this.parseXml(xmlText);
    } catch (error) {
      console.error('[CaptionExtractor] Error extracting from player response:', error);
      return null;
    }
  }

  /**
   * Extract from timedtext API (fallback)
   * @param {string} videoId
   * @returns {Promise<string|null>}
   */
  static async extractFromTimedtext(videoId) {
    try {
      const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`;
      console.log('[CaptionExtractor] Fetching from timedtext API:', url);
      const response = await fetch(url);

      if (!response.ok) {
        console.log('[CaptionExtractor] Timedtext API failed, status:', response.status);
        return null;
      }

      const data = await response.json();
      return this.parseJson3(data);
    } catch (error) {
      console.error('[CaptionExtractor] Error extracting from timedtext:', error);
      return null;
    }
  }

  /**
   * Parse XML caption format
   * @param {string} xmlText
   * @returns {string}
   */
  static parseXml(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    // Check for parse errors
    const parseError = xmlDoc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      console.error('XML parsing error:', parseError[0].textContent);
      return '';
    }

    const textElements = xmlDoc.getElementsByTagName('text');

    const transcript = Array.from(textElements)
      .map(el => el.textContent)
      .join(' ');

    return this.cleanTranscript(transcript);
  }

  /**
   * Parse JSON3 caption format
   * @param {Object} data
   * @returns {string}
   */
  static parseJson3(data) {
    if (!data.events) return '';

    const transcript = data.events
      .filter(event => event.segs)
      .map(event => event.segs.map(seg => seg?.utf8 || '').filter(Boolean).join(''))
      .join(' ');

    return this.cleanTranscript(transcript);
  }

  /**
   * Clean transcript text
   * @param {string} text
   * @returns {string}
   */
  static cleanTranscript(text) {
    return text
      // Decode HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Remove common caption artifacts
      .replace(/\[Music\]/gi, '')
      .replace(/\[Applause\]/gi, '')
      .replace(/\[Laughter\]/gi, '')
      .replace(/\[.*?\]/g, '') // Remove any [bracketed] text
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract metadata when captions unavailable
   * @returns {Object}
   */
  static extractMetadata() {
    try {
      const title = document.querySelector('h1.ytd-video-primary-info-renderer, h1.title')?.textContent?.trim() || '';
      const description = document.querySelector('ytd-expander#description, #description')?.textContent?.trim() || '';
      const channelName = document.querySelector('ytd-channel-name, #channel-name')?.textContent?.trim() || '';

      // Extract top comments (optional, may not always be loaded)
      const comments = Array.from(document.querySelectorAll('#content-text'))
        .slice(0, 5)
        .map(el => el.textContent.trim())
        .filter(text => text.length > 0);

      return {
        title,
        description,
        channelName,
        comments
      };
    } catch (error) {
      console.error('Error extracting metadata:', error);
      return {
        title: '',
        description: '',
        channelName: '',
        comments: []
      };
    }
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.CaptionExtractor = CaptionExtractor;
}
