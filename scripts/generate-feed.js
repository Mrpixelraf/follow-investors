#!/usr/bin/env node

// ============================================================================
// Follow Investors — X/Twitter Feed Generator
// ============================================================================
// Fetches recent tweets from curated investor accounts via X API v2.
// Outputs feed-x.json with deduplication.
//
// Usage: X_BEARER_TOKEN=xxx node generate-feed.js
// ============================================================================

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const X_API_BASE = 'https://api.x.com/2';
const TWEET_LOOKBACK_HOURS = 48;
const MAX_TWEETS_PER_USER = 5;

const SCRIPT_DIR = decodeURIComponent(new URL('.', import.meta.url).pathname);
const STATE_PATH = join(SCRIPT_DIR, '..', 'state-feed.json');
const SOURCES_PATH = join(SCRIPT_DIR, '..', 'config', 'sources.json');
const OUTPUT_PATH = join(SCRIPT_DIR, '..', 'feed-x.json');

// -- State -------------------------------------------------------------------

async function loadState() {
  if (!existsSync(STATE_PATH)) return { seenTweets: {} };
  try {
    return JSON.parse(await readFile(STATE_PATH, 'utf-8'));
  } catch { return { seenTweets: {} }; }
}

async function saveState(state) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const [id, ts] of Object.entries(state.seenTweets)) {
    if (ts < cutoff) delete state.seenTweets[id];
  }
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2));
}

// -- Main --------------------------------------------------------------------

async function main() {
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) {
    console.error('X_BEARER_TOKEN not set');
    process.exit(1);
  }

  const sources = JSON.parse(await readFile(SOURCES_PATH, 'utf-8'));
  const xAccounts = sources.x_accounts;
  const state = await loadState();
  const errors = [];
  const results = [];
  const cutoff = new Date(Date.now() - TWEET_LOOKBACK_HOURS * 60 * 60 * 1000);

  // Batch lookup user IDs
  const handles = xAccounts.map(a => a.handle);
  const userMap = {};

  for (let i = 0; i < handles.length; i += 100) {
    const batch = handles.slice(i, i + 100);
    try {
      const res = await fetch(
        `${X_API_BASE}/users/by?usernames=${batch.join(',')}&user.fields=name,description`,
        { headers: { 'Authorization': `Bearer ${bearerToken}` } }
      );
      if (!res.ok) {
        errors.push(`X API: User lookup failed: HTTP ${res.status} ${await res.text()}`);
        continue;
      }
      const data = await res.json();
      for (const user of (data.data || [])) {
        userMap[user.username.toLowerCase()] = {
          id: user.id,
          name: user.name,
          description: user.description || ''
        };
      }
      if (data.errors) {
        for (const err of data.errors) {
          errors.push(`X API: User not found: ${err.value || err.detail}`);
        }
      }
    } catch (err) {
      errors.push(`X API: User lookup error: ${err.message}`);
    }
  }

  // Fetch tweets per user
  for (const account of xAccounts) {
    const userData = userMap[account.handle.toLowerCase()];
    if (!userData) {
      errors.push(`Skipped @${account.handle}: user not found`);
      continue;
    }

    try {
      const res = await fetch(
        `${X_API_BASE}/users/${userData.id}/tweets?` +
        `max_results=10` +
        `&tweet.fields=created_at,public_metrics,referenced_tweets,note_tweet` +
        `&exclude=retweets,replies` +
        `&start_time=${cutoff.toISOString()}`,
        { headers: { 'Authorization': `Bearer ${bearerToken}` } }
      );

      if (!res.ok) {
        if (res.status === 429) {
          errors.push(`X API: Rate limited, stopping`);
          break;
        }
        errors.push(`X API: @${account.handle} HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const allTweets = data.data || [];
      const newTweets = [];

      for (const t of allTweets) {
        if (state.seenTweets[t.id]) continue;
        if (newTweets.length >= MAX_TWEETS_PER_USER) break;

        newTweets.push({
          id: t.id,
          text: t.note_tweet?.text || t.text,
          createdAt: t.created_at,
          url: `https://x.com/${account.handle}/status/${t.id}`,
          likes: t.public_metrics?.like_count || 0,
          retweets: t.public_metrics?.retweet_count || 0,
          replies: t.public_metrics?.reply_count || 0,
          isQuote: t.referenced_tweets?.some(r => r.type === 'quoted') || false,
          quotedTweetId: t.referenced_tweets?.find(r => r.type === 'quoted')?.id || null
        });

        state.seenTweets[t.id] = Date.now();
      }

      if (newTweets.length === 0) continue;

      results.push({
        source: 'x',
        name: account.name,
        handle: account.handle,
        role: account.role || '',
        bio: userData.description,
        tweets: newTweets
      });

      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      errors.push(`X API: @${account.handle} error: ${err.message}`);
    }
  }

  // Save
  const totalTweets = results.reduce((sum, a) => sum + a.tweets.length, 0);
  const feed = {
    generatedAt: new Date().toISOString(),
    lookbackHours: TWEET_LOOKBACK_HOURS,
    x: results,
    stats: { xInvestors: results.length, totalTweets },
    errors: errors.length > 0 ? errors : undefined
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(feed, null, 2));
  await saveState(state);

  console.error(`Done: ${results.length} investors, ${totalTweets} tweets`);
  if (errors.length > 0) console.error(`${errors.length} errors`);
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
