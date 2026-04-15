# YouTube AI Summarizer

AI-powered Chrome extension using Gemini Flash 2.0 to instantly summarize and interact with YouTube videos.

## Features

- ✨ **One-Click Summaries** - Get AI-generated summaries of any YouTube video
- 💬 **Interactive Q&A** - Ask questions about the video content
- 📝 **Caption Extraction** - Works with videos that have captions/subtitles
- 🎨 **YouTube-Native Design** - Seamless integration with YouTube's interface
- 💾 **Smart Caching** - 30-day cache with 4MB size management
- 🔄 **Metadata Fallback** - Basic summaries even without captions
- 🌙 **Dark Mode Support** - Automatic theme matching
- 🔒 **Client-Side Only** - No backend required, works with free Gemini API

## Installation

### For Development

1. **Clone the repository:**
   ```bash
   git clone git@github.com:rajat85/youtube-ai-summarizer.git
   cd youtube-ai-summarizer
   ```

2. **Load in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the extension directory

3. **Set up API key:**
   - Click the extension icon
   - Enter your [Gemini API key](https://makersuite.google.com/app/apikey)
   - Click "Save"

### For Users

*Coming soon: Chrome Web Store link*

## Usage

1. **Open any YouTube video**
2. **Click the "✨ Summarize" button** next to Like/Dislike
3. **View the AI-generated summary** in the sidebar
4. **Ask questions** about the video in the chat box
5. **Regenerate** summaries or clear cache as needed

## Demo Recording

Want to create a demo video? See [DEMO_RECORDING.md](DEMO_RECORDING.md) for automated demo recording setup.

Quick start:
```bash
./setup-demo.sh
export GEMINI_API_KEY="your-key-here"
npm run demo:short
```

## Project Structure

```
youtube-ai-summarizer/
├── background/
│   └── service-worker.js      # Background service worker for API calls
├── content/
│   ├── content-script.js      # Main content script (UI & interactions)
│   └── styles.css             # YouTube-native styling
├── popup/
│   ├── popup.html             # Extension popup
│   ├── popup.js               # Popup logic
│   └── popup.css              # Popup styling
├── utils/
│   ├── caption-extractor.js   # YouTube caption extraction
│   ├── caption-fetch-helper.js # CORS bypass helper
│   ├── gemini-client.js       # Gemini API wrapper
│   └── storage.js             # Chrome storage manager
├── icons/                     # Extension icons
├── manifest.json              # Extension manifest
└── demo-recorder.js           # Automated demo recording
```

## Key Technologies

- **Gemini Flash 2.0** - Google's latest fast AI model
- **Chrome Extension Manifest V3** - Latest extension format
- **Content Scripts** - JavaScript injection into YouTube pages
- **Service Workers** - Background API communication
- **Chrome Storage API** - Local caching and settings
- **Playwright** - Automated demo recording

## Technical Highlights

### Caption Extraction
- Extracts from `ytInitialPlayerResponse` (DOM parsing)
- CORS bypass via page context injection
- Fallback to timedtext API
- Supports multiple languages (prioritizes English)

### Smart Caching
- 30-day TTL per video
- 4MB size threshold with automatic cleanup
- LRU-style old entry removal
- Separate storage for metadata vs transcript summaries

### Q&A System
- **Transcript-based Q&A** - Full video content as context
- **Metadata fallback** - Works without captions using title/description
- **Rolling context window** - Keeps last 10 Q&A pairs
- **Context hints** - Shows remaining context slots

### Security
- XSS protection with HTML entity escaping
- Input validation and sanitization
- Safe DOM manipulation
- No external dependencies except Gemini API

## Configuration

### API Limits (Free Tier)
- **15 requests per minute**
- **1,500 requests per day**
- **1 million tokens per month**

The extension handles rate limiting gracefully with exponential backoff.

### Storage Limits
- **Chrome Storage Local**: ~10MB (used for caching)
- **Chrome Storage Sync**: ~100KB (used for API key)

## Development

### Prerequisites
- Node.js (for demo recording only)
- Chrome/Chromium browser
- Gemini API key

### Testing
1. Load extension in Chrome (Developer mode)
2. Open a YouTube video with captions
3. Click Summarize button
4. Test Q&A feature
5. Check console for logs

### Debugging
- **Content Script logs**: F12 on YouTube page → Console
- **Service Worker logs**: `chrome://extensions` → Extension details → Service worker → Inspect
- **Extension popup logs**: Right-click extension icon → Inspect popup

## Known Limitations

- Requires videos to have captions/subtitles for full functionality
- Metadata-only summaries are less detailed
- Free tier API has daily request limits
- English language prioritized for captions

## Troubleshooting

### Button doesn't appear
- Refresh the YouTube page
- Reload the extension
- Check if content script is running (console logs)

### "No captions available"
- Video doesn't have captions/subtitles
- You'll get a limited metadata-based summary
- Questions will work with metadata context

### API errors
- Check your API key is valid
- Verify you haven't exceeded daily quota
- Check network connectivity
- See service worker console for details

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Author

**Rajat Subhra Ghosh**
- GitHub: [@rajat85](https://github.com/rajat85)
- Email: rajat85_it@yahoo.co.in

## Acknowledgments

- Google Gemini API for AI capabilities
- YouTube for the amazing platform
- Chrome Extensions team for the framework
- TED Talks for demo videos

---

**⭐ Star this repo if you find it useful!**
