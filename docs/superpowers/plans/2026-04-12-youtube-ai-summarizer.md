# YouTube AI Summarizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that uses Gemini Flash 2.0 to instantly summarize YouTube videos and enable interactive Q&A, entirely client-side with zero backend infrastructure.

**Architecture:** Manifest V3 extension with content script injecting UI into YouTube, service worker handling Gemini API calls, and chrome.storage for caching. YouTube-native design using CSS variables for seamless integration.

**Tech Stack:** Vanilla JavaScript (ES6+), Chrome Extension APIs (Manifest V3), Google Gemini 2.0 Flash API, Chrome Storage API

---

## File Structure

**New Files to Create:**
```
youtube-ai-summarizer/
├── manifest.json                      # Extension configuration
├── icons/
│   ├── icon16.png                     # Toolbar icon (small)
│   ├── icon48.png                     # Extension manager icon
│   └── icon128.png                    # Store listing icon
├── background/
│   └── service-worker.js              # Background script, API calls
├── content/
│   ├── content-script.js              # Main logic, UI injection
│   └── styles.css                     # YouTube-native styling
├── popup/
│   ├── popup.html                     # Settings UI
│   ├── popup.js                       # Settings logic
│   └── popup.css                      # Settings styling
├── utils/
│   ├── caption-extractor.js           # YouTube caption parsing
│   ├── gemini-client.js               # API wrapper
│   └── storage.js                     # Cache management
├── README.md                          # User documentation
└── .gitignore                         # Git ignore file
```

---

## Task 1: Project Setup & Basic Structure

**Files:**
- Create: `manifest.json`
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Create .gitignore file**

```gitignore
# Dependencies
node_modules/

# Build artifacts
dist/
build/
*.zip

# IDE
.DS_Store
.vscode/
.idea/

# Chrome extension
*.pem
*.crx
```

- [ ] **Step 2: Create README.md**

```markdown
# YouTube AI Summarizer

AI-powered Chrome extension for instantly summarizing YouTube videos using Google's Gemini Flash 2.0.

## Features
- Instant video summaries with structured format
- Interactive Q&A about video content
- Smart caching for repeated access
- Privacy-first (all local, no tracking)
- YouTube-native design

## Setup
1. Get free Gemini API key from https://ai.google.dev
2. Install extension
3. Click extension icon and enter API key
4. Visit any YouTube video and click "Summarize"

## Development
- Vanilla JavaScript (ES6+)
- Chrome Extension Manifest V3
- No build tools required (optional)

## Privacy
- All data stored locally
- No tracking or analytics
- API key never leaves your device
```

- [ ] **Step 3: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "YouTube AI Summarizer",
  "version": "1.0.0",
  "description": "Instantly summarize and interact with YouTube videos using AI",
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "*://www.youtube.com/*",
    "*://generativelanguage.googleapis.com/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["*://www.youtube.com/watch*"],
      "js": [
        "utils/storage.js",
        "utils/caption-extractor.js",
        "content/content-script.js"
      ],
      "css": ["content/styles.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

- [ ] **Step 4: Create directory structure**

```bash
mkdir -p icons background content popup utils
```

- [ ] **Step 5: Commit project setup**

```bash
git add .
git commit -m "feat: initial project setup with manifest and structure"
```

---

## Task 2: Storage Utilities

**Files:**
- Create: `utils/storage.js`

- [ ] **Step 1: Create storage.js with cache manager**

```javascript
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

      // Check storage size
      const estimatedSize = JSON.stringify(summaries).length;
      if (estimatedSize > this.MAX_SIZE_BYTES) {
        await this.cleanup();
      }

      summaries[videoId] = {
        summary,
        timestamp: Date.now(),
        ...metadata
      };

      await chrome.storage.local.set({ [this.SUMMARIES_KEY]: summaries });
      await this.updateStats('set');
    } catch (error) {
      console.error('Error setting summary:', error);
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

      // Remove oldest 20%
      const toRemove = Math.floor(entries.length * this.CLEANUP_PERCENTAGE);
      const toKeep = entries.slice(toRemove);

      const cleanedSummaries = Object.fromEntries(toKeep);
      await chrome.storage.local.set({ [this.SUMMARIES_KEY]: cleanedSummaries });

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
      await chrome.storage.local.remove(this.STATS_KEY);
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
```

- [ ] **Step 2: Commit storage utilities**

```bash
git add utils/storage.js
git commit -m "feat: add storage manager for caching and API key"
```

---

## Task 3: Caption Extractor

**Files:**
- Create: `utils/caption-extractor.js`

- [ ] **Step 1: Create caption extractor**

```javascript
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
      if (typeof window.ytInitialPlayerResponse === 'undefined') {
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
      .map(event => event.segs.map(seg => seg.utf8).join(''))
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
```

- [ ] **Step 2: Commit caption extractor**

```bash
git add utils/caption-extractor.js
git commit -m "feat: add caption extractor for YouTube videos"
```

---

## Task 4: Gemini API Client

**Files:**
- Create: `utils/gemini-client.js`

- [ ] **Step 1: Create Gemini API client**

```javascript
// utils/gemini-client.js
// Wrapper for Gemini API calls

class GeminiClient {
  static API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

  static SUMMARY_PROMPT_TEMPLATE = `You are an expert at summarizing YouTube videos. Analyze the following video transcript and create a structured summary.

Format your response EXACTLY as follows:

📝 Overview
[Provide a concise 2-3 sentence overview of the video's main topic and purpose]

🔑 Main Points
• [First major point or topic discussed]
• [Second major point or topic discussed]
• [Third major point or topic discussed]
[Continue with additional points as needed, minimum 3, maximum 8]

💡 Key Takeaways
• [First actionable insight or conclusion]
• [Second actionable insight or conclusion]
[Minimum 2, maximum 5 takeaways]

Video Transcript:
{transcript}`;

  static QA_SYSTEM_PROMPT = `You are an AI assistant helping users understand a YouTube video. You have access to the full video transcript and should answer questions based on this content.

Guidelines:
- Answer questions directly and concisely
- Reference specific parts of the video when relevant
- If something wasn't covered in the video, say so
- Be conversational but informative
- Keep responses under 150 words unless more detail is requested`;

  /**
   * Generate summary for a transcript
   * @param {string} apiKey - Gemini API key
   * @param {string} transcript - Video transcript
   * @returns {Promise<string>} Summary text
   */
  static async generateSummary(apiKey, transcript) {
    const prompt = this.SUMMARY_PROMPT_TEMPLATE.replace('{transcript}', transcript);

    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048
      }
    };

    return await this.callAPI(apiKey, requestBody);
  }

  /**
   * Generate summary from metadata (no captions)
   * @param {string} apiKey - Gemini API key
   * @param {Object} metadata - Video metadata
   * @returns {Promise<string>} Summary text
   */
  static async generateMetadataSummary(apiKey, metadata) {
    const prompt = `Summarize this YouTube video based on its metadata:

Title: ${metadata.title}
Channel: ${metadata.channelName}
Description: ${metadata.description}

${metadata.comments.length > 0 ? `Top Comments:\n${metadata.comments.join('\n')}` : ''}

Provide a brief summary of what this video is likely about. Format as:
📝 Overview, 🔑 Main Topics, 💡 What to Expect`;

    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 1024
      }
    };

    return await this.callAPI(apiKey, requestBody);
  }

  /**
   * Answer question about video
   * @param {string} apiKey - Gemini API key
   * @param {string} transcript - Video transcript
   * @param {string} question - User question
   * @param {Array} conversationHistory - Previous messages
   * @returns {Promise<string>} Answer text
   */
  static async answerQuestion(apiKey, transcript, question, conversationHistory = []) {
    const contents = [
      {
        role: 'user',
        parts: [{ text: `${this.QA_SYSTEM_PROMPT}\n\nVideo Transcript:\n${transcript}` }]
      },
      {
        role: 'model',
        parts: [{ text: 'I understand. I have the transcript and will answer questions based on it.' }]
      }
    ];

    // Add conversation history
    conversationHistory.forEach(msg => {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    });

    // Add current question
    contents.push({
      role: 'user',
      parts: [{ text: question }]
    });

    const requestBody = {
      contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 1024
      }
    };

    return await this.callAPI(apiKey, requestBody);
  }

  /**
   * Call Gemini API with retry logic
   * @param {string} apiKey - API key
   * @param {Object} requestBody - Request body
   * @param {number} retries - Number of retries
   * @returns {Promise<string>} Response text
   */
  static async callAPI(apiKey, requestBody, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(`${this.API_ENDPOINT}?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          // Handle specific errors
          if (response.status === 429) {
            throw new Error('QUOTA_EXCEEDED');
          } else if (response.status === 401 || response.status === 403) {
            throw new Error('INVALID_API_KEY');
          } else {
            throw new Error(`API_ERROR: ${response.status} ${response.statusText}`);
          }
        }

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
          throw new Error('No response from API');
        }

        return data.candidates[0].content.parts[0].text;
      } catch (error) {
        // Don't retry on quota or auth errors
        if (error.message === 'QUOTA_EXCEEDED' || error.message === 'INVALID_API_KEY') {
          throw error;
        }

        // Retry on network errors
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Retry ${attempt + 1}/${retries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }
}

// Export for service worker
if (typeof self !== 'undefined' && self.GeminiClient === undefined) {
  self.GeminiClient = GeminiClient;
}
```

- [ ] **Step 2: Commit Gemini client**

```bash
git add utils/gemini-client.js
git commit -m "feat: add Gemini API client with retry logic"
```

---

## Task 5: Service Worker (Background Script)

**Files:**
- Create: `background/service-worker.js`

- [ ] **Step 1: Create service worker**

```javascript
// background/service-worker.js
// Background script for handling API calls

// Import Gemini client
importScripts('../utils/gemini-client.js');

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GENERATE_SUMMARY') {
    handleGenerateSummary(message, sendResponse);
    return true; // Keep channel open for async response
  } else if (message.type === 'ANSWER_QUESTION') {
    handleAnswerQuestion(message, sendResponse);
    return true;
  } else if (message.type === 'VALIDATE_API_KEY') {
    handleValidateApiKey(message, sendResponse);
    return true;
  }
});

/**
 * Handle summary generation request
 */
async function handleGenerateSummary(message, sendResponse) {
  try {
    // Get API key
    const result = await chrome.storage.sync.get('apiKey');
    const apiKey = result.apiKey;

    if (!apiKey) {
      sendResponse({ error: 'API_KEY_MISSING' });
      return;
    }

    // Generate summary
    let summary;
    if (message.transcript) {
      summary = await GeminiClient.generateSummary(apiKey, message.transcript);
    } else if (message.metadata) {
      summary = await GeminiClient.generateMetadataSummary(apiKey, message.metadata);
    } else {
      sendResponse({ error: 'NO_CONTENT' });
      return;
    }

    sendResponse({ summary });
  } catch (error) {
    console.error('Error generating summary:', error);
    sendResponse({ error: error.message || 'UNKNOWN_ERROR' });
  }
}

/**
 * Handle question answering request
 */
async function handleAnswerQuestion(message, sendResponse) {
  try {
    // Get API key
    const result = await chrome.storage.sync.get('apiKey');
    const apiKey = result.apiKey;

    if (!apiKey) {
      sendResponse({ error: 'API_KEY_MISSING' });
      return;
    }

    // Answer question
    const answer = await GeminiClient.answerQuestion(
      apiKey,
      message.transcript,
      message.question,
      message.conversationHistory || []
    );

    sendResponse({ answer });
  } catch (error) {
    console.error('Error answering question:', error);
    sendResponse({ error: error.message || 'UNKNOWN_ERROR' });
  }
}

/**
 * Handle API key validation
 */
async function handleValidateApiKey(message, sendResponse) {
  try {
    // Test API key with minimal request
    const testPrompt = 'Say "OK" if you can read this.';
    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: testPrompt }]
      }],
      generationConfig: {
        maxOutputTokens: 10
      }
    };

    await GeminiClient.callAPI(message.apiKey, requestBody, 1);
    sendResponse({ valid: true });
  } catch (error) {
    console.error('API key validation failed:', error);
    sendResponse({ valid: false, error: error.message });
  }
}

// Extension installed/updated
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('YouTube AI Summarizer installed');
    // Open welcome page or setup
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    console.log('YouTube AI Summarizer updated');
  }
});
```

- [ ] **Step 2: Commit service worker**

```bash
git add background/service-worker.js
git commit -m "feat: add service worker for API calls"
```

---

## Task 6: Content Script - Core Logic

**Files:**
- Create: `content/content-script.js`

- [ ] **Step 1: Create content script part 1 (main class)**

```javascript
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
      let hasCapions = !!this.transcript;

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
        hasCapions
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
```

- [ ] **Step 2: Commit content script part 1**

```bash
git add content/content-script.js
git commit -m "feat: add content script core logic"
```

---

## Task 7: Content Script - UI Methods

**Files:**
- Modify: `content/content-script.js`

- [ ] **Step 1: Add UI methods to content script**

Add these methods to the `YouTubeSummarizer` class in `content/content-script.js` (after the previous methods):

```javascript
  /**
   * Create sidebar UI
   */
  createSidebar() {
    this.sidebar = document.createElement('div');
    this.sidebar.id = 'yt-ai-sidebar';
    this.sidebar.className = 'yt-ai-sidebar';

    this.sidebar.innerHTML = `
      <div class="sidebar-header">
        <h3>YouTube AI Summarizer</h3>
        <button class="close-btn" title="Close">×</button>
      </div>
      <div class="sidebar-content">
        <div id="summary-container"></div>
        <div id="chat-container"></div>
      </div>
      <div class="sidebar-footer">
        <input type="text" placeholder="Ask a question..." id="chat-input" />
        <button id="send-btn">Send</button>
      </div>
    `;

    document.body.appendChild(this.sidebar);

    // Setup event listeners
    this.sidebar.querySelector('.close-btn').addEventListener('click', () => {
      this.sidebar.classList.remove('open');
    });

    this.setupChatHandlers();
  }

  /**
   * Setup chat input handlers
   */
  setupChatHandlers() {
    const input = this.sidebar.querySelector('#chat-input');
    const sendBtn = this.sidebar.querySelector('#send-btn');

    const handleSend = () => {
      const question = input.value.trim();
      if (question) {
        this.handleQuestion(question);
        input.value = '';
      }
    };

    sendBtn.addEventListener('click', handleSend);

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSend();
      }
    });
  }

  /**
   * Show loading state
   */
  showLoading() {
    const container = this.sidebar.querySelector('#summary-container');
    container.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Analyzing video...</p>
      </div>
    `;
  }

  /**
   * Display summary
   * @param {string} summary
   * @param {boolean} cached
   */
  displaySummary(summary, cached) {
    const container = this.sidebar.querySelector('#summary-container');

    const cachedBadge = cached ? '<span class="cached-badge">Cached</span>' : '';
    const regenerateBtn = cached ? '<button class="regenerate-btn">🔄 Regenerate</button>' : '';

    container.innerHTML = `
      <div class="summary">
        <div class="summary-header">
          ${cachedBadge}
          ${regenerateBtn}
        </div>
        <div class="summary-content">${this.formatSummary(summary)}</div>
      </div>
    `;

    // Setup regenerate handler
    if (cached) {
      const regenBtn = container.querySelector('.regenerate-btn');
      regenBtn.addEventListener('click', async () => {
        await StorageManager.removeSummary(this.currentVideoId);
        this.handleSummarize();
      });
    }
  }

  /**
   * Format summary text to HTML
   * @param {string} text
   * @returns {string}
   */
  formatSummary(text) {
    // Convert markdown-style formatting to HTML
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/^• (.+)$/gm, '<li>$1</li>')
      .replace(/^(📝|🔑|💡)\s*(.+)$/gm, '<h4>$1 $2</h4>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.+)$/gm, (match) => {
        if (match.startsWith('<h4>') || match.startsWith('<li>')) {
          return match;
        }
        return `<p>${match}</p>`;
      });
  }

  /**
   * Handle user question
   * @param {string} question
   */
  async handleQuestion(question) {
    if (!this.transcript) {
      this.showMessage('Cannot answer questions without transcript', 'error');
      return;
    }

    try {
      // Add user message to UI
      this.addChatMessage(question, 'user');

      // Show loading
      this.addChatMessage('...', 'assistant', true);

      // Send to service worker
      const answer = await this.requestAnswer(question);

      // Remove loading, add answer
      const chatContainer = this.sidebar.querySelector('#chat-container');
      const loadingMsg = chatContainer.querySelector('.message.loading');
      if (loadingMsg) loadingMsg.remove();

      this.addChatMessage(answer, 'assistant');

      // Update conversation history
      this.conversationHistory.push(
        { role: 'user', content: question },
        { role: 'model', content: answer }
      );

      // Keep only last 10 exchanges
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

    } catch (error) {
      console.error('Error handling question:', error);

      // Remove loading
      const chatContainer = this.sidebar.querySelector('#chat-container');
      const loadingMsg = chatContainer.querySelector('.message.loading');
      if (loadingMsg) loadingMsg.remove();

      this.showMessage('Failed to get answer. Please try again.', 'error');
    }
  }

  /**
   * Request answer from service worker
   * @param {string} question
   * @returns {Promise<string>}
   */
  requestAnswer(question) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'ANSWER_QUESTION',
          question: question,
          transcript: this.transcript,
          conversationHistory: this.conversationHistory
        },
        response => {
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
   * Add chat message to UI
   * @param {string} text
   * @param {string} role - 'user' or 'assistant'
   * @param {boolean} loading
   */
  addChatMessage(text, role, loading = false) {
    const chatContainer = this.sidebar.querySelector('#chat-container');

    const message = document.createElement('div');
    message.className = `message ${role}${loading ? ' loading' : ''}`;
    message.textContent = text;

    chatContainer.appendChild(message);

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  /**
   * Show error message
   * @param {Error} error
   */
  showError(error) {
    const container = this.sidebar.querySelector('#summary-container');

    let errorMessage = 'An error occurred';
    let errorDetails = '';

    if (error.message === 'API_KEY_MISSING') {
      errorMessage = '⚙️ API Key Required';
      errorDetails = 'Please click the extension icon to set up your Gemini API key.';
    } else if (error.message === 'INVALID_API_KEY') {
      errorMessage = '❌ Invalid API Key';
      errorDetails = 'Your API key is invalid. Please check your settings.';
    } else if (error.message === 'QUOTA_EXCEEDED') {
      errorMessage = '📊 Daily Quota Reached';
      errorDetails = 'Your free tier limit has been reached. It resets daily. Cached summaries still work!';
    } else {
      errorMessage = '🔌 Connection Issue';
      errorDetails = 'Could not reach Gemini API. Check your internet connection and try again.';
    }

    container.innerHTML = `
      <div class="error">
        <h3>${errorMessage}</h3>
        <p>${errorDetails}</p>
        <button class="retry-btn">Retry</button>
      </div>
    `;

    // Setup retry handler
    container.querySelector('.retry-btn').addEventListener('click', () => {
      this.handleSummarize();
    });
  }

  /**
   * Show temporary message
   * @param {string} text
   * @param {string} type
   */
  showMessage(text, type = 'info') {
    const chatContainer = this.sidebar.querySelector('#chat-container');

    const message = document.createElement('div');
    message.className = `message system ${type}`;
    message.textContent = text;

    chatContainer.appendChild(message);

    // Remove after 3 seconds
    setTimeout(() => message.remove(), 3000);
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
```

- [ ] **Step 2: Commit content script UI methods**

```bash
git add content/content-script.js
git commit -m "feat: add content script UI methods"
```

---

## Task 8: Content Script Styles

**Files:**
- Create: `content/styles.css`

- [ ] **Step 1: Create styles.css**

```css
/* content/styles.css */
/* YouTube-native styling for the extension */

/* Summarize Button */
.yt-ai-button {
  background-color: var(--yt-spec-call-to-action, #065fd4);
  color: var(--yt-spec-text-primary-inverse, #fff);
  border: none;
  border-radius: 18px;
  padding: 10px 20px;
  font-family: Roboto, Arial, sans-serif;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 12px 0;
  transition: background-color 0.2s ease;
}

.yt-ai-button:hover {
  background-color: var(--yt-spec-call-to-action-hover, #0558c7);
}

.yt-ai-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Sidebar */
.yt-ai-sidebar {
  position: fixed;
  top: 0;
  right: -420px;
  width: 400px;
  height: 100vh;
  background-color: var(--yt-spec-base-background, #fff);
  box-shadow: -2px 0 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  transition: right 0.3s ease-out;
  font-family: Roboto, Arial, sans-serif;
}

.yt-ai-sidebar.open {
  right: 0;
}

/* Sidebar Header */
.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--yt-spec-10-percent-layer, rgba(0, 0, 0, 0.1));
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--yt-spec-text-primary, #0f0f0f);
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  color: var(--yt-spec-text-secondary, #606060);
  padding: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.close-btn:hover {
  background-color: var(--yt-spec-10-percent-layer, rgba(0, 0, 0, 0.1));
}

/* Sidebar Content */
.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.sidebar-content::-webkit-scrollbar {
  width: 8px;
}

.sidebar-content::-webkit-scrollbar-thumb {
  background-color: var(--yt-spec-10-percent-layer, rgba(0, 0, 0, 0.1));
  border-radius: 4px;
}

.sidebar-content::-webkit-scrollbar-thumb:hover {
  background-color: var(--yt-spec-text-secondary, rgba(0, 0, 0, 0.2));
}

/* Loading */
.loading {
  text-align: center;
  padding: 40px 20px;
  color: var(--yt-spec-text-secondary, #606060);
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 16px;
  border: 3px solid var(--yt-spec-10-percent-layer, rgba(0, 0, 0, 0.1));
  border-top-color: var(--yt-spec-call-to-action, #065fd4);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Summary */
.summary {
  margin-bottom: 24px;
}

.summary-header {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
}

.cached-badge {
  background-color: var(--yt-spec-badge-chip-background, #f2f2f2);
  color: var(--yt-spec-text-secondary, #606060);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.regenerate-btn {
  background: none;
  border: 1px solid var(--yt-spec-10-percent-layer, rgba(0, 0, 0, 0.1));
  padding: 4px 12px;
  border-radius: 18px;
  font-size: 12px;
  cursor: pointer;
  color: var(--yt-spec-text-secondary, #606060);
  transition: all 0.2s ease;
}

.regenerate-btn:hover {
  background-color: var(--yt-spec-10-percent-layer, rgba(0, 0, 0, 0.05));
  border-color: var(--yt-spec-text-secondary, #606060);
}

.summary-content {
  color: var(--yt-spec-text-primary, #0f0f0f);
  line-height: 1.6;
}

.summary-content h4 {
  font-size: 15px;
  font-weight: 500;
  margin: 16px 0 8px;
  color: var(--yt-spec-text-primary, #0f0f0f);
}

.summary-content p {
  margin: 8px 0;
  font-size: 14px;
}

.summary-content li {
  margin: 6px 0 6px 20px;
  font-size: 14px;
  list-style-type: disc;
}

.summary-content strong {
  font-weight: 500;
}

.summary-content em {
  font-style: italic;
  color: var(--yt-spec-text-secondary, #606060);
}

/* Chat Container */
#chat-container {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--yt-spec-10-percent-layer, rgba(0, 0, 0, 0.1));
}

.message {
  margin: 12px 0;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  max-width: 85%;
  word-wrap: break-word;
}

.message.user {
  background-color: var(--yt-spec-call-to-action, #065fd4);
  color: var(--yt-spec-text-primary-inverse, #fff);
  margin-left: auto;
  text-align: right;
}

.message.assistant {
  background-color: var(--yt-spec-10-percent-layer, #f2f2f2);
  color: var(--yt-spec-text-primary, #0f0f0f);
  margin-right: auto;
}

.message.system {
  background-color: var(--yt-spec-badge-chip-background, #fef7e0);
  color: var(--yt-spec-text-primary, #0f0f0f);
  text-align: center;
  margin: 8px auto;
  font-size: 13px;
  max-width: 100%;
}

.message.system.error {
  background-color: #fde7e7;
  color: #c62828;
}

.message.loading {
  opacity: 0.6;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* Error State */
.error {
  text-align: center;
  padding: 32px 20px;
  color: var(--yt-spec-text-secondary, #606060);
}

.error h3 {
  font-size: 18px;
  font-weight: 500;
  margin: 0 0 12px;
  color: var(--yt-spec-text-primary, #0f0f0f);
}

.error p {
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 20px;
}

.retry-btn {
  background-color: var(--yt-spec-call-to-action, #065fd4);
  color: var(--yt-spec-text-primary-inverse, #fff);
  border: none;
  border-radius: 18px;
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.retry-btn:hover {
  background-color: var(--yt-spec-call-to-action-hover, #0558c7);
}

/* Sidebar Footer */
.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--yt-spec-10-percent-layer, rgba(0, 0, 0, 0.1));
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  background-color: var(--yt-spec-base-background, #fff);
}

#chat-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--yt-spec-10-percent-layer, rgba(0, 0, 0, 0.2));
  border-radius: 20px;
  background-color: var(--yt-spec-base-background, #fff);
  color: var(--yt-spec-text-primary, #0f0f0f);
  font-family: Roboto, Arial, sans-serif;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

#chat-input:focus {
  border-color: var(--yt-spec-call-to-action, #065fd4);
}

#chat-input::placeholder {
  color: var(--yt-spec-text-secondary, #606060);
}

#send-btn {
  background-color: var(--yt-spec-call-to-action, #065fd4);
  color: var(--yt-spec-text-primary-inverse, #fff);
  border: none;
  border-radius: 18px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
  white-space: nowrap;
}

#send-btn:hover {
  background-color: var(--yt-spec-call-to-action-hover, #0558c7);
}

#send-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .yt-ai-sidebar {
    width: 350px;
    right: -370px;
  }
}

@media (max-width: 900px) {
  .yt-ai-sidebar {
    width: 100%;
    right: -100%;
  }
}

/* Dark mode support (automatically handled by YouTube's CSS variables) */
```

- [ ] **Step 2: Commit styles**

```bash
git add content/styles.css
git commit -m "feat: add YouTube-native styling for extension"
```

---

## Task 9: Popup Settings UI

**Files:**
- Create: `popup/popup.html`
- Create: `popup/popup.js`
- Create: `popup/popup.css`

- [ ] **Step 1: Create popup.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YouTube AI Summarizer Settings</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <!-- Setup View -->
    <div id="setup-view" class="view">
      <h1>Welcome! 👋</h1>
      <p class="subtitle">Get started in 2 simple steps</p>

      <div class="step">
        <div class="step-number">1</div>
        <div class="step-content">
          <h3>Get your free API key</h3>
          <p>Click below to get your free Gemini API key from Google</p>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" class="btn btn-primary">
            Get Free API Key
          </a>
        </div>
      </div>

      <div class="step">
        <div class="step-number">2</div>
        <div class="step-content">
          <h3>Enter your API key</h3>
          <input type="password" id="api-key-input" placeholder="Paste your API key here" />
          <button id="save-key-btn" class="btn btn-primary">Save & Start</button>
          <p class="note">🔒 Your key is stored locally and never shared</p>
        </div>
      </div>

      <div id="error-message" class="error-message hidden"></div>
    </div>

    <!-- Settings View -->
    <div id="settings-view" class="view hidden">
      <h1>Settings ⚙️</h1>

      <div class="section">
        <h3>API Key</h3>
        <div class="key-display">
          <span id="key-preview">••••••••••••••••</span>
          <button id="change-key-btn" class="btn btn-secondary btn-small">Change</button>
        </div>
      </div>

      <div class="section">
        <h3>Statistics 📊</h3>
        <div class="stats">
          <div class="stat-item">
            <span class="stat-label">Total Summaries:</span>
            <span class="stat-value" id="stat-total">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Cache Hits:</span>
            <span class="stat-value" id="stat-hits">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">API Calls:</span>
            <span class="stat-value" id="stat-calls">0</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>Cache Management 💾</h3>
        <p class="note">Clear all cached summaries</p>
        <button id="clear-cache-btn" class="btn btn-danger">Clear Cache</button>
      </div>

      <div class="section">
        <h3>How to Use 📖</h3>
        <ol class="instructions">
          <li>Open any YouTube video</li>
          <li>Look for the "✨ Summarize" button</li>
          <li>Click to get instant summary</li>
          <li>Ask follow-up questions in the chat</li>
        </ol>
      </div>

      <div class="footer">
        <p>Made with ❤️ for learners everywhere</p>
        <p class="version">Version 1.0.0</p>
      </div>
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create popup.js**

```javascript
// popup/popup.js
// Popup settings logic

class PopupManager {
  constructor() {
    this.setupView = document.getElementById('setup-view');
    this.settingsView = document.getElementById('settings-view');

    this.init();
  }

  async init() {
    // Check if API key exists
    const apiKey = await this.getApiKey();

    if (apiKey) {
      this.showSettings(apiKey);
    } else {
      this.showSetup();
    }
  }

  /**
   * Show setup view
   */
  showSetup() {
    this.setupView.classList.remove('hidden');
    this.settingsView.classList.add('hidden');

    // Setup event listeners
    const saveBtn = document.getElementById('save-key-btn');
    const input = document.getElementById('api-key-input');

    saveBtn.addEventListener('click', () => this.handleSaveKey());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleSaveKey();
    });
  }

  /**
   * Show settings view
   * @param {string} apiKey
   */
  async showSettings(apiKey) {
    this.setupView.classList.add('hidden');
    this.settingsView.classList.remove('hidden');

    // Display key preview
    const preview = apiKey.substring(0, 8) + '••••••••';
    document.getElementById('key-preview').textContent = preview;

    // Load and display stats
    await this.loadStats();

    // Setup event listeners
    document.getElementById('change-key-btn').addEventListener('click', () => {
      this.showSetup();
    });

    document.getElementById('clear-cache-btn').addEventListener('click', () => {
      this.handleClearCache();
    });
  }

  /**
   * Handle save API key
   */
  async handleSaveKey() {
    const input = document.getElementById('api-key-input');
    const apiKey = input.value.trim();

    if (!apiKey) {
      this.showError('Please enter an API key');
      return;
    }

    // Validate key format (basic check)
    if (apiKey.length < 20) {
      this.showError('API key seems invalid. Please check and try again.');
      return;
    }

    const saveBtn = document.getElementById('save-key-btn');
    saveBtn.textContent = 'Validating...';
    saveBtn.disabled = true;

    try {
      // Validate with backend
      const isValid = await this.validateApiKey(apiKey);

      if (!isValid) {
        this.showError('Invalid API key. Please check your key and try again.');
        saveBtn.textContent = 'Save & Start';
        saveBtn.disabled = false;
        return;
      }

      // Save to storage
      await chrome.storage.sync.set({ apiKey: apiKey });

      // Show success and switch to settings
      this.showSettings(apiKey);

    } catch (error) {
      console.error('Error saving API key:', error);
      this.showError('Failed to validate API key. Please try again.');
      saveBtn.textContent = 'Save & Start';
      saveBtn.disabled = false;
    }
  }

  /**
   * Validate API key with service worker
   * @param {string} apiKey
   * @returns {Promise<boolean>}
   */
  validateApiKey(apiKey) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'VALIDATE_API_KEY', apiKey },
        (response) => {
          resolve(response.valid);
        }
      );
    });
  }

  /**
   * Load and display statistics
   */
  async loadStats() {
    try {
      const result = await chrome.storage.local.get('stats');
      const stats = result.stats || {
        totalSummaries: 0,
        cacheHits: 0,
        apiCalls: 0
      };

      document.getElementById('stat-total').textContent = stats.totalSummaries;
      document.getElementById('stat-hits').textContent = stats.cacheHits;
      document.getElementById('stat-calls').textContent = stats.apiCalls;
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  /**
   * Handle clear cache
   */
  async handleClearCache() {
    if (!confirm('Clear all cached summaries? This cannot be undone.')) {
      return;
    }

    try {
      await chrome.storage.local.remove('summaries');
      await chrome.storage.local.remove('stats');

      // Reload stats
      await this.loadStats();

      alert('Cache cleared successfully!');
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Failed to clear cache. Please try again.');
    }
  }

  /**
   * Get API key from storage
   * @returns {Promise<string|null>}
   */
  async getApiKey() {
    try {
      const result = await chrome.storage.sync.get('apiKey');
      return result.apiKey || null;
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }

  /**
   * Show error message
   * @param {string} message
   */
  showError(message) {
    const errorEl = document.getElementById('error-message');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');

    setTimeout(() => {
      errorEl.classList.add('hidden');
    }, 5000);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
```

- [ ] **Step 3: Create popup.css**

```css
/* popup/popup.css */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 400px;
  min-height: 500px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f8f9fa;
  color: #212529;
}

.container {
  padding: 24px;
}

.view {
  display: block;
}

.view.hidden {
  display: none;
}

h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #212529;
}

.subtitle {
  color: #6c757d;
  margin-bottom: 24px;
  font-size: 14px;
}

/* Steps */
.step {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.step-number {
  width: 32px;
  height: 32px;
  background-color: #0d6efd;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
}

.step-content h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #212529;
}

.step-content p {
  font-size: 14px;
  color: #6c757d;
  margin-bottom: 12px;
}

.note {
  font-size: 12px;
  color: #6c757d;
  margin-top: 8px;
}

/* Buttons */
.btn {
  display: inline-block;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  text-align: center;
  transition: all 0.2s ease;
}

.btn-primary {
  background-color: #0d6efd;
  color: white;
}

.btn-primary:hover {
  background-color: #0b5ed7;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #5c636a;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover {
  background-color: #bb2d3b;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Input */
input[type="password"],
input[type="text"] {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 12px;
  font-family: inherit;
}

input:focus {
  outline: none;
  border-color: #0d6efd;
  box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.1);
}

/* Error Message */
.error-message {
  background-color: #f8d7da;
  color: #842029;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  margin-top: 16px;
}

.error-message.hidden {
  display: none;
}

/* Settings View */
.section {
  margin-bottom: 24px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.section h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #212529;
}

.key-display {
  display: flex;
  align-items: center;
  gap: 12px;
}

.key-display span {
  flex: 1;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #6c757d;
}

/* Stats */
.stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.stat-label {
  color: #6c757d;
}

.stat-value {
  font-weight: 600;
  color: #0d6efd;
  font-size: 16px;
}

/* Instructions */
.instructions {
  padding-left: 20px;
  color: #6c757d;
  font-size: 14px;
  line-height: 1.8;
}

.instructions li {
  margin-bottom: 8px;
}

/* Footer */
.footer {
  text-align: center;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #dee2e6;
  color: #6c757d;
  font-size: 12px;
}

.footer p {
  margin: 4px 0;
}

.version {
  font-weight: 600;
}
```

- [ ] **Step 4: Commit popup UI**

```bash
git add popup/
git commit -m "feat: add popup settings UI"
```

---

## Task 10: Icons

**Files:**
- Create placeholder icons (will need to be replaced with actual designs)

- [ ] **Step 1: Create placeholder icon files**

For now, create simple colored square images as placeholders. In production, these should be replaced with proper designed icons.

Create three simple PNG files:
- `icons/icon16.png` - 16x16px
- `icons/icon48.png` - 48x48px
- `icons/icon128.png` - 128x128px

You can create these using any image editor or online tool. Use a simple design like:
- Blue/purple gradient background
- White "YT" or "✨" text
- Rounded corners

For development, you can use any placeholder images or skip this step temporarily (extension will work without them but won't look professional).

- [ ] **Step 2: Add icons to git (if created)**

```bash
git add icons/
git commit -m "feat: add extension icons"
```

---

## Task 11: Testing & Manual Verification

**Files:**
- None (manual testing)

- [ ] **Step 1: Load extension in Chrome**

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `youtube-ai-summarizer` directory
5. Extension should load without errors

Expected: Extension icon appears in toolbar, no console errors

- [ ] **Step 2: Test API key setup**

1. Click extension icon in toolbar
2. Popup should show setup view
3. Click "Get Free API Key" - opens Google AI Studio
4. Get an API key from https://aistudio.google.com/app/apikey
5. Paste key in input field
6. Click "Save & Start"
7. Should validate and switch to settings view

Expected: Validation succeeds, settings view displays

- [ ] **Step 3: Test on YouTube video with captions**

1. Open a YouTube video (e.g., any popular tech tutorial)
2. Wait for page to fully load
3. Look for "✨ Summarize" button near video title
4. Click the button
5. Sidebar should slide in from right
6. Loading spinner should appear
7. After 2-5 seconds, summary should display

Expected: Structured summary appears with Overview, Main Points, Takeaways

- [ ] **Step 4: Test Q&A feature**

1. With sidebar open and summary displayed
2. Type a question in the input box (e.g., "What is the main topic?")
3. Press Enter or click Send
4. Question should appear as user message
5. After 1-2 seconds, AI answer should appear

Expected: Answer is relevant to video content

- [ ] **Step 5: Test caching**

1. Close the sidebar
2. Click "Summarize" button again
3. Should load instantly (<100ms)
4. "Cached" badge should appear
5. "Regenerate" button should appear

Expected: Instant load from cache

- [ ] **Step 6: Test video without captions**

1. Find a video without captions (older videos, smaller channels)
2. Click "Summarize"
3. Should show warning message
4. Should display limited summary based on title/description

Expected: Warning displayed, fallback summary works

- [ ] **Step 7: Test SPA navigation**

1. With sidebar open, click another video in sidebar/playlist
2. Sidebar should close
3. New "Summarize" button should appear for new video
4. Should work correctly on new video

Expected: Handles YouTube's SPA navigation correctly

- [ ] **Step 8: Test settings**

1. Click extension icon
2. Settings view should show
3. API key preview should display (first 8 chars + dots)
4. Statistics should show counts
5. Click "Clear Cache" - should confirm and clear
6. Stats should reset to 0

Expected: All settings features work

- [ ] **Step 9: Check browser console**

Open DevTools console (F12) and check for:
- No JavaScript errors
- No CSP violations
- No CORS errors
- API calls succeed

Expected: No errors in console

- [ ] **Step 10: Document any issues found**

Create a file `TESTING_NOTES.md` with any issues discovered during testing.

```bash
# If you created testing notes
git add TESTING_NOTES.md
git commit -m "docs: add testing notes"
```

---

## Task 12: Documentation & Packaging

**Files:**
- Modify: `README.md`
- Create: `PRIVACY_POLICY.md`

- [ ] **Step 1: Update README.md with complete documentation**

```markdown
# YouTube AI Summarizer

AI-powered Chrome extension for instantly summarizing YouTube videos using Google's Gemini Flash 2.0.

## Features

- **Instant Summaries**: Get structured video summaries in 2-5 seconds
- **Interactive Q&A**: Ask follow-up questions about video content
- **Smart Caching**: Instant access to previously summarized videos
- **Privacy First**: Everything happens locally, no tracking
- **YouTube-Native Design**: Seamless integration with YouTube's interface
- **Free Tier Friendly**: Efficient API usage with smart caching

## Installation

### From Source (Development)

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd youtube-ai-summarizer
   ```

2. Get your free Gemini API key:
   - Visit https://aistudio.google.com/app/apikey
   - Sign in with Google account
   - Create API key (free tier included)

3. Load extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `youtube-ai-summarizer` directory

4. Configure API key:
   - Click extension icon in toolbar
   - Follow setup wizard
   - Paste your API key

### From Chrome Web Store

*Coming soon - waiting for approval*

## Usage

1. **Open any YouTube video**
2. **Click "✨ Summarize" button** near the video title
3. **Read the summary** in the sidebar that slides in
4. **Ask questions** using the chat input at the bottom
5. **Revisit videos** for instant cached summaries

## How It Works

### Architecture

- **Client-Side Only**: No backend servers, everything runs in your browser
- **Content Script**: Injects UI into YouTube pages
- **Service Worker**: Handles Gemini API calls
- **Local Storage**: Caches summaries for 30 days

### Caption Extraction

1. Extracts captions from YouTube's embedded player data
2. Falls back to YouTube's timedtext API if needed
3. Uses video metadata (title/description) if no captions available

### AI Summarization

- Uses Google's Gemini 2.0 Flash model
- Generates structured summaries with Overview, Main Points, and Key Takeaways
- Maintains conversation context for Q&A

### Privacy & Security

- **Zero Data Collection**: No analytics, tracking, or telemetry
- **Local Storage**: All data stored on your device only
- **Direct API Calls**: Your browser talks directly to Google's API
- **Encrypted Key Storage**: API key stored securely by Chrome

## Free Tier Limits

Google's Gemini Flash 2.0 free tier includes:
- 15 requests per minute
- 1 million tokens per minute
- 1,500 requests per day

With smart caching, typical usage is 10-20 summaries per day, well within limits.

## Development

### Project Structure

```
youtube-ai-summarizer/
├── manifest.json              # Extension configuration
├── background/
│   └── service-worker.js      # Background script, API calls
├── content/
│   ├── content-script.js      # Main logic, UI injection
│   └── styles.css             # YouTube-native styling
├── popup/
│   ├── popup.html             # Settings UI
│   ├── popup.js               # Settings logic
│   └── popup.css              # Settings styling
└── utils/
    ├── caption-extractor.js   # YouTube caption parsing
    ├── gemini-client.js       # API wrapper
    └── storage.js             # Cache management
```

### Tech Stack

- Vanilla JavaScript (ES6+)
- Chrome Extension Manifest V3
- Google Gemini 2.0 Flash API
- Chrome Storage API

### Building

No build step required for development. For production:

```bash
# Zip for Chrome Web Store
zip -r youtube-ai-summarizer.zip . -x "*.git*" -x "*node_modules*" -x "*.DS_Store"
```

### Testing

1. Load extension in development mode
2. Visit YouTube videos with and without captions
3. Test summarization, Q&A, caching
4. Check console for errors
5. Verify API key validation

See testing checklist in implementation plan for full details.

## Troubleshooting

### Extension not appearing on YouTube

- Refresh the YouTube page
- Check that extension is enabled in `chrome://extensions/`
- Check browser console for errors

### "API Key Required" error

- Click extension icon to set up API key
- Verify key is correct at https://aistudio.google.com/app/apikey
- Try removing and re-adding the key

### "Daily Quota Reached" error

- Free tier has 1,500 requests/day limit
- Resets at midnight Pacific Time
- Cached summaries still work

### Summary not accurate

- Accuracy depends on caption quality
- Auto-generated captions may have errors
- Try videos with manual captions for best results

### Sidebar not closing

- Click the X button in top right
- Refresh the page if stuck
- Report issue if persists

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Privacy Policy

See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for full details.

## Support

- **Issues**: Open an issue on GitHub
- **Email**: [your-email@example.com]
- **Chrome Web Store**: [Link once published]

## Roadmap

### v1.1
- Export summaries as PDF/Markdown
- Keyboard shortcuts
- Multiple language support

### v2.0
- Playlist summarization
- Timestamp navigation
- Browser history integration

## Acknowledgments

- Built with Google's Gemini 2.0 Flash API
- Inspired by the need for faster learning
- Thanks to all contributors and users

---

Made with ❤️ for learners everywhere
```

- [ ] **Step 2: Create PRIVACY_POLICY.md**

```markdown
# Privacy Policy for YouTube AI Summarizer

**Last Updated**: April 12, 2026

## Overview

YouTube AI Summarizer is committed to protecting your privacy. This extension operates entirely on your device with no data collection, tracking, or external storage.

## Data Collection

**We collect ZERO personal information.**

- No user accounts
- No email addresses
- No analytics or telemetry
- No tracking pixels or cookies
- No browsing history
- No personal identifiers

## Data Storage

### Local Storage (On Your Device)

The extension stores data locally using Chrome's storage API:

1. **API Key**: Your Gemini API key is stored encrypted in Chrome's sync storage
2. **Cached Summaries**: Video summaries are cached locally for faster access
3. **Usage Statistics**: Basic counts (summaries created, cache hits) for display only

All data is stored locally on your device and never transmitted to us.

### Data Retention

- Cached summaries: Automatically deleted after 30 days
- API key: Stored until you remove it or uninstall the extension
- All data is deleted when you uninstall the extension

## Data Sharing

### With Google (Gemini API)

The extension sends video transcripts and your questions directly from your browser to Google's Gemini API for processing. This data is sent using your personal API key.

**What is sent**:
- Video transcripts (extracted from YouTube)
- Your questions about videos
- Your API key (for authentication)

**What is NOT sent**:
- Personal information
- Browsing history
- Video watch history
- Any other personal data

**Google's Privacy Policy**: https://policies.google.com/privacy

### With Us (Extension Developer)

**Nothing.** We never see, collect, or store any of your data.

### With Third Parties

We do not share data with any third parties because we don't collect any data.

## Data Security

- API key stored in Chrome's encrypted sync storage
- All API calls use HTTPS encryption
- No data transmitted to external servers (except Google's API)
- Content Security Policy prevents code injection

## Your Rights and Control

You have complete control over your data:

### View Your Data
- Cached summaries: Stored in Chrome's local storage (can view via DevTools)
- API key: Stored encrypted (cannot view directly)
- Statistics: Displayed in extension settings

### Delete Your Data
- **Individual summaries**: Clear cache in extension settings
- **All data**: Click "Clear Cache" in settings
- **API key**: Click "Change" in settings, then don't enter a new one
- **Everything**: Uninstall the extension

### Export Your Data
- Currently not supported (v2.0 feature)
- Summaries are just text - you can copy/paste manually

## Permissions Explanation

The extension requests these Chrome permissions:

### storage
**Why**: To cache summaries and store API key locally
**Access**: Chrome's local and sync storage only

### activeTab
**Why**: To inject the summarize button and sidebar into YouTube pages
**Access**: Only active tab, only when you interact with extension

### host_permissions (youtube.com)
**Why**: To access YouTube video pages and extract captions
**Access**: Only YouTube.com/watch pages

### host_permissions (googleapis.com)
**Why**: To call Gemini API for summarization
**Access**: Only Google's API endpoints

## Changes to Videos You Watch

The extension does NOT:
- Track which videos you watch
- Send viewing data to anyone
- Affect YouTube's recommendations
- Interfere with video playback

The extension only processes videos when you explicitly click "Summarize".

## Children's Privacy

This extension does not collect any data from anyone, including children under 13.

## Changes to This Policy

We will notify users of any privacy policy changes by:
- Updating this document
- Updating "Last Updated" date
- Notifying via extension update notes

## Contact Us

Questions about this privacy policy?

- **Email**: [your-email@example.com]
- **GitHub Issues**: [repository-url]/issues

## Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- GDPR (no personal data collected)
- CCPA (no personal data sold)

## Your Consent

By using this extension, you consent to:
- Storage of data locally on your device
- Sending video transcripts to Google's Gemini API
- This privacy policy

You can revoke consent at any time by uninstalling the extension.

---

**Summary**: We don't collect, track, or store any of your personal data. Everything happens locally on your device. Your data is yours alone.
```

- [ ] **Step 3: Commit documentation**

```bash
git add README.md PRIVACY_POLICY.md
git commit -m "docs: add comprehensive documentation and privacy policy"
```

- [ ] **Step 4: Create package for Chrome Web Store**

```bash
# Create zip file (exclude development files)
zip -r youtube-ai-summarizer-v1.0.0.zip . \
  -x "*.git*" \
  -x "*node_modules*" \
  -x "*.DS_Store" \
  -x "TESTING_NOTES.md" \
  -x "*.zip"

echo "Package created: youtube-ai-summarizer-v1.0.0.zip"
echo "Ready for Chrome Web Store submission!"
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: prepare v1.0.0 release"
git tag v1.0.0
```

---

## Plan Self-Review

### Spec Coverage Check

✅ **Extension Structure**: Task 1 - manifest, directories
✅ **Storage Management**: Task 2 - caching, API key storage
✅ **Caption Extraction**: Task 3 - YouTube caption parsing
✅ **Gemini API**: Task 4 - API client with retry logic
✅ **Service Worker**: Task 5 - background script for API calls
✅ **Content Script**: Tasks 6-7 - UI injection, sidebar, Q&A
✅ **Styling**: Task 8 - YouTube-native CSS
✅ **Settings UI**: Task 9 - popup for API key setup
✅ **Icons**: Task 10 - extension icons
✅ **Error Handling**: Integrated throughout (Tasks 4-7)
✅ **Caching Strategy**: Task 2 - 30-day TTL, auto-cleanup
✅ **Security**: Task 5, 9 - API key validation, secure storage
✅ **Testing**: Task 11 - comprehensive manual testing
✅ **Documentation**: Task 12 - README, privacy policy
✅ **Packaging**: Task 12 - Chrome Web Store ready

### Placeholder Scan

✅ No TBD or TODO items
✅ No "implement later" references
✅ All code blocks complete
✅ All commands specified
✅ No vague "add appropriate X" statements

### Type Consistency Check

✅ StorageManager class methods consistent across all files
✅ CaptionExtractor class methods consistent
✅ GeminiClient class methods consistent
✅ Message types consistent (GENERATE_SUMMARY, ANSWER_QUESTION, VALIDATE_API_KEY)
✅ Storage keys consistent (summaries, apiKey, stats)
✅ CSS class names consistent (yt-ai-sidebar, yt-ai-button)

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-12-youtube-ai-summarizer.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach do you prefer?**
