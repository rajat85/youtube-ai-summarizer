# Demo Recording Setup

Automated demo recording for the YouTube AI Summarizer Chrome Extension using Playwright.

## Quick Start

### 1. Install Dependencies

```bash
npm install
npm run install-browsers
```

### 2. Set Your API Key

```bash
export GEMINI_API_KEY="your-gemini-api-key-here"
```

Or edit `demo-recorder.js` and set it directly in the CONFIG object.

### 3. Record a Demo

**Short demo (2-3 minutes):**
```bash
npm run demo:short
```

**Full demo (5-7 minutes):**
```bash
npm run demo:full
```

## What Gets Recorded

### Short Demo
- Opens YouTube video
- Clicks Summarize button
- Shows generated summary
- Asks 2 questions
- Demonstrates Q&A feature
- Closes sidebar

### Full Demo
- All of the above, plus:
- Button highlighting
- Summary scrolling
- 4 questions to show rolling context window
- Regenerate feature demonstration
- Context hint display

## Output

Videos are saved to `demo-videos/` directory in WebM format.

## Customization

Edit `demo-recorder.js` to customize:

### Videos Used
```javascript
videos: {
  short: 'https://www.youtube.com/watch?v=VIDEO_ID',
  full: 'https://www.youtube.com/watch?v=VIDEO_ID',
}
```

### Timing
```javascript
timing: {
  pageLoad: 5000,          // Wait for YouTube to load
  buttonAppear: 3000,      // Wait after button appears
  summaryGenerate: 15000,  // Wait for summary generation
  questionAnswer: 10000,   // Wait for answer generation
  transition: 2000,        // Wait between actions
}
```

### Questions Asked
```javascript
const questions = [
  'What is the main topic discussed?',
  'Can you elaborate on the key points?',
  // Add more questions...
];
```

## Troubleshooting

### "API key not set" error
Make sure you've exported your API key:
```bash
export GEMINI_API_KEY="your-key-here"
```

### Extension not loading
Verify the extension path in the script matches your directory structure.

### Video quality
Videos are recorded at 1920x1080. Adjust in `CONFIG.viewport`:
```javascript
viewport: { width: 1920, height: 1080 },
```

### Timing issues
If the script moves too fast or slow, adjust the timing values in the CONFIG object.

## Converting to MP4

Playwright records in WebM format. To convert to MP4:

```bash
# Using ffmpeg
ffmpeg -i demo-videos/video-*.webm -c:v libx264 -c:a aac output.mp4
```

## Manual Recording Alternative

If automated recording doesn't work:

1. Install **OBS Studio** (free)
2. Load your extension in Chrome
3. Record your screen manually
4. Follow these steps:
   - Open YouTube video
   - Click Summarize
   - Show summary
   - Ask questions
   - Demonstrate features

## Tips for Better Demos

1. **Use videos with captions** - Shows the full power of the extension
2. **Choose short videos** - Faster summary generation for demos
3. **Test your API key first** - Make sure it's working before recording
4. **Close other tabs** - Cleaner recording
5. **Disable notifications** - No interruptions during recording

## Advanced: CI/CD Integration

You can integrate this into your CI/CD pipeline:

```yaml
# .github/workflows/demo-video.yml
name: Generate Demo Video

on:
  push:
    tags:
      - 'v*'

jobs:
  record-demo:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run install-browsers
      - run: GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }} npm run demo:short
      - uses: actions/upload-artifact@v3
        with:
          name: demo-video
          path: demo-videos/
```
