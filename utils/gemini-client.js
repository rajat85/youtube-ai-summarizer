// utils/gemini-client.js
// Wrapper for Gemini API calls

class GeminiClient {
  static API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
  static MAX_RETRIES = 3;

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

  static QA_METADATA_PROMPT = `You are an AI assistant helping users understand a YouTube video. No transcript is available. You only have public metadata (title, channel, description, a few comments) and an AI-generated summary that may be incomplete.

Guidelines:
- Answer from this limited context only; do not invent specific quotes or timestamps
- When the information is not in the metadata or summary, say clearly that you cannot tell from what is available
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
   * Build initial QA context message (transcript or metadata-only).
   * @param {{ transcript?: string, metadata?: Object, summaryContext?: string }} ctx
   * @returns {{ userText: string, modelAck: string }}
   */
  static buildQAContextParts(ctx) {
    const transcript = (ctx.transcript || '').trim();
    if (transcript) {
      return {
        userText: `${this.QA_SYSTEM_PROMPT}\n\nVideo Transcript:\n${transcript}`,
        modelAck: 'I understand. I have the transcript and will answer questions based on it.'
      };
    }

    const m = ctx.metadata || {};
    const comments = Array.isArray(m.comments) && m.comments.length
      ? m.comments.join('\n')
      : '(none)';
    const summaryBlock = (ctx.summaryContext || '').trim() || '(no summary available)';

    const userText = `${this.QA_METADATA_PROMPT}

Title: ${m.title || '(unknown)'}
Channel: ${m.channelName || '(unknown)'}
Description:
${m.description || '(none)'}

Top comments:
${comments}

Prior AI summary (may be incomplete):
${summaryBlock}`;

    return {
      userText,
      modelAck: 'I understand. I only have metadata and the summary, and I will not invent details beyond that.'
    };
  }

  /**
   * Answer question about video (transcript and/or metadata + summary context).
   * @param {string} apiKey - Gemini API key
   * @param {string} question - User question
   * @param {Array} conversationHistory - Previous messages
   * @param {{ transcript?: string, metadata?: Object, summaryContext?: string }} context
   * @returns {Promise<string>} Answer text
   */
  static async answerQuestion(apiKey, question, conversationHistory = [], context = {}) {
    const { userText, modelAck } = this.buildQAContextParts(context);

    const contents = [
      { role: 'user', parts: [{ text: userText }] },
      { role: 'model', parts: [{ text: modelAck }] }
    ];

    conversationHistory.forEach(msg => {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    });

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
  static async callAPI(apiKey, requestBody, retries = GeminiClient.MAX_RETRIES) {
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
            throw new Error(`API_ERROR: ${response.status} ${errorData?.error?.message || response.statusText}`);
          }
        }

        const data = await response.json();

        // Log response for debugging
        console.log('Gemini API response:', JSON.stringify(data, null, 2));

        if (!data.candidates || data.candidates.length === 0) {
          console.error('No candidates in response:', data);
          throw new Error('No response from API');
        }

        // Validate response structure with defensive checks
        const candidate = data.candidates?.[0];
        console.log('Candidate structure:', JSON.stringify(candidate, null, 2));

        const finishReason = candidate?.finishReason;

        // Check for content safety filter
        if (finishReason === 'SAFETY') {
          throw new Error('CONTENT_FILTERED');
        }

        // Check for max tokens truncation
        if (finishReason === 'MAX_TOKENS') {
          console.warn('Response truncated due to max tokens. Consider increasing maxOutputTokens.');
        }

        const text = candidate?.content?.parts?.[0]?.text;
        if (!text) {
          console.error('Invalid response structure. Full candidate:', JSON.stringify(candidate, null, 2));
          console.error('Content:', candidate?.content);
          console.error('Parts:', candidate?.content?.parts);
          console.error('Finish reason:', finishReason);

          if (finishReason === 'MAX_TOKENS') {
            throw new Error('Response truncated - token limit too low');
          }
          throw new Error('Invalid API response structure');
        }

        // Track API call stats
        try {
          if (typeof StorageManager !== 'undefined') {
            await StorageManager.updateStats('api_call');
          }
        } catch (statsError) {
          console.warn('Failed to update stats:', statsError);
        }

        return text;
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
