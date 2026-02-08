---
layout: default
title: 萃取結果
parent: 資料
nav_order: 3
description: "Amazon 評論 L1-L6 萃取結果"
last_modified_date: 2026-02-08
---

# 萃取結果
{: .fs-9 }

Amazon 評論的結構化萃取
{: .fs-6 .fw-300 }

---

## L1-L6 萃取層級

| Layer | 名稱 | 說明 |
|:------|:-----|:-----|
| L1 | 商品識別 | ASIN、標題、價格、評分 |
| L2 | 評論統計 | 數量、分佈、驗證購買率 |
| L3 | 面向萃取 | Aspect 分類與提及次數 |
| L4 | 情感分析 | 各面向的情感評分 |
| L5 | 問題偵測 | 負評模式與風險識別 |
| L6 | 摘要生成 | 自然語言摘要 |

---

## 萃取結果目錄

萃取結果存放於 `docs/Extractor/amazon_us/` 目錄，按類別分類：

```
docs/Extractor/amazon_us/
├── beauty/
├── health/
├── electronics/
├── home_appliance/
├── toys_games/
└── ...
```

---

## 檔案命名規則

```
{ASIN}--amazon_us--{YYYY-MM-DD}.md
```

例如：`B074PVTPBW--amazon_us--2026-02-06.md`

---

## 萃取結果範例

```markdown
# B074PVTPBW — Mighty Patch Original

## L1 商品識別
| 欄位 | 值 |
|------|-----|
| ASIN | B074PVTPBW |
| 標題 | Mighty Patch Original |
| 價格 | $12.99 |
| 評分 | 4.5/5 |

## L2 評論統計
| 指標 | 值 |
|------|-----|
| 總評論數 | 50,000+ |
| 驗證購買率 | 85% |

## L3 面向萃取
| Aspect | 提及次數 |
|--------|---------|
| effectiveness | 1,200 |
| value | 800 |
...
```
