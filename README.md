# YouTube AI Summarizer

A Chrome extension that uses Google Gemini to summarize any YouTube watch page and answer follow-up questions from the transcript (or from metadata when captions are not available).

## Features

- **AI-powered summaries**: Uses Gemini (`gemini-flash-latest`) with structured overview, main points, and takeaways
- **Interactive Q&A**: Ask questions grounded in the video transcript or available metadata
- **Caption-aware**: Extracts captions when present; falls back to title, description, and comments when not
- **Secure & private**: Your API key stays in Chrome storage; no separate backend
- **YouTube-native UI**: Summarize control alongside the watch page; sidebar for results and chat
- **Smart caching**: Local cache with TTL and size management to reduce repeat API calls
- **Free tier friendly**: Works with the standard Gemini free quota for personal use

## Installation

### Step 1: Get a Free Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API key**
4. Copy the generated API key (typically starts with `AIza...`)

### Step 2: Install the Extension

1. Download or clone this repository:
   ```bash
   git clone https://github.com/rajat85/youtube-ai-summarizer.git
   cd youtube-ai-summarizer
   ```

2. Open Chrome and go to `chrome://extensions`

3. Turn on **Developer mode** (toggle in the top-right)

4. Click **Load unpacked**

5. Select this project folder (the one containing `manifest.json`)

6. Confirm **YouTube AI Summarizer** appears in your extensions list

### Step 3: Configure API Key

1. Click the extension icon in the Chrome toolbar (or open the extension popup from the puzzle menu)
2. Paste your Gemini API key
3. Save the key using the popup UI

You can now use the extension on supported YouTube URLs.

## Usage

### Demo video

[![YouTube AI Summarizer demo](https://img.youtube.com/vi/Utlc72-O_o0/maxresdefault.jpg)](https://youtu.be/Utlc72-O_o0)

**Click the thumbnail above to watch the extension in action.**

### How to use

1. Open a YouTube **watch** page on `www.youtube.com` (standard `watch?v=...` URLs)
2. Click the **✨ Summarize** button injected near the player actions (like/dislike area)
3. Wait for the summary to appear in the sidebar
4. Use the chat area to ask questions about the video; regenerate or clear cache from the UI when needed

### What you'll see

- A sidebar with structured summary sections (overview, main points, takeaways)
- A Q&A area for follow-up questions about the video

## Supported sites

- `https://www.youtube.com/watch?*` (watch pages only; other YouTube surfaces are out of scope for the content script)

## Privacy & security

- **No dedicated analytics**: The extension is designed for local use with your own API key
- **Local storage**: Settings and cache use Chrome extension storage APIs
- **Direct API calls**: Requests go from your browser to Google’s Generative Language API as configured in the manifest
- **Open source**: You can review all scripts in this repository

## API usage & limits

Typical Gemini free-tier limits (check [Google AI pricing](https://ai.google.dev/pricing) for current numbers) include per-minute and per-day caps. The client uses retries with backoff for transient errors. For heavy use, space out summarization requests.

## Troubleshooting

### Summarize control does not appear

- Confirm the URL is a `www.youtube.com/watch?...` page and reload the tab
- On `chrome://extensions`, ensure the extension is enabled and try **Reload** on the extension card

### “No captions” or weak summaries

- Some videos have no captions; the extension falls back to metadata-based context, which is less detailed than transcript-based summaries

### Invalid API key or quota errors

- Verify the key from [Google AI Studio](https://aistudio.google.com/app/apikey) and save it again in the popup
- Check quota and billing settings in Google AI / Cloud console if you use paid tiers

### Analysis fails or times out

- Check your network connection
- Reload the watch page and try again
- Inspect the service worker log: `chrome://extensions` → **Service worker** → **Inspect** for the extension

## Development

### Project structure

```
youtube-ai-summarizer/
├── manifest.json              # Extension manifest (MV3)
├── background/
│   └── service-worker.js      # Background worker (API orchestration)
├── content/
│   ├── content-script.js      # Watch-page UI and logic
│   └── styles.css             # Injected styles
├── popup/
│   ├── popup.html             # Popup / options surface
│   ├── popup.js
│   └── popup.css
├── utils/
│   ├── caption-extractor.js   # Caption / player data extraction
│   ├── caption-fetch-helper.js
│   ├── gemini-client.js       # Gemini API wrapper
│   └── storage.js             # Storage helpers
├── icons/                     # Extension icons
├── demo-recorder.js           # Optional Playwright demo recorder entry
├── scripts/
│   └── playwright-demo.mjs    # Playwright demo script
├── package.json               # Demo tooling dependencies
└── README.md                  # This file
```

### Local development

1. Edit the source files above
2. Open `chrome://extensions` and click **Reload** on the extension tile
3. Reload any open YouTube watch tab and exercise summarize / Q&A flows

### Automated demo recording (optional)

For scripted demos with Playwright:

```bash
npm install
npx playwright install chromium
export GEMINI_API_KEY="your-key-here"
npm run demo:short
```

Adjust scripts in `demo-recorder.js` / `scripts/playwright-demo.mjs` to match your recording scenario.

### Building

No bundler is required for the extension itself; load the folder as unpacked. Node.js is only needed for optional demo automation.

## Contributing

Contributions are welcome.

1. Fork the repository  
2. Create a feature branch  
3. Make focused changes with manual testing on real watch pages  
4. Open a pull request describing behavior and test notes  

## License

MIT License — use, modify, and distribute according to the license terms in this repository.

## Disclaimer

This project is not affiliated with or endorsed by YouTube, Google, or Alphabet. It is an independent tool. AI-generated text can be wrong or incomplete; treat summaries and answers as one input among many when deciding what to trust or act on.

## Support

If something breaks, please [open an issue](https://github.com/rajat85/youtube-ai-summarizer/issues) with:

- Chrome version  
- Extension version from `manifest.json`  
- Example watch URL (if shareable)  
- Any errors from the page console or the extension service worker console  

---

Made to make long videos easier to skim and discuss.
