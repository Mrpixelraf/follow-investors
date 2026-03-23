#!/usr/bin/env node

// ============================================================================
// Follow Investors — Prepare Digest
// ============================================================================
// Runs generate-feed.js first, then assembles everything for the LLM.
// Output: single JSON blob to stdout.
// ============================================================================

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

const SCRIPT_DIR = decodeURIComponent(new URL('.', import.meta.url).pathname);
const SKILL_DIR = join(SCRIPT_DIR, '..');
const USER_DIR = join(homedir(), '.follow-investors');
const CONFIG_PATH = join(USER_DIR, 'config.json');
const FEED_PATH = join(SKILL_DIR, 'feed-x.json');
const FEED_URL = 'https://raw.githubusercontent.com/Mrpixelraf/follow-investors/main/feed-x.json';

async function main() {
  const errors = [];

  // 1. Read config
  let config = { language: 'zh', frequency: 'daily', delivery: { method: 'stdout' } };
  if (existsSync(CONFIG_PATH)) {
    try { config = JSON.parse(await readFile(CONFIG_PATH, 'utf-8')); } catch (e) {
      errors.push(`Config error: ${e.message}`);
    }
  }

  // 2. Fetch tweets — try local generation first (if bearer token exists),
  //    otherwise pull from GitHub (for consumers without their own key)
  const bearerTokenPath = join(homedir(), '.openclaw', 'credentials', 'x-bearer-token');
  let bearerToken = '';
  if (existsSync(bearerTokenPath)) {
    bearerToken = (await readFile(bearerTokenPath, 'utf-8')).trim();
  }

  if (bearerToken) {
    // Local: run generate-feed.js with our own key
    try {
      execSync(`node "${join(SCRIPT_DIR, 'generate-feed.js')}"`, {
        env: { ...process.env, X_BEARER_TOKEN: bearerToken },
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60000
      });
    } catch (e) {
      errors.push(`Local feed generation error: ${e.stderr?.toString() || e.message}`);
    }
  } else {
    // Remote: pull pre-built feed from GitHub (no API key needed)
    try {
      const res = await fetch(FEED_URL);
      if (res.ok) {
        const { writeFile: wf } = await import('fs/promises');
        await wf(FEED_PATH, await res.text());
      } else {
        errors.push(`GitHub feed fetch failed: HTTP ${res.status}`);
      }
    } catch (e) {
      errors.push(`GitHub feed fetch error: ${e.message}`);
    }
  }

  // 3. Read feed
  let feedX = { x: [] };
  if (existsSync(FEED_PATH)) {
    try { feedX = JSON.parse(await readFile(FEED_PATH, 'utf-8')); } catch (e) {
      errors.push(`Feed read error: ${e.message}`);
    }
  }

  // 4. Load prompts (user custom > local)
  const prompts = {};
  const promptFiles = ['digest-intro.md', 'summarize-tweets.md'];
  const localPromptsDir = join(SKILL_DIR, 'prompts');
  const userPromptsDir = join(USER_DIR, 'prompts');

  for (const filename of promptFiles) {
    const key = filename.replace('.md', '').replace(/-/g, '_');
    const userPath = join(userPromptsDir, filename);
    const localPath = join(localPromptsDir, filename);

    if (existsSync(userPath)) {
      prompts[key] = await readFile(userPath, 'utf-8');
    } else if (existsSync(localPath)) {
      prompts[key] = await readFile(localPath, 'utf-8');
    } else {
      errors.push(`Missing prompt: ${filename}`);
    }
  }

  // 5. Output
  const output = {
    status: 'ok',
    generatedAt: new Date().toISOString(),
    config: { language: config.language || 'zh', frequency: config.frequency || 'daily', delivery: config.delivery || { method: 'stdout' } },
    x: feedX.x || [],
    stats: {
      xInvestors: feedX.stats?.xInvestors || (feedX.x || []).length,
      totalTweets: feedX.stats?.totalTweets || (feedX.x || []).reduce((s, a) => s + a.tweets.length, 0),
      feedGeneratedAt: feedX.generatedAt || null
    },
    prompts,
    errors: errors.length > 0 ? errors : undefined
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ status: 'error', message: err.message }));
  process.exit(1);
});
