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
