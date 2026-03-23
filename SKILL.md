---
name: follow-investors
description: 投资大佬日报 — 每天追踪全球顶级投资人和对冲基金经理的 X/Twitter 动态，生成中文摘要推送。用于获取投资圈最新观点、持仓暗示和宏观分析。
---

# 投资大佬日报 (Follow Investors)

追踪 15 位全球顶级投资人的 X/Twitter 推文，每天生成中文摘要。

## 数据源

投资者列表: `config/sources.json`

## 内容获取流程

使用 `web_search` 搜索每位投资者最近 24 小时的推文。

### Step 1: 获取推文

对 `config/sources.json` 中的每位投资者执行搜索：

```
web_search("from:{handle} site:x.com", freshness="day")
```

如果 `freshness="day"` 没有结果，尝试不带 freshness 限制但在结果中筛选最近 48 小时内的。

### Step 2: 筛选有价值内容

阅读 `prompts/summarize-tweets.md`，按其标准筛选：
- 保留：市场观点、持仓暗示、宏观分析、风险警示、行业洞察
- 跳过：日常寒暄、纯转发、"感谢邀请"

### Step 3: 生成摘要

阅读 `prompts/digest-intro.md`，按其格式生成最终日报。

### Step 4: 保存 & 输出

1. 将生成的中文日报**同时写入** `latest-digest.md`（覆盖旧文件，方便其他 agent 转发）
2. 直接输出中文日报内容（stdout）。OpenClaw 负责投递到用户频道。

## 手动触发

用户说"投资日报"或"大佬说了啥"时，立即执行上述流程。

## 配置变更

用户可以通过对话调整：
- "加一个人: @xxx" → 更新 sources.json
- "去掉 xxx" → 更新 sources.json
- "改成每周推送" → 告知用户修改 cron
- "加上播客" → 扩展 sources 和搜索逻辑
