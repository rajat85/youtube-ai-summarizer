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
    // Function to create and inject button
    const createAndInjectButton = () => {
      // Check if button already exists
      if (document.getElementById('yt-ai-summarize-btn')) {
        return true;
      }

      // Find the actions menu (Like, Dislike, Share buttons)
      const actionsMenu = document.querySelector('#top-level-buttons-computed, ytd-menu-renderer.ytd-watch-metadata #top-level-buttons-computed');
      if (!actionsMenu) {
        console.warn('YouTube actions menu not found, retrying...');
        return false;
      }

      // Create button container to match YouTube's style
      const buttonContainer = document.createElement('div');
      buttonContainer.id = 'yt-ai-button-container';
      buttonContainer.style.display = 'flex';
      buttonContainer.style.marginLeft = '8px';

      // Create button
      this.button = document.createElement('button');
      this.button.id = 'yt-ai-summarize-btn';
      this.button.className = 'yt-ai-button';
      this.button.innerHTML = '✨ Summarize';

      // Add click handler
      this.button.addEventListener('click', () => this.handleSummarize());

      buttonContainer.appendChild(this.button);
      actionsMenu.appendChild(buttonContainer);

      console.log('YouTube AI Summarizer button injected');
      return true;
    };

    // Wait for YouTube to load
    await this.waitForElement('#movie_player');

    // Set up observer to inject and maintain button
    const observer = new MutationObserver(() => {
      if (!document.getElementById('yt-ai-summarize-btn')) {
        createAndInjectButton();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Try initial injection
    createAndInjectButton();
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

  /**
   * Create sidebar UI
   */
  createSidebar() {
    this.sidebar = document.createElement('div');
    this.sidebar.id = 'yt-ai-sidebar';
    this.sidebar.className = 'yt-ai-sidebar';

    this.sidebar.innerHTML = `
      <div class="sidebar-header">
        <h3>✨ AI Summary</h3>
        <button class="close-btn">×</button>
      </div>
      <div class="sidebar-content">
        <div id="summary-container"></div>
        <div id="chat-container"></div>
      </div>
      <div class="sidebar-footer">
        <input type="text" placeholder="Ask a question..." id="chat-input">
        <button id="send-btn">Send</button>
      </div>
    `;

    document.body.appendChild(this.sidebar);

    // Setup close button
    this.sidebar.querySelector('.close-btn').addEventListener('click', () => {
      this.sidebar.classList.remove('open');
    });

    // Setup chat handlers
    this.setupChatHandlers();
  }

  /**
   * Setup chat input handlers
   */
  setupChatHandlers() {
    if (!this.sidebar) return;
    const input = this.sidebar.querySelector('#chat-input');
    const sendBtn = this.sidebar.querySelector('#send-btn');

    const handleSend = () => {
      const question = input.value.trim();
      if (question) {
        this.handleQuestion(question);
        input.value = '';
      }
    };

    // Send on button click
    sendBtn.addEventListener('click', handleSend);

    // Send on Enter key
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSend();
      }
    });
  }

  /**
   * Show loading spinner
   */
  showLoading() {
    if (!this.sidebar) return;
    const container = this.sidebar.querySelector('#summary-container');
    container.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Generating summary...</p>
      </div>
    `;
  }

  /**
   * Display summary in sidebar
   * @param {string} summary - The summary text
   * @param {boolean} cached - Whether this is from cache
   */
  displaySummary(summary, cached = false) {
    if (!this.sidebar) return;
    const container = this.sidebar.querySelector('#summary-container');

    const cachedBadge = cached ? '<span class="cached-badge">📦 From Cache</span>' : '';

    container.innerHTML = `
      <div class="summary">
        ${cachedBadge}
        <div class="summary-content">
          ${this.formatSummary(summary)}
        </div>
        <button class="regenerate-btn">🔄 Regenerate</button>
      </div>
    `;

    // Add regenerate handler
    container.querySelector('.regenerate-btn').addEventListener('click', async () => {
      try {
        // Clear cache for this video
        await StorageManager.clearSummary(this.currentVideoId);
        // Regenerate
        this.handleSummarize();
      } catch (error) {
        console.error('Failed to clear cache:', error);
        this.showMessage('Failed to clear cache', 'error');
      }
    });
  }

  /**
   * Format summary text with markdown-style conversions
   * @param {string} text - Raw summary text
   * @returns {string} HTML formatted text
   */
  formatSummary(text) {
    // Escape HTML entities to prevent XSS
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // Convert **bold** to <strong>
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Convert *italic* to <em>
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Convert bullet points (- or •) to proper list items
    text = text.replace(/^[•\-]\s+(.+)$/gm, '<li>$1</li>');

    // Wrap consecutive list items in <ul>
    text = text.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
      return '<ul>' + match + '</ul>';
    });

    // Convert emoji headers (lines starting with emoji)
    text = text.replace(/^([🎯📝💡⚡🔍✨📊🎬]+)\s*(.+)$/gm, '<h4>$1 $2</h4>');

    // Convert line breaks to paragraphs
    text = text.split('\n\n').map(para => {
      // Don't wrap if already HTML
      if (para.trim().startsWith('<')) {
        return para;
      }
      return para.trim() ? `<p>${para.trim()}</p>` : '';
    }).join('');

    return text;
  }

  /**
   * Handle user question
   * @param {string} question - User's question
   */
  async handleQuestion(question) {
    // Check if we have transcript
    if (!this.transcript) {
      this.showMessage('❌ Cannot answer questions without video transcript', 'error');
      return;
    }

    // Add user message to chat
    this.addChatMessage(question, 'user');

    // Show loading in chat
    const loadingMsg = this.addChatMessage('Thinking...', 'assistant', true);

    try {
      // Request answer from service worker
      const answer = await this.requestAnswer(question);

      // Remove loading message
      if (loadingMsg && loadingMsg.parentNode) {
        loadingMsg.remove();
      }

      // Add assistant response
      this.addChatMessage(answer, 'assistant');

      // Update conversation history (keep last 10 exchanges = 20 messages)
      this.conversationHistory.push(
        { role: 'user', content: question },
        { role: 'assistant', content: answer }
      );

      // Keep only last 10 exchanges (20 messages)
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

    } catch (error) {
      // Remove loading message
      if (loadingMsg && loadingMsg.parentNode) {
        loadingMsg.remove();
      }

      console.error('Error in handleQuestion:', error);
      this.addChatMessage('❌ Failed to get answer. Please try again.', 'assistant');
    }
  }

  /**
   * Request answer from service worker
   * @param {string} question - User's question
   * @returns {Promise<string>}
   */
  requestAnswer(question) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'ANSWER_QUESTION',
          videoId: this.currentVideoId,
          question: question,
          transcript: this.transcript,
          conversationHistory: this.conversationHistory
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
          // Handle error or success
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.answer);
          }
        }
      );
    });
  }

  /**
   * Add message to chat container
   * @param {string} text - Message text
   * @param {string} role - 'user' or 'assistant'
   * @param {boolean} loading - Show loading indicator
   * @returns {HTMLElement} The message element
   */
  addChatMessage(text, role, loading = false) {
    if (!this.sidebar) return;
    const chatContainer = this.sidebar.querySelector('#chat-container');

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;

    if (loading) {
      messageDiv.innerHTML = `
        <div class="message-content loading">
          <div class="spinner-small"></div>
          ${text}
        </div>
      `;
    } else {
      messageDiv.innerHTML = `
        <div class="message-content">
          ${this.formatSummary(text)}
        </div>
      `;
    }

    chatContainer.appendChild(messageDiv);

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;

    return messageDiv;
  }

  /**
   * Show error message
   * @param {Error} error - Error object
   */
  showError(error) {
    if (!this.sidebar) return;
    const container = this.sidebar.querySelector('#summary-container');

    let errorMessage = '❌ An error occurred';
    let errorDetails = error.message;
    let showRetry = true;

    // Map error types to user-friendly messages
    if (error.message.includes('API_KEY_MISSING')) {
      errorMessage = '🔑 API Key Required';
      errorDetails = 'Please set your Gemini API key in the extension settings.';
      showRetry = false;
    } else if (error.message.includes('INVALID_API_KEY')) {
      errorMessage = '🔑 Invalid API Key';
      errorDetails = 'Your API key appears to be invalid. Please check your settings.';
      showRetry = false;
    } else if (error.message.includes('QUOTA_EXCEEDED')) {
      errorMessage = '⚠️ Quota Exceeded';
      errorDetails = 'You\'ve reached your daily API limit. Please try again tomorrow or upgrade your quota.';
      showRetry = false;
    } else if (error.message.includes('RATE_LIMIT')) {
      errorMessage = '⏱️ Rate Limited';
      errorDetails = 'Too many requests. Please wait a moment and try again.';
      showRetry = true;
    } else if (error.message.includes('NO_CAPTIONS')) {
      errorMessage = '📝 No Captions Available';
      errorDetails = 'This video doesn\'t have captions available for summarization.';
      showRetry = false;
    } else if (error.message.includes('NETWORK_ERROR')) {
      errorMessage = '🌐 Network Error';
      errorDetails = 'Please check your internet connection and try again.';
      showRetry = true;
    }

    const retryButton = showRetry
      ? '<button class="retry-btn">🔄 Retry</button>'
      : '<button class="settings-btn">⚙️ Open Settings</button>';

    container.innerHTML = `
      <div class="error">
        <h3>${errorMessage}</h3>
        <p>${errorDetails}</p>
        ${retryButton}
      </div>
    `;

    // Add button handler
    if (showRetry) {
      container.querySelector('.retry-btn').addEventListener('click', () => {
        this.handleSummarize();
      });
    } else {
      const settingsBtn = container.querySelector('.settings-btn');
      if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
          chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
        });
      }
    }
  }

  /**
   * Show temporary message in chat
   * @param {string} text - Message text
   * @param {string} type - 'info', 'error', 'success'
   */
  showMessage(text, type = 'info') {
    if (!this.sidebar) return;
    const chatContainer = this.sidebar.querySelector('#chat-container');

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message system ${type}`;
    messageDiv.innerHTML = `
      <div class="message-content">
        ${text}
      </div>
    `;

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Auto-remove after 3 seconds
    setTimeout(() => {
      messageDiv.remove();
    }, 3000);
  }
}

// Initialize when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new YouTubeSummarizer();
  });
} else {
  new YouTubeSummarizer();
}
