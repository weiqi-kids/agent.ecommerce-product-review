/**
 * ProductMatcher - 跨平台產品匹配
 *
 * 使用 UPC、品牌+型號、產品名稱等方式跨平台匹配相同產品。
 *
 * 用法：
 *   const matcher = new ProductMatcher();
 *
 *   // 從 Amazon 產品資訊找 Walmart/Best Buy 對應產品
 *   const matches = await matcher.findMatches({
 *     asin: 'B09V3KXJPB',
 *     title: 'Sony WH-1000XM5 Wireless Headphones',
 *     brand: 'Sony',
 *     upc: '027242922372'
 *   });
 */

export interface ProductIdentifier {
  asin?: string;
  sku?: string;
  walmart_id?: string;
  upc?: string;
  title: string;
  brand: string;
}

export interface PlatformMatch {
  platform: 'walmart_us' | 'bestbuy_us';
  productId: string;
  productUrl: string;
  matchMethod: 'upc' | 'brand_model' | 'name_search';
  confidence: 'high' | 'medium' | 'low';
  matchedTitle?: string;
}

export interface MatchResult {
  source: ProductIdentifier;
  matches: PlatformMatch[];
  warnings: string[];
}

/**
 * 跨平台產品匹配器
 */
export class ProductMatcher {
  /**
   * 從產品資訊找到跨平台匹配
   */
  async findMatches(product: ProductIdentifier): Promise<MatchResult> {
    const matches: PlatformMatch[] = [];
    const warnings: string[] = [];

    // 嘗試 UPC 匹配（最可靠）
    if (product.upc) {
      const upcMatches = await this.matchByUpc(product.upc);
      matches.push(...upcMatches);
    }

    // 如果 UPC 匹配不足，嘗試品牌+型號
    if (matches.length < 2 && product.brand) {
      const model = this.extractModel(product.title);
      if (model) {
        const brandModelMatches = await this.matchByBrandModel(product.brand, model);
        // 避免重複
        for (const m of brandModelMatches) {
          if (!matches.find((existing) => existing.platform === m.platform)) {
            matches.push(m);
          }
        }
      }
    }

    // 如果仍不足，嘗試名稱搜尋（最不可靠）
    if (matches.length < 2) {
      const searchQuery = this.buildSearchQuery(product);
      const searchMatches = await this.matchByNameSearch(searchQuery);
      for (const m of searchMatches) {
        if (!matches.find((existing) => existing.platform === m.platform)) {
          m.confidence = 'low'; // 名稱搜尋信心度較低
          matches.push(m);
          warnings.push(`${m.platform}: 使用名稱搜尋匹配，請驗證產品是否相同`);
        }
      }
    }

    return {
      source: product,
      matches,
      warnings,
    };
  }

  /**
   * 透過 UPC 匹配
   */
  private async matchByUpc(upc: string): Promise<PlatformMatch[]> {
    const matches: PlatformMatch[] = [];

    // Walmart UPC 搜尋
    const walmartUrl = `https://www.walmart.com/search?q=${upc}`;
    matches.push({
      platform: 'walmart_us',
      productId: '', // 需要實際搜尋後填入
      productUrl: walmartUrl,
      matchMethod: 'upc',
      confidence: 'high',
    });

    // Best Buy UPC 搜尋
    const bestbuyUrl = `https://www.bestbuy.com/site/searchpage.jsp?st=${upc}`;
    matches.push({
      platform: 'bestbuy_us',
      productId: '',
      productUrl: bestbuyUrl,
      matchMethod: 'upc',
      confidence: 'high',
    });

    return matches;
  }

  /**
   * 透過品牌 + 型號匹配
   */
  private async matchByBrandModel(brand: string, model: string): Promise<PlatformMatch[]> {
    const matches: PlatformMatch[] = [];
    const query = `${brand} ${model}`;

    // Walmart
    const walmartUrl = `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
    matches.push({
      platform: 'walmart_us',
      productId: '',
      productUrl: walmartUrl,
      matchMethod: 'brand_model',
      confidence: 'medium',
    });

    // Best Buy
    const bestbuyUrl = `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(query)}`;
    matches.push({
      platform: 'bestbuy_us',
      productId: '',
      productUrl: bestbuyUrl,
      matchMethod: 'brand_model',
      confidence: 'medium',
    });

    return matches;
  }

  /**
   * 透過名稱搜尋匹配
   */
  private async matchByNameSearch(query: string): Promise<PlatformMatch[]> {
    const matches: PlatformMatch[] = [];

    // Walmart
    const walmartUrl = `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
    matches.push({
      platform: 'walmart_us',
      productId: '',
      productUrl: walmartUrl,
      matchMethod: 'name_search',
      confidence: 'low',
    });

    // Best Buy
    const bestbuyUrl = `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(query)}`;
    matches.push({
      platform: 'bestbuy_us',
      productId: '',
      productUrl: bestbuyUrl,
      matchMethod: 'name_search',
      confidence: 'low',
    });

    return matches;
  }

  /**
   * 從標題提取型號
   */
  private extractModel(title: string): string | null {
    // 常見型號格式
    const patterns = [
      // 例如：WH-1000XM5, AirPods Pro, Galaxy S24
      /\b([A-Z]{1,3}[-]?\d{2,4}[A-Z]{0,3}\d{0,2})\b/i,
      // 例如：Series 9, Version 2.0
      /\b(Series|Version|Gen|Generation)\s*(\d+\.?\d*)\b/i,
      // 例如：Pro Max, Ultra, Plus
      /\b(Pro|Max|Ultra|Plus|Lite|Mini|Air)\b/i,
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * 建立搜尋查詢
   */
  private buildSearchQuery(product: ProductIdentifier): string {
    const parts: string[] = [];

    if (product.brand) {
      parts.push(product.brand);
    }

    // 從標題取前 5 個單詞
    const titleWords = product.title
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 5);
    parts.push(...titleWords);

    return parts.join(' ').slice(0, 100);
  }
}

/**
 * 驗證兩個產品是否匹配
 */
export function verifyProductMatch(
  source: ProductIdentifier,
  candidate: ProductIdentifier
): { isMatch: boolean; confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // UPC 完全匹配
  if (source.upc && candidate.upc && source.upc === candidate.upc) {
    score += 100;
    reasons.push('UPC 完全匹配');
    return { isMatch: true, confidence: 1.0, reasons };
  }

  // 品牌匹配
  if (source.brand && candidate.brand) {
    const brandMatch = source.brand.toLowerCase() === candidate.brand.toLowerCase();
    if (brandMatch) {
      score += 30;
      reasons.push('品牌匹配');
    }
  }

  // 標題相似度
  const titleSimilarity = calculateTitleSimilarity(source.title, candidate.title);
  score += titleSimilarity * 50;
  if (titleSimilarity > 0.7) {
    reasons.push(`標題相似度: ${Math.round(titleSimilarity * 100)}%`);
  }

  // 型號匹配
  const sourceModel = extractModelFromTitle(source.title);
  const candidateModel = extractModelFromTitle(candidate.title);
  if (sourceModel && candidateModel && sourceModel === candidateModel) {
    score += 20;
    reasons.push(`型號匹配: ${sourceModel}`);
  }

  const confidence = Math.min(score / 100, 1.0);
  return {
    isMatch: confidence >= 0.6,
    confidence,
    reasons,
  };
}

/**
 * 計算標題相似度（簡單的詞彙重疊）
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const words1 = new Set(normalize(title1));
  const words2 = new Set(normalize(title2));

  if (words1.size === 0 || words2.size === 0) return 0;

  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }

  return overlap / Math.max(words1.size, words2.size);
}

/**
 * 從標題提取型號
 */
function extractModelFromTitle(title: string): string | null {
  const patterns = [
    /\b([A-Z]{1,3}[-]?\d{2,4}[A-Z]{0,3}\d{0,2})\b/i,
    /\b(Model\s*[:#]?\s*\w+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1].toUpperCase().replace(/\s+/g, '');
    }
  }

  return null;
}
