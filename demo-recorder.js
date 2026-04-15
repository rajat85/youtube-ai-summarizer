// demo-recorder.js
// Automated demo recording for YouTube AI Summarizer Chrome Extension

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Configuration
const CONFIG = {
  extensionPath: path.resolve(__dirname),
  videosDir: path.join(__dirname, 'demo-videos'),
  viewport: { width: 1920, height: 1080 },
  
  // Demo videos to use
  videos: {
    short: 'https://www.youtube.com/watch?v=VOC44gKRTI4', // TED Talk - 15 min
    full: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',  // Example
  },
  
  // Your Gemini API key (set via environment variable or here)
  apiKey: process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE',
  
  // Timing configuration (in milliseconds)
  timing: {
    pageLoad: 5000,
    buttonAppear: 3000,
    summaryGenerate: 15000,
    questionAnswer: 10000,
    transition: 2000,
  }
};

// Ensure videos directory exists
if (!fs.existsSync(CONFIG.videosDir)) {
  fs.mkdirSync(CONFIG.videosDir, { recursive: true });
}

/**
 * Wait with logging
 */
async function wait(ms, message) {
  if (message) {
    console.log(`⏳ ${message} (${ms}ms)`);
  }
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Setup API key in extension storage
 */
async function setupApiKey(context) {
  console.log('🔑 Setting up API key...');
  
  // Create a page to access extension popup
  const pages = context.pages();
  const page = pages[0] || await context.newPage();
  
  // Navigate to extension popup (you'll need the extension ID)
  // For now, we'll set it via a direct script injection
  await page.evaluate((apiKey) => {
    chrome.storage.sync.set({ apiKey: apiKey });
  }, CONFIG.apiKey);
  
  console.log('✅ API key configured');
}

/**
 * Record short demo (2-3 minutes)
 */
async function recordShortDemo(context) {
  console.log('\n📹 Recording SHORT DEMO\n');
  
  const page = await context.newPage();
  await page.setViewportSize(CONFIG.viewport);
  
  // Navigate to YouTube video
  console.log('🎬 Opening YouTube video...');
  await page.goto(CONFIG.videos.short);
  await wait(CONFIG.timing.pageLoad, 'Waiting for page to load');
  
  // Wait for and click Summarize button
  console.log('🔍 Waiting for Summarize button...');
  await page.waitForSelector('#yt-ai-summarize-btn', { timeout: 15000 });
  await wait(CONFIG.timing.buttonAppear, 'Button visible, preparing to click');
  
  console.log('👆 Clicking Summarize button...');
  await page.click('#yt-ai-summarize-btn');
  
  // Wait for summary to generate
  await wait(CONFIG.timing.summaryGenerate, 'Generating summary');
  
  // Wait for sidebar to be visible
  await page.waitForSelector('.yt-ai-sidebar.open', { timeout: 20000 });
  console.log('✅ Summary generated and displayed');
  
  await wait(3000, 'Showing summary content');
  
  // Ask first question
  console.log('💬 Asking first question...');
  await page.fill('#chat-input', 'What is the main message of this video?');
  await page.click('#send-btn');
  await wait(CONFIG.timing.questionAnswer, 'Getting answer');
  
  await wait(2000, 'Showing answer');
  
  // Ask second question
  console.log('💬 Asking second question...');
  await page.fill('#chat-input', 'What are the key takeaways?');
  await page.click('#send-btn');
  await wait(CONFIG.timing.questionAnswer, 'Getting answer');
  
  await wait(2000, 'Showing answer');
  
  // Close sidebar
  console.log('👋 Closing sidebar...');
  await page.click('.close-btn');
  await wait(2000, 'Demo complete');
  
  console.log('✅ Short demo recording complete!');
  
  return page;
}

/**
 * Record full demo (5-7 minutes)
 */
async function recordFullDemo(context) {
  console.log('\n📹 Recording FULL DEMO\n');
  
  const page = await context.newPage();
  await page.setViewportSize(CONFIG.viewport);
  
  // Navigate to YouTube video
  console.log('🎬 Opening YouTube video...');
  await page.goto(CONFIG.videos.short);
  await wait(CONFIG.timing.pageLoad, 'Waiting for page to load');
  
  // Show the extension button
  console.log('🔍 Highlighting Summarize button...');
  await page.waitForSelector('#yt-ai-summarize-btn', { timeout: 15000 });
  await wait(CONFIG.timing.buttonAppear, 'Button visible');
  
  // Highlight the button with a red border (for demo visibility)
  await page.evaluate(() => {
    const btn = document.getElementById('yt-ai-summarize-btn');
    if (btn) {
      btn.style.outline = '3px solid #ff0000';
      btn.style.outlineOffset = '2px';
    }
  });
  
  await wait(2000, 'Showing button highlight');
  
  // Remove highlight and click
  await page.evaluate(() => {
    const btn = document.getElementById('yt-ai-summarize-btn');
    if (btn) btn.style.outline = 'none';
  });
  
  console.log('👆 Clicking Summarize button...');
  await page.click('#yt-ai-summarize-btn');
  
  // Wait for summary
  await wait(CONFIG.timing.summaryGenerate, 'Generating summary');
  await page.waitForSelector('.yt-ai-sidebar.open', { timeout: 20000 });
  console.log('✅ Summary displayed');
  
  await wait(4000, 'Reviewing summary');
  
  // Scroll through summary
  console.log('📜 Scrolling through summary...');
  await page.evaluate(() => {
    const content = document.querySelector('.sidebar-content');
    if (content) {
      content.scrollBy({ top: 200, behavior: 'smooth' });
    }
  });
  await wait(2000);
  
  // Ask multiple questions to show rolling context
  const questions = [
    'What is the main topic discussed?',
    'Can you elaborate on the key points?',
    'What examples are mentioned?',
    'How does this relate to everyday life?',
  ];
  
  for (const [index, question] of questions.entries()) {
    console.log(`💬 Question ${index + 1}/${questions.length}: ${question}`);
    await page.fill('#chat-input', question);
    await page.click('#send-btn');
    await wait(CONFIG.timing.questionAnswer, 'Getting answer');
    await wait(2000, 'Showing answer');
  }
  
  // Show context hint
  console.log('ℹ️  Showing context window information...');
  await wait(3000);
  
  // Try regenerate
  console.log('🔄 Testing Regenerate feature...');
  await page.click('.regenerate-btn');
  await wait(CONFIG.timing.summaryGenerate, 'Regenerating summary');
  
  await wait(3000, 'Showing regenerated summary');
  
  // Close sidebar
  console.log('👋 Closing sidebar...');
  await page.click('.close-btn');
  await wait(2000, 'Demo complete');
  
  console.log('✅ Full demo recording complete!');
  
  return page;
}

/**
 * Main demo recorder
 */
async function main() {
  const demoType = process.argv[2] || 'short';
  
  console.log('🎬 YouTube AI Summarizer - Demo Recorder');
  console.log('==========================================\n');
  
  // Validate API key
  if (CONFIG.apiKey === 'YOUR_API_KEY_HERE') {
    console.error('❌ ERROR: Please set your Gemini API key!');
    console.log('Set it via: export GEMINI_API_KEY="your-key-here"');
    process.exit(1);
  }
  
  console.log(`📹 Recording ${demoType.toUpperCase()} demo`);
  console.log(`📁 Extension path: ${CONFIG.extensionPath}`);
  console.log(`💾 Videos will be saved to: ${CONFIG.videosDir}\n`);
  
  // Launch browser with extension
  console.log('🚀 Launching Chrome with extension...');
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${CONFIG.extensionPath}`,
      `--load-extension=${CONFIG.extensionPath}`,
      '--start-maximized',
    ],
    viewport: CONFIG.viewport,
    recordVideo: {
      dir: CONFIG.videosDir,
      size: CONFIG.viewport
    }
  });
  
  console.log('✅ Browser launched\n');
  
  try {
    // Setup API key
    await setupApiKey(context);
    
    // Record demo based on type
    if (demoType === 'full') {
      await recordFullDemo(context);
    } else {
      await recordShortDemo(context);
    }
    
    // Close and save video
    console.log('\n💾 Saving video...');
    await context.close();
    
    console.log('\n✅ Demo recording complete!');
    console.log(`📁 Video saved to: ${CONFIG.videosDir}`);
    console.log('\nNote: Video files may take a moment to finish encoding.');
    
  } catch (error) {
    console.error('\n❌ Error during recording:', error.message);
    await context.close();
    process.exit(1);
  }
}

// Run the demo recorder
main().catch(console.error);
