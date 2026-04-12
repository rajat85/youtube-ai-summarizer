// utils/caption-extractor.js
// Extracts captions from YouTube videos

class CaptionExtractor {
  /**
   * Extract captions for a video
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<string|null>} Transcript text or null
   */
  static async extract(videoId) {
    try {
      // Method 1: Try ytInitialPlayerResponse
      const transcript = await this.extractFromPlayerResponse();
      if (transcript) return transcript;

      // Method 2: Try timedtext API
      return await this.extractFromTimedtext(videoId);
    } catch (error) {
      console.error('Error extracting captions:', error);
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
        return null;
      }

      const playerResponse = window.ytInitialPlayerResponse;
      const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (!captionTracks || captionTracks.length === 0) {
        return null;
      }

      // Find English captions (prefer manual over auto-generated)
      const englishTrack = captionTracks.find(track =>
        (track.languageCode === 'en' || track.languageCode.startsWith('en-')) &&
        track.kind !== 'asr'
      ) || captionTracks.find(track =>
        track.languageCode === 'en' || track.languageCode.startsWith('en-')
      );

      if (!englishTrack) {
        return null;
      }

      // Fetch caption data
      const response = await fetch(englishTrack.baseUrl);
      if (!response.ok) return null;
      const xmlText = await response.text();

      return this.parseXml(xmlText);
    } catch (error) {
      console.error('Error extracting from player response:', error);
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
      const response = await fetch(url);

      if (!response.ok) return null;

      const data = await response.json();
      return this.parseJson3(data);
    } catch (error) {
      console.error('Error extracting from timedtext:', error);
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
