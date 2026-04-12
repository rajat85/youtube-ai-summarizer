// content/content-script.js
// Main content script - injects UI and handles interactions

class YouTubeSummarizer {
  constructor() {
    this.currentVideoId = null;
    this.sidebar = null;
    this.button = null;
    this.transcript = null;
    this.conversationHistory = [];

    this.init();
  }

  /**
   * Initialize the extension
   */
  async init() {
    // Wait for YouTube to load
    await this.waitForElement('#movie_player');

    // Inject button
    this.injectButton();

    // Setup video change detection
    this.setupVideoChangeDetection();

    // Get current video ID
    this.currentVideoId = this.extractVideoId();
  }

  /**
   * Wait for element to exist
   * @param {string} selector
   * @returns {Promise<Element>}
   */
  waitForElement(selector) {
    return new Promise(resolve => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }

  /**
   * Setup detection for video changes (YouTube SPA)
   */
  setupVideoChangeDetection() {
    let lastUrl = location.href;

    new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.onVideoChange();
      }
    }).observe(document.body, {
      subtree: true,
      childList: true
    });
  }

  /**
   * Handle video change
   */
  onVideoChange() {
    const newVideoId = this.extractVideoId();

    if (newVideoId && newVideoId !== this.currentVideoId) {
      this.currentVideoId = newVideoId;
      this.transcript = null;
      this.conversationHistory = [];

      // Close sidebar
      if (this.sidebar) {
        this.sidebar.classList.remove('open');
      }

      // Update button
      this.updateButton();
    }
  }

  /**
   * Extract video ID from URL
   * @returns {string|null}
   */
  extractVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  /**
   * Inject summarize button
   */
  async injectButton() {
    // Wait for video metadata section
    const container = await this.waitForElement('#above-the-fold, #top-row');

    // Create button
    this.button = document.createElement('button');
    this.button.id = 'yt-ai-summarize-btn';
    this.button.className = 'yt-ai-button';
    this.button.innerHTML = '✨ Summarize';

    // Add click handler
    this.button.addEventListener('click', () => this.handleSummarize());

    // Find good insertion point
    const actionsRow = container.querySelector('#top-level-buttons-computed, #menu-container');
    if (actionsRow) {
      actionsRow.insertAdjacentElement('afterend', this.button);
    } else {
      container.appendChild(this.button);
    }
  }

  /**
   * Update button state
   */
  updateButton() {
    if (!this.button) return;

    this.button.disabled = false;
    this.button.innerHTML = '✨ Summarize';
  }

  /**
   * Handle summarize button click
   */
  async handleSummarize() {
    try {
      // Check if sidebar already open
      if (this.sidebar && this.sidebar.classList.contains('open')) {
        return;
      }

      // Create sidebar if not exists
      if (!this.sidebar) {
        this.createSidebar();
      }

      // Show sidebar
      this.sidebar.classList.add('open');

      // Show loading
      this.showLoading();

      // Check cache first
      const cached = await StorageManager.getSummary(this.currentVideoId);

      if (cached) {
        await StorageManager.updateStats('hit');
        this.displaySummary(cached.summary, true);
        return;
      }

      // Extract captions
      this.transcript = await CaptionExtractor.extract(this.currentVideoId);

      let summary;
      let hasCaptions = !!this.transcript;

      // Generate summary
      if (this.transcript) {
        summary = await this.requestSummary(this.transcript);
      } else {
        // Fallback to metadata
        const metadata = CaptionExtractor.extractMetadata();
        summary = await this.requestMetadataSummary(metadata);
        summary = `⚠️ **Limited Summary (No Captions Available)**\n\n${summary}\n\n_Note: This summary is based on video metadata only. Summaries are most accurate when captions are available._`;
      }

      // Cache the summary
      await StorageManager.setSummary(this.currentVideoId, summary, {
        videoTitle: document.title,
        hasCaptions
      });

      // Display
      this.displaySummary(summary, false);

    } catch (error) {
      console.error('Error in handleSummarize:', error);
      this.showError(error);
    }
  }

  /**
   * Request summary from service worker
   * @param {string} transcript
   * @returns {Promise<string>}
   */
  requestSummary(transcript) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'GENERATE_SUMMARY',
          videoId: this.currentVideoId,
          transcript: transcript
        },
        response => {
          // Check for Chrome runtime errors
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          // Check for undefined response
          if (!response) {
            reject(new Error('No response from background script'));
            return;
          }
          // Existing error/success handling
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.summary);
          }
        }
      );
    });
  }

  /**
   * Request metadata summary from service worker
   * @param {Object} metadata
   * @returns {Promise<string>}
   */
  requestMetadataSummary(metadata) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'GENERATE_SUMMARY',
          videoId: this.currentVideoId,
          metadata: metadata
        },
        response => {
          // Check for Chrome runtime errors
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          // Check for undefined response
          if (!response) {
            reject(new Error('No response from background script'));
            return;
          }
          // Existing error/success handling
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.summary);
          }
        }
      );
    });
  }

  // Continued in next step...
}
