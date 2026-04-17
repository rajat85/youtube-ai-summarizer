/**
 * Launches Comet (Perplexity) when installed, otherwise Playwright Chromium,
 * with this extension unpacked. Opens a YouTube watch URL and clicks Summarize.
 *
 * Prerequisites:
 *   npm install
 *   npx playwright install chromium   # only needed for Chromium fallback
 *
 * First run: set your Gemini API key in the extension popup (toolbar puzzle
 * icon → YouTube AI Summarizer). The profile under .playwright-chrome-profile
 * keeps that key for later demo runs.
 *
 * Usage:
 *   npm run demo
 *   npm run demo:record     # saves a .webm under test-results/demo-videos/
 *   DEMO_URL="https://..." npm run demo
 *   DEMO_KEEP_OPEN_MS=60000 npm run demo
 *   COMET_EXECUTABLE="/path/to/Comet" npm run demo   # override Comet binary
 *   PLAYWRIGHT_USE_CHROMIUM=1 npm run demo         # skip Comet, use Chromium
 */

import { chromium } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '..');
const USER_DATA_DIR = path.join(EXTENSION_PATH, '.playwright-chrome-profile');
const VIDEO_DIR = path.join(EXTENSION_PATH, 'test-results', 'demo-videos');

const DEMO_URL =
  process.env.DEMO_URL || 'https://www.youtube.com/watch?v=VOC44gKRTI4';
const RECORD_VIDEO = process.argv.includes('--record');
const KEEP_OPEN_MS = parseInt(process.env.DEMO_KEEP_OPEN_MS || '45000', 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve Perplexity Comet macOS binary (Chromium-based).
 * @returns {string|null}
 */
function findCometExecutable() {
  const fromEnv = process.env.COMET_EXECUTABLE?.trim();
  if (fromEnv) {
    if (fs.existsSync(fromEnv)) return fromEnv;
    throw new Error(`COMET_EXECUTABLE is set but not found: ${fromEnv}`);
  }

  if (process.platform !== 'darwin') {
    return null;
  }

  const candidates = [
    '/Applications/Comet.app/Contents/MacOS/Comet',
    path.join(os.homedir(), 'Applications/Comet.app/Contents/MacOS/Comet'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  const brewRoots = [
    '/opt/homebrew/Caskroom/comet',
    '/usr/local/Caskroom/comet',
  ];
  for (const root of brewRoots) {
    if (!fs.existsSync(root)) continue;
    let versions;
    try {
      versions = fs.readdirSync(root);
    } catch {
      continue;
    }
    const sorted = versions.filter((v) => !v.startsWith('.')).sort();
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = path.join(
        root,
        sorted[i],
        'Comet.app',
        'Contents',
        'MacOS',
        'Comet'
      );
      if (fs.existsSync(p)) return p;
    }
  }

  return null;
}

/**
 * @returns {{ options: import('playwright').LaunchPersistentContextOptions, label: string }}
 */
function resolveLaunchConfig() {
  const useChromium = process.env.PLAYWRIGHT_USE_CHROMIUM === '1';

  /** @type {import('playwright').LaunchPersistentContextOptions} */
  const base = {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
    viewport: { width: 1280, height: 800 },
  };

  if (!useChromium) {
    const cometPath = findCometExecutable();
    if (cometPath) {
      return {
        label: `Comet (${cometPath})`,
        options: { ...base, executablePath: cometPath },
      };
    }
  }

  return {
    label: 'Playwright Chromium (install Comet in /Applications or set COMET_EXECUTABLE to use Comet)',
    options: { ...base, channel: 'chromium' },
  };
}

async function main() {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  if (RECORD_VIDEO) fs.mkdirSync(VIDEO_DIR, { recursive: true });

  const { options: contextOptions, label } = resolveLaunchConfig();

  if (RECORD_VIDEO) {
    contextOptions.recordVideo = {
      dir: VIDEO_DIR,
      size: { width: 1280, height: 800 },
    };
  }

  console.log('Browser:', label);
  console.log('Extension:', EXTENSION_PATH);
  console.log('Demo URL:', DEMO_URL);
  if (RECORD_VIDEO) console.log('Recording video to:', VIDEO_DIR);

  const context = await chromium.launchPersistentContext(
    USER_DATA_DIR,
    contextOptions
  );

  try {
    const page = context.pages()[0] ?? (await context.newPage());

    await page.goto(DEMO_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });

    await page.waitForSelector('#movie_player', { timeout: 120_000 });

    const summarize = page.locator('#yt-ai-summarize-btn');
    await summarize.waitFor({ state: 'visible', timeout: 120_000 });
    await sleep(2000);
    await summarize.click();

    await page
      .waitForSelector('#yt-ai-sidebar.open', { timeout: 10_000 })
      .catch(() => {});

    await page.waitForSelector(
      '#yt-ai-sidebar .loading, #yt-ai-sidebar .summary, #yt-ai-sidebar .error',
      { timeout: 180_000 }
    );

    console.log(
      `Sidebar updated. Keeping the browser open for ${KEEP_OPEN_MS} ms (set DEMO_KEEP_OPEN_MS to change).`
    );
    console.log('Close the window yourself to end sooner.');
    await sleep(Number.isFinite(KEEP_OPEN_MS) ? KEEP_OPEN_MS : 45_000);
  } finally {
    await context.close();
    if (RECORD_VIDEO) {
      console.log('Recording finished. Check for a .webm file in:', VIDEO_DIR);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
