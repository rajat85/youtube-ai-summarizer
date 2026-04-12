# Testing Guide - YouTube AI Summarizer

## Prerequisites

1. Google Chrome browser
2. Gemini API key (free tier) from https://aistudio.google.com/app/apikey

## Installation Steps

### 1. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top right corner)
3. Click **"Load unpacked"**
4. Select this directory: `/Users/rajat.ghosh/projects/rnd/eag_v3_2_0`
5. Extension should appear in the list

**Expected Result**: Extension loads without errors, icon appears in toolbar

### 2. Configure API Key

1. Click the extension icon in Chrome toolbar
2. You should see the "Welcome! 👋" setup screen
3. Click **"Get Free API Key"** button (opens https://aistudio.google.com/app/apikey)
4. Sign in with your Google account
5. Create a new API key or copy existing one
6. Return to the extension popup
7. Paste your API key in the password field
8. Click **"Save & Start"**
9. Wait for validation (2-3 seconds)

**Expected Result**:
- Button shows "Validating..." during check
- Switches to Settings view on success
- Shows error message if key is invalid

## Test Cases

### Test 1: Basic Summarization (Videos with Captions)

1. Open a popular YouTube video with captions (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ)
2. Wait for page to fully load
3. Look for **"✨ Summarize"** button near the video title (below or beside the title)
4. Click the button

**Expected Result**:
- Sidebar slides in from the right
- Loading spinner appears with "Generating summary..." text
- After 2-5 seconds, a structured summary appears with:
  - 📝 Overview section
  - 🔑 Main Points (bullet list)
  - 💡 Key Takeaways (bullet list)

**Troubleshooting**:
- If button doesn't appear: Refresh the page
- If spinner stays forever: Check browser console (F12) for errors
- If error message appears: Check your API key in extension settings

### Test 2: Q&A Feature

1. With the sidebar open and summary displayed
2. Scroll to the bottom of the sidebar
3. Type a question in the text input (e.g., "What is the main topic of this video?")
4. Press Enter or click the Send button

**Expected Result**:
- Your question appears as a blue message bubble (right-aligned)
- Gray loading message appears briefly
- AI answer appears as a gray message bubble (left-aligned)
- Answer is relevant to the video content

**Try These Questions**:
- "Summarize in one sentence"
- "What are the key points?"
- "Who is this video for?"
- "What should I do next?"

### Test 3: Caching

1. Close the sidebar (click X button)
2. Click **"✨ Summarize"** button again
3. Note the speed

**Expected Result**:
- Summary appears **instantly** (< 100ms)
- "📦 From Cache" badge appears at the top
- A "🔄 Regenerate" button appears

4. Click the **"🔄 Regenerate"** button
5. Wait for new summary

**Expected Result**:
- Cache is cleared for this video
- New API call is made
- Fresh summary generated (takes 2-5 seconds)
- No cache badge this time

### Test 4: Videos Without Captions

1. Find a video without captions (try older videos or small channels)
   - Or use this test video: [find one without captions]
2. Click **"✨ Summarize"** button

**Expected Result**:
- Shows loading spinner
- After processing, displays:
  - ⚠️ Warning message: "Limited Summary (No Captions Available)"
  - Summary based on title, description, and top comments
  - Note explaining the limitation

### Test 5: SPA Navigation (YouTube Video Changes)

1. With sidebar open, click another video from:
   - Suggested videos panel on the right
   - Playlist (if video is in playlist)
   - Channel page
2. Observe behavior

**Expected Result**:
- Sidebar automatically closes
- URL changes to new video
- New **"✨ Summarize"** button appears for the new video
- Button works correctly for the new video

### Test 6: Extension Settings

1. Click extension icon in toolbar
2. You should see the Settings view with:
   - API Key preview (first 8 characters + dots)
   - Statistics: Total Summaries, Cache Hits, API Calls
   - Clear Cache button
   - How to Use instructions

**Check**:
- [ ] API key shows correct preview
- [ ] Stats show non-zero values after testing
- [ ] Cache Hits should equal or less than Total Summaries

3. Click **"Change"** button next to API key
4. Should return to setup view

5. Return to Settings (paste API key again)
6. Click **"Clear Cache"** button
7. Confirm the dialog

**Expected Result**:
- Confirmation dialog appears
- After confirming, stats reset to 0
- Alert shows "Cache cleared successfully!"

### Test 7: Error Handling

**Test Invalid API Key**:
1. Click extension icon → Settings → Change
2. Enter a random string as API key
3. Click "Save & Start"

**Expected Result**: Error message "Invalid API key..."

**Test No Internet**:
1. Disconnect from internet
2. Try to summarize a new video (not cached)

**Expected Result**: Error message about connection issues

**Test API Quota Exceeded** (if you hit the limit):
1. Try to summarize after hitting free tier limit

**Expected Result**: Error message explaining quota exceeded

### Test 8: Browser Console Check

1. Open Chrome DevTools (F12)
2. Go to the Console tab
3. Perform Test Cases 1-7 above
4. Monitor for errors

**Expected Result**:
- No JavaScript errors
- No CSP (Content Security Policy) violations
- No CORS errors
- Only informational logs from the extension

**Common Log Messages** (these are OK):
- "YouTube AI Summarizer installed"
- "Retry X/3 after Yms" (during API retries)
- Info about cache hits/misses

## Performance Benchmarks

| Metric | Expected | Good | Needs Attention |
|--------|----------|------|-----------------|
| First summary (no cache) | 2-5s | < 3s | > 7s |
| Cached summary | < 100ms | < 50ms | > 500ms |
| Q&A response | 1-3s | < 2s | > 5s |
| Button injection | Immediate | < 1s | > 2s |

## Known Issues & Limitations

1. **No Captions**: Some videos don't have captions. Extension falls back to metadata but quality is lower.

2. **Very Long Videos** (> 3 hours): May hit token limits. Summary might be truncated.

3. **Live Streams**: Captions may not be available or may be incomplete.

4. **YouTube Shorts**: May not work on Shorts URLs (different page structure).

5. **Private/Unlisted Videos**: Should work if you have access, but metadata may be limited.

6. **Free Tier Limits**: Gemini free tier has rate limits (15 requests/minute, 1500 requests/day).

## Reporting Issues

If you find bugs or issues:

1. Check browser console for errors (F12)
2. Note the video URL where issue occurred
3. Note any error messages displayed
4. Create a note in `TESTING_NOTES.md`

## Success Criteria

✅ Extension loads without errors
✅ API key validation works
✅ Summaries generate correctly
✅ Q&A feature responds appropriately
✅ Caching works instantly
✅ No JavaScript errors in console
✅ UI matches YouTube's design
✅ Handles videos without captions gracefully
✅ Settings persist across browser sessions

## Next Steps After Testing

1. Create actual icon files (currently optional)
2. Package extension for Chrome Web Store (optional)
3. Add more documentation (PRIVACY_POLICY.md, etc.)

---

**Happy Testing! 🎉**

If everything works as expected, the extension is ready for personal use or Chrome Web Store submission!
