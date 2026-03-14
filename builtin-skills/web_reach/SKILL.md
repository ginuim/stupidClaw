---
name: web_reach
description: >
  通过 bash 工具访问互联网与各平台：网页阅读、网页搜索（Exa）、Twitter/X、
  YouTube、Bilibili、Reddit、GitHub、小红书、抖音、微信公众号、LinkedIn、RSS。
  当用户要求"搜索"、"查一下"、"看这个链接"、"搜推特/小红书/B站"等联网操作时使用。
---

# Web Reach — 联网工具使用指南

通过 bash 工具调用以下命令。临时文件存入 `/tmp/`，不要写入工作区。

## 读取任意网页

```bash
curl -s "https://r.jina.ai/目标URL"
```

## 网页搜索（Exa）

```bash
mcporter call 'exa.web_search_exa(query: "搜索词", numResults: 5)'
```

## Twitter/X

```bash
xreach search "关键词" -n 10 --json
xreach tweet 推文URL或ID --json
xreach tweets @用户名 -n 20 --json
xreach thread 推文URL或ID --json
```

## YouTube

```bash
# 视频信息
yt-dlp --dump-json "URL"
# 下载字幕（中英文）
yt-dlp --write-sub --write-auto-sub --sub-lang "zh-Hans,zh,en" --skip-download -o "/tmp/%(id)s" "URL"
# 搜索
yt-dlp --dump-json "ytsearch5:搜索词"
```

## Bilibili

```bash
yt-dlp --dump-json "https://www.bilibili.com/video/BVxxx"
yt-dlp --write-sub --write-auto-sub --sub-lang "zh-Hans,zh,en" --convert-subs vtt --skip-download -o "/tmp/%(id)s" "URL"
```

## Reddit

```bash
curl -s "https://www.reddit.com/r/版块名/hot.json?limit=10" -H "User-Agent: StupidClaw/1.0"
curl -s "https://www.reddit.com/search.json?q=关键词&limit=10" -H "User-Agent: StupidClaw/1.0"
```

## GitHub

```bash
gh search repos "关键词" --sort stars --limit 10
gh repo view owner/repo
gh issue list -R owner/repo --state open
gh issue view 123 -R owner/repo
```

## 小红书

```bash
mcporter call 'xiaohongshu.search_feeds(keyword: "关键词")'
mcporter call 'xiaohongshu.get_feed_detail(feed_id: "xxx", xsec_token: "yyy")'
```

## 抖音

```bash
mcporter call 'douyin.parse_douyin_video_info(share_link: "https://v.douyin.com/xxx/")'
```

## 微信公众号

搜索文章：
```bash
python3 -c "
import asyncio
from miku_ai import get_wexin_article
async def s():
    for a in await get_wexin_article('关键词', 5):
        print(f'{a[\"title\"]} | {a[\"url\"]}')
asyncio.run(s())
"
```

读取文章（绕过反爬）：
```bash
cd ~/.agent-reach/tools/wechat-article-for-ai && python3 main.py "https://mp.weixin.qq.com/s/文章ID"
```

## LinkedIn

```bash
mcporter call 'linkedin.get_person_profile(linkedin_url: "https://linkedin.com/in/用户名")'
mcporter call 'linkedin.search_people(keyword: "关键词", limit: 10)'
```

## RSS

```bash
python3 -c "
import feedparser
for e in feedparser.parse('FEED_URL').entries[:5]:
    print(f'{e.title} — {e.link}')
"
```

## 注意事项

- 工具未安装时，先用 `which xreach` / `which yt-dlp` 检查，再告知用户哪个工具缺失
- Bilibili / Reddit 可能遇到反爬，失败时改用 `curl -s "https://r.jina.ai/URL"` 读取页面
- 字幕下载到 `/tmp/`，读取后即可返回内容，不必保存到工作区
