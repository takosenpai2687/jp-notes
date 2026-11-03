# tako-jp · 日语学习的小小世界

一个天蓝色浮空岛主题的日语学习网站，提供笔记阅读、语法测验和学习记录。

**线上体验：[https://tako-jp.netlify.app/](https://tako-jp.netlify.app/)**

[![tako-jp 首页大屏预览（1920px）](./web/docs/images/home-desktop.png)](https://tako-jp.netlify.app/)

## 可以做什么

- **笔记森林**：搜索和阅读日语笔记，支持目录导航、已读标记及宽屏分栏。
- **语法试炼**：即时解析、跳题、前后导航、点阵选题和草稿续答。
- **学习足迹**：历史成绩、最佳纪录、阅读记录与数据导出。
- **游客与账号**：游客记录保存在浏览器，登录后可合并记录并保存到云端。
- **真题与单词**：Coming soon。

网站提供 **N5–N1** 等级入口，实际可学习内容以各等级已有资料为准；没有内容的等级会明确显示待更新。

## 技术栈

Next.js · TypeScript · Tailwind CSS · Motion · PostgreSQL · Netlify

## 仓库结构

| 目录 | 内容 |
| --- | --- |
| [web](./web/) | tako-jp 网站代码、测试及部署配置 |
| [notes/raw](./notes/raw/) | 原始 Markdown 日语笔记 |
| [quiz](./quiz/) | 测验资料；网站使用 JSON，HTML 保留给本地单独打开 |
| [raw/jlpt](./raw/jlpt/) | JLPT 真题原始资料，尚未接入网站 |

## 本地运行

需要 **Node.js 24+**。请保留完整仓库结构，不要只下载 `web` 目录。

在仓库根目录运行：

```shell
cd web
npm install
npm run dev
```

打开 **[http://localhost:3107](http://localhost:3107)**。

本地数据库自动启动，无需额外安装。
