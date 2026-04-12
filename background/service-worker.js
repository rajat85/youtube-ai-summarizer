// background/service-worker.js
// Background script for handling API calls

// Import Gemini client
importScripts('../utils/gemini-client.js');
importScripts('../utils/storage.js');

/**
 * Get API key from storage
 * @returns {Promise<string>} API key
 * @throws {Error} If API key is missing
 */
async function getApiKey() {
  const result = await chrome.storage.sync.get('apiKey');
  if (!result.apiKey) {
    throw new Error('API_KEY_MISSING');
  }
  return result.apiKey;
}

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
  } else {
    sendResponse({ error: 'UNKNOWN_MESSAGE_TYPE' });
    return false; // Don't keep channel open
  }
});

/**
 * Handle summary generation request
 */
async function handleGenerateSummary(message, sendResponse) {
  try {
    // Get API key
    const apiKey = await getApiKey();

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
    // Validate required fields
    if (!message.transcript || !message.question) {
      sendResponse({ error: 'MISSING_REQUIRED_FIELDS' });
      return;
    }

    // Get API key
    const apiKey = await getApiKey();

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
    // Validate required fields
    if (!message.apiKey) {
      sendResponse({ error: 'MISSING_REQUIRED_FIELDS' });
      return;
    }

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
