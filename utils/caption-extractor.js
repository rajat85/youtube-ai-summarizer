// utils/caption-extractor.js
// Extracts captions from YouTube videos

class CaptionExtractor {
  /**
   * Wait for ytInitialPlayerResponse to be available
   * @param {number} timeout - Max wait time in ms
   * @returns {Promise<boolean>}
   */
  static async waitForPlayerResponse(timeout = 10000) {
    const startTime = Date.now();
    let lastCheck = 'Not started';
    
    while (Date.now() - startTime < timeout) {
      // Check if ytInitialPlayerResponse exists in page scripts
      const scripts = Array.from(document.querySelectorAll('script'));
      const hasPlayerResponse = scripts.some(s => (s.textContent || '').includes('var ytInitialPlayerResponse'));
      
      if (!hasPlayerResponse) {
        lastCheck = 'ytInitialPlayerResponse does not exist in page scripts';
        await new Promise(resolve => setTimeout(resolve, 200));
        continue;
      }
      
      // Try to parse it to check for captions
      let hasCaptions = false;
      for (const script of scripts) {
        const content = script.textContent || '';
        if (content.includes('var ytInitialPlayerResponse')) {
          try {
            const match = content.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/s);
            if (match && match[1]) {
              const data = JSON.parse(match[1]);
              hasCaptions = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }
      if (hasCaptions && hasCaptions.length > 0) {
        console.log('[CaptionExtractor] ytInitialPlayerResponse is ready with captions');
        return true;
      }
      
      lastCheck = 'Has videoDetails but no captions yet';
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('[CaptionExtractor] Timeout waiting for ytInitialPlayerResponse. Last check:', lastCheck);
    const scripts = Array.from(document.querySelectorAll('script'));
    const scriptWithData = scripts.find(s => (s.textContent || '').includes('var ytInitialPlayerResponse'));
    console.log('[CaptionExtractor] Current state:', {
      scriptsChecked: scripts.length,
      foundInScripts: !!scriptWithData,
      lastCheckStatus: lastCheck
    });
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
      // Content scripts can't access page variables directly
      // Need to extract from script tags in the page
      let playerResponse = null;
      
      // Try to get from script tags
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const content = script.textContent || '';
        
        // Look for ytInitialPlayerResponse in script content
        if (content.includes('var ytInitialPlayerResponse =')) {
          try {
            // Extract the JSON object
            const match = content.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/s);
            if (match && match[1]) {
              playerResponse = JSON.parse(match[1]);
              console.log('[CaptionExtractor] Extracted ytInitialPlayerResponse from script tag');
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }
      
      if (!playerResponse) {
        console.log('[CaptionExtractor] ytInitialPlayerResponse not found in page scripts');
        return null;
      }
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
