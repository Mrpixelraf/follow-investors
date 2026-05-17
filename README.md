# 🏦 Follow Investors

**投资大佬日报** — Track what the world's top investors are saying on X/Twitter, delivered as a daily digest.

Follow investors, not noise.

## What You Get

A daily digest with:
- Macro views and market predictions from legendary investors
- Stock/sector calls and portfolio hints
- Risk warnings and contrarian takes
- Direct links to every original tweet

## Who We Track

| Investor | Role |
|----------|------|
| Ray Dalio | Bridgewater Founder |
| Bill Ackman | Pershing Square CEO |
| Stanley Druckenmiller | Duquesne Founder |
| Howard Marks | Oaktree Co-founder |
| Cathie Wood | ARK Invest CEO |
| Chamath Palihapitiya | Social Capital CEO |
| Michael Burry | Scion Asset Management |
| Cliff Asness | AQR Co-founder |
| Raoul Pal | Real Vision CEO |
| Luke Gromen | FFTT Founder |
| Lyn Alden | Independent Macro Research |
| Jim Bianco | Bianco Research |
| Jeff Gundlach | DoubleLine CEO |
| David Einhorn | Greenlight Capital |
| Jim Chanos | Short Seller |

## How It Works

1. GitHub Actions fetches tweets every 6 hours via X API v2
2. Tweets are saved to `feed-x.json` (deduped via `state-feed.json`)
3. Your AI agent (OpenClaw, Claude Code, etc.) fetches `feed-x.json` from this repo
4. The agent remixes the raw tweets into a readable digest using the prompts

**No API keys needed for consumers** — all data is fetched centrally and published here.

### Optional: Fresh X/Twitter Data With TweetClaw

If the published feed is empty, stale, or you want account-backed X/Twitter reads from your own OpenClaw workspace, install [TweetClaw](https://github.com/Xquik-dev/tweetclaw) separately:

```bash
openclaw plugins install npm:@xquik/tweetclaw
```

Use TweetClaw read tools for user lookup, tweet and reply search, and follower evidence. Keep posting, private reads, monitors, and other persistent or account-changing actions behind explicit approval. Keep the Xquik API key in OpenClaw plugin config, not in this skill repo.

## Install as Skill

### OpenClaw
```bash
clawhub install follow-investors
```

### Claude Code / Cursor
Clone this repo and point your agent at `SKILL.md`.

## For Contributors

Want to suggest an investor to track? Open an issue!

## License

MIT
