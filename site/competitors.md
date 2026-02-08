---
layout: default
title: 競品清單
parent: 資料
nav_order: 2
description: "從評測文章萃取的競品列表"
last_modified_date: 2026-02-08
---

# 競品清單
{: .fs-9 }

從評測文章萃取的推薦產品
{: .fs-6 .fw-300 }

---

## 競品發現說明

競品清單從 Step 5 研究中的評測文章萃取：

1. 讀取評測文章
2. 提取推薦的產品名稱
3. 記錄推薦次數和來源
4. 識別 Amazon ASIN（若有）

---

## 競品清單目錄

競品清單存放於 `docs/Extractor/competitors/` 目錄。

### 篩選標準

| 條件 | 說明 |
|:-----|:-----|
| 相同問題 | 必須解決相同問題 |
| 多次推薦 | 至少在 2 篇以上評測中被推薦 |
| 有 ASIN | 優先納入有 Amazon 連結的產品 |

---

## 統計

| 類別 | 競品數 | 有 ASIN |
|:-----|:------|:--------|
| squishy-toy | 20 | 17 |
| kids-tent | 20 | 20 |
| playing-cards | 17 | 15 |

---

## 競品清單格式

```markdown
| # | 產品名稱 | 品牌 | 推薦次數 | Amazon ASIN | 來源 |
|---|---------|------|---------|-------------|------|
| 1 | Product Name | Brand | 8 | B074PVTPBW | [1][3][5] |
```
