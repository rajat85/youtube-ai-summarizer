// utils/storage.js
// Manages chrome.storage for summaries and API key

class StorageManager {
  // Cache keys
  static SUMMARIES_KEY = 'summaries';
  static API_KEY = 'apiKey';
  static STATS_KEY = 'stats';

  // Cache settings
  static MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  static MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB threshold
  static CLEANUP_PERCENTAGE = 0.2; // Remove oldest 20%

  /**
   * Get cached summary for a video
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object|null>} Cached summary or null
   */
  static async getSummary(videoId) {
    try {
      const result = await chrome.storage.local.get(this.SUMMARIES_KEY);
      const summaries = result[this.SUMMARIES_KEY] || {};
      const cached = summaries[videoId];

      if (!cached) return null;

      // Check if expired
      const age = Date.now() - cached.timestamp;
      if (age > this.MAX_AGE_MS) {
        await this.removeSummary(videoId);
        return null;
      }

      // Track cache hit
      await this.updateStats('hit');

      return cached;
    } catch (error) {
      console.error('Error getting summary:', error);
      return null;
    }
  }

  /**
   * Save summary to cache
   * @param {string} videoId - YouTube video ID
   * @param {string} summary - Summary text
   * @param {Object} metadata - Additional metadata
   */
  static async setSummary(videoId, summary, metadata = {}) {
    try {
      const result = await chrome.storage.local.get(this.SUMMARIES_KEY);
      const summaries = result[this.SUMMARIES_KEY] || {};

      summaries[videoId] = {
        summary,
        timestamp: Date.now(),
        ...metadata
      };

      // Check storage size after adding new entry
      const estimatedSize = new Blob([JSON.stringify(summaries)]).size;
      if (estimatedSize > this.MAX_SIZE_BYTES) {
        await this.cleanup();
        // Re-get summaries after cleanup
        const cleanedResult = await chrome.storage.local.get(this.SUMMARIES_KEY);
        const cleanedSummaries = cleanedResult[this.SUMMARIES_KEY] || {};
        cleanedSummaries[videoId] = summaries[videoId];
        await chrome.storage.local.set({ [this.SUMMARIES_KEY]: cleanedSummaries });
      } else {
        await chrome.storage.local.set({ [this.SUMMARIES_KEY]: summaries });
      }

      await this.updateStats('set');
    } catch (error) {
      console.error('Error setting summary:', error);
      throw error;
    }
  }

  /**
   * Remove specific summary from cache
   * @param {string} videoId - YouTube video ID
   */
  static async removeSummary(videoId) {
    try {
      const result = await chrome.storage.local.get(this.SUMMARIES_KEY);
      const summaries = result[this.SUMMARIES_KEY] || {};
      delete summaries[videoId];
      await chrome.storage.local.set({ [this.SUMMARIES_KEY]: summaries });
    } catch (error) {
      console.error('Error removing summary:', error);
    }
  }

  /**
   * Clean up old summaries (remove oldest 20%)
   */
  static async cleanup() {
    try {
      const result = await chrome.storage.local.get(this.SUMMARIES_KEY);
      const summaries = result[this.SUMMARIES_KEY] || {};

      const entries = Object.entries(summaries);
      if (entries.length === 0) return;

      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Remove oldest 20% (minimum 1 if entries exist)
      const toRemove = Math.max(1, Math.floor(entries.length * this.CLEANUP_PERCENTAGE));
      const toKeep = entries.slice(toRemove);

      const cleanedSummaries = Object.fromEntries(toKeep);
      await chrome.storage.local.set({ [this.SUMMARIES_KEY]: cleanedSummaries });

      // Update stats with cleanup timestamp
      const statsResult = await chrome.storage.local.get(this.STATS_KEY);
      const stats = statsResult[this.STATS_KEY] || {
        totalSummaries: 0,
        cacheHits: 0,
        apiCalls: 0,
        lastCleanup: Date.now()
      };
      stats.lastCleanup = Date.now();
      await chrome.storage.local.set({ [this.STATS_KEY]: stats });

      console.log(`Cleaned up ${toRemove} old summaries`);
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Clear all cached summaries
   */
  static async clearAll() {
    try {
      await chrome.storage.local.remove(this.SUMMARIES_KEY);
      // Reset stats instead of removing
      const resetStats = {
        totalSummaries: 0,
        cacheHits: 0,
        apiCalls: 0,
        lastCleanup: Date.now()
      };
      await chrome.storage.local.set({ [this.STATS_KEY]: resetStats });
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Get API key
   * @returns {Promise<string|null>}
   */
  static async getApiKey() {
    try {
      const result = await chrome.storage.sync.get(this.API_KEY);
      return result[this.API_KEY] || null;
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }

  /**
   * Set API key
   * @param {string} apiKey
   */
  static async setApiKey(apiKey) {
    // Validate non-empty string
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new Error('API key must be a non-empty string');
    }

    try {
      await chrome.storage.sync.set({ [this.API_KEY]: apiKey });
    } catch (error) {
      console.error('Error setting API key:', error);
      throw error;
    }
  }

  /**
   * Remove API key
   */
  static async removeApiKey() {
    try {
      await chrome.storage.sync.remove(this.API_KEY);
    } catch (error) {
      console.error('Error removing API key:', error);
    }
  }

  /**
   * Update usage statistics
   * @param {string} action - 'set', 'hit', 'api_call'
   */
  static async updateStats(action) {
    try {
      const result = await chrome.storage.local.get(this.STATS_KEY);
      const stats = result[this.STATS_KEY] || {
        totalSummaries: 0,
        cacheHits: 0,
        apiCalls: 0,
        lastCleanup: Date.now()
      };

      if (action === 'set') stats.totalSummaries++;
      if (action === 'hit') stats.cacheHits++;
      if (action === 'api_call') stats.apiCalls++;

      await chrome.storage.local.set({ [this.STATS_KEY]: stats });
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  /**
   * Get usage statistics
   * @returns {Promise<Object>}
   */
  static async getStats() {
    try {
      const result = await chrome.storage.local.get(this.STATS_KEY);
      return result[this.STATS_KEY] || {
        totalSummaries: 0,
        cacheHits: 0,
        apiCalls: 0,
        lastCleanup: Date.now()
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return {};
    }
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
