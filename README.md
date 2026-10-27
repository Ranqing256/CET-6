# 六级词汇本

一个面向大学英语六级备考的个人词汇本。它支持按听力、完形填空、阅读、翻译、作文管理生词，提供单词卡、分类、首字母索引、全文搜索以及录入、编辑和删除功能。

首版将词汇保存于浏览器的 `localStorage`，因此无需登录即可使用。`src/data/repository.ts` 提供统一仓储接口，包含 `upsertFromAutomation` 自动入库方法；后续接入阅读材料、OCR、AI 或 Vercel 数据库时，可以替换仓储实现而无需改动界面。

## 本地运行

```bash
pnpm install
pnpm dev
```

## 部署到 Vercel

1. 将项目推送至 GitHub、GitLab 或 Bitbucket。
2. 在 Vercel 选择 **Add New → Project** 并导入该仓库。
3. Vercel 会识别 Vite；保持构建命令为 `pnpm build`，输出目录为 `dist`。
4. 点击 Deploy。项目内的 `vercel.json` 已包含单页应用回退规则。

> 提示：目前词汇数据只保存在每台设备的浏览器中。若希望多设备同步，可将 `vocabularyRepository` 更换为 Vercel Postgres、KV 或任意 API 的实现。
