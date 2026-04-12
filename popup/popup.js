/**
 * Popup Manager for YouTube AI Summarizer
 * Handles API key setup, settings display, and statistics
 */

class PopupManager {
  constructor() {
    this.apiKey = null;
    this.stats = {
      totalSummaries: 0,
      cacheHits: 0,
      apiCalls: 0
    };
  }

  /**
   * Initialize the popup
   */
  async init() {
    try {
      this.apiKey = await this.getApiKey();

      if (this.apiKey) {
        await this.showSettings(this.apiKey);
      } else {
        this.showSetup();
      }
    } catch (error) {
      console.error('Error initializing popup:', error);
      this.showSetup();
    }
  }

  /**
   * Show the setup view for first-time users
   */
  showSetup() {
    const setupView = document.getElementById('setup-view');
    const settingsView = document.getElementById('settings-view');

    setupView.classList.remove('hidden');
    settingsView.classList.add('hidden');

    // Add event listeners
    const saveButton = document.getElementById('save-key-button');
    const apiKeyInput = document.getElementById('api-key-input');

    saveButton.addEventListener('click', () => this.handleSaveKey());
    apiKeyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleSaveKey();
      }
    });
  }

  /**
   * Show the settings view with API key and stats
   */
  async showSettings(apiKey) {
    const setupView = document.getElementById('setup-view');
    const settingsView = document.getElementById('settings-view');

    setupView.classList.add('hidden');
    settingsView.classList.remove('hidden');

    // Display API key preview (first 8 chars + dots)
    const apiKeyPreview = document.getElementById('api-key-preview');
    apiKeyPreview.textContent = apiKey.substring(0, 8) + '••••••••••••••••';

    // Load and display statistics
    await this.loadStats();

    // Add event listeners
    const changeKeyButton = document.getElementById('change-key-button');
    const clearCacheButton = document.getElementById('clear-cache-button');

    changeKeyButton.addEventListener('click', () => {
      this.apiKey = null;
      this.showSetup();
    });

    clearCacheButton.addEventListener('click', () => this.handleClearCache());
  }

  /**
   * Handle saving the API key
   */
  async handleSaveKey() {
    const apiKeyInput = document.getElementById('api-key-input');
    const saveButton = document.getElementById('save-key-button');
    const apiKey = apiKeyInput.value.trim();

    // Clear any existing error messages
    this.hideError();

    // Validate API key length
    if (!apiKey) {
      this.showError('Please enter an API key');
      return;
    }

    if (apiKey.length < 20) {
      this.showError('API key appears to be too short. Please check and try again.');
      return;
    }

    // Update button state
    saveButton.textContent = 'Validating...';
    saveButton.disabled = true;
    apiKeyInput.disabled = true;

    try {
      // Validate API key with service worker
      const isValid = await this.validateApiKey(apiKey);

      if (isValid) {
        // Save API key to chrome.storage.sync
        await chrome.storage.sync.set({ apiKey });

        // Show success and switch to settings view
        this.apiKey = apiKey;
        await this.showSettings(apiKey);
      } else {
        this.showError('Invalid API key. Please check your key and try again.');
        saveButton.textContent = 'Save Key';
        saveButton.disabled = false;
        apiKeyInput.disabled = false;
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      this.showError('Failed to validate API key. Please check your internet connection and try again.');
      saveButton.textContent = 'Save Key';
      saveButton.disabled = false;
      apiKeyInput.disabled = false;
    }
  }

  /**
   * Validate API key by sending message to service worker
   */
  async validateApiKey(apiKey) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'VALIDATE_API_KEY',
          apiKey: apiKey
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('Runtime error:', chrome.runtime.lastError);
            resolve(false);
          } else {
            resolve(response && response.valid === true);
          }
        }
      );
    });
  }

  /**
   * Load statistics from storage
   */
  async loadStats() {
    try {
      const result = await chrome.storage.local.get(['stats']);

      if (result.stats) {
        this.stats = {
          totalSummaries: result.stats.totalSummaries || 0,
          cacheHits: result.stats.cacheHits || 0,
          apiCalls: result.stats.apiCalls || 0
        };
      }

      // Update display
      document.getElementById('total-summaries').textContent = this.stats.totalSummaries;
      document.getElementById('cache-hits').textContent = this.stats.cacheHits;
      document.getElementById('api-calls').textContent = this.stats.apiCalls;
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  /**
   * Handle clearing cache
   */
  async handleClearCache() {
    const confirmed = confirm(
      'Are you sure you want to clear all cached summaries and reset statistics? This action cannot be undone.'
    );

    if (confirmed) {
      try {
        // Clear summaries and stats from chrome.storage.local
        await chrome.storage.local.remove(['summaries', 'stats']);

        // Reset stats display
        this.stats = {
          totalSummaries: 0,
          cacheHits: 0,
          apiCalls: 0
        };

        document.getElementById('total-summaries').textContent = '0';
        document.getElementById('cache-hits').textContent = '0';
        document.getElementById('api-calls').textContent = '0';

        alert('Cache cleared successfully!');
      } catch (error) {
        console.error('Error clearing cache:', error);
        alert('Failed to clear cache. Please try again.');
      }
    }
  }

  /**
   * Get API key from storage
   */
  async getApiKey() {
    try {
      const result = await chrome.storage.sync.get(['apiKey']);
      return result.apiKey || null;
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideError();
    }, 5000);
  }

  /**
   * Hide error message
   */
  hideError() {
    const errorElement = document.getElementById('error-message');
    errorElement.classList.add('hidden');
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const popupManager = new PopupManager();
  popupManager.init();
});
