/**
 * Discovery 工具函數單元測試
 */

import { describe, it, expect } from 'vitest';
import {
  parseDiscoveryArgs,
  validateArgs,
  deduplicateProducts,
  extractIdFromUrl,
  toJsonlRecords,
} from '../utils.js';
import type { DiscoveryConfig, DiscoveredProduct } from '../types.js';

describe('parseDiscoveryArgs', () => {
  it('should parse default values', () => {
    const result = parseDiscoveryArgs({});
    expect(result).toEqual({
      source: 'best-sellers',
      category: 'electronics',
      limit: 50,
      outputFile: undefined,
      headless: true,
    });
  });

  it('should parse custom values', () => {
    const result = parseDiscoveryArgs({
      source: 'deals',
      category: 'toys',
      limit: '100',
      output: './output.jsonl',
      headless: 'false',
    });
    expect(result.source).toBe('deals');
    expect(result.category).toBe('toys');
    expect(result.limit).toBe(100);
    expect(result.outputFile).toBe('./output.jsonl');
    expect(result.headless).toBe(false);
  });

  it('should handle headless=true explicitly', () => {
    const result = parseDiscoveryArgs({ headless: 'true' });
    expect(result.headless).toBe(true);
  });
});

describe('validateArgs', () => {
  const mockConfig: DiscoveryConfig = {
    platform: 'Test',
    validSources: ['bestsellers', 'deals'],
    categoryPaths: { electronics: 'elec', toys: 'toy', all: '' },
    urlTemplates: {},
    productIdValidator: () => true,
    buildProductUrl: (id) => `https://test.com/${id}`,
  };

  it('should return null for valid args', () => {
    const options = { source: 'bestsellers', category: 'electronics', limit: 50, headless: true };
    expect(validateArgs(options, mockConfig)).toBeNull();
  });

  it('should return error for invalid source', () => {
    const options = { source: 'invalid', category: 'electronics', limit: 50, headless: true };
    const result = validateArgs(options, mockConfig);
    expect(result).toContain('無效的 source');
    expect(result).toContain('invalid');
  });

  it('should return error for invalid category', () => {
    const options = { source: 'bestsellers', category: 'invalid', limit: 50, headless: true };
    const result = validateArgs(options, mockConfig);
    expect(result).toContain('無效的 category');
    expect(result).toContain('invalid');
  });

  it('should accept "all" as source', () => {
    const options = { source: 'all', category: 'electronics', limit: 50, headless: true };
    expect(validateArgs(options, mockConfig)).toBeNull();
  });

  it('should accept "all" as category', () => {
    const options = { source: 'bestsellers', category: 'all', limit: 50, headless: true };
    expect(validateArgs(options, mockConfig)).toBeNull();
  });
});

describe('deduplicateProducts', () => {
  it('should remove duplicates keeping higher rank', () => {
    const products = [
      { product_id: 'A', rank: 3, title: 'Product A' },
      { product_id: 'B', rank: 2, title: 'Product B' },
      { product_id: 'A', rank: 1, title: 'Product A (better rank)' },
    ];

    const result = deduplicateProducts(products);

    expect(result).toHaveLength(2);
    expect(result[0].product_id).toBe('A');
    expect(result[0].rank).toBe(1); // 保留較高排名
    expect(result[1].product_id).toBe('B');
  });

  it('should sort by rank ascending', () => {
    const products = [
      { product_id: 'C', rank: 5 },
      { product_id: 'A', rank: 1 },
      { product_id: 'B', rank: 3 },
    ];

    const result = deduplicateProducts(products);

    expect(result.map(p => p.product_id)).toEqual(['A', 'B', 'C']);
  });

  it('should handle empty array', () => {
    expect(deduplicateProducts([])).toEqual([]);
  });

  it('should handle single item', () => {
    const products = [{ product_id: 'A', rank: 1 }];
    expect(deduplicateProducts(products)).toEqual(products);
  });

  it('should keep first occurrence when ranks are equal', () => {
    const products = [
      { product_id: 'A', rank: 1, title: 'First' },
      { product_id: 'A', rank: 1, title: 'Second' },
    ];

    const result = deduplicateProducts(products);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('First');
  });
});

describe('extractIdFromUrl', () => {
  it('should extract Amazon ASIN', () => {
    const patterns = [/\/dp\/([A-Z0-9]{10})/, /\/product-reviews\/([A-Z0-9]{10})/];

    expect(extractIdFromUrl('https://amazon.com/dp/B08N5WRWNW', patterns))
      .toBe('B08N5WRWNW');
    expect(extractIdFromUrl('https://amazon.com/product-reviews/B08N5WRWNW', patterns))
      .toBe('B08N5WRWNW');
  });

  it('should extract Walmart product ID', () => {
    const patterns = [/\/ip\/[^/]+\/(\d+)/, /\/ip\/(\d+)/];

    expect(extractIdFromUrl('https://walmart.com/ip/Product-Name/123456789', patterns))
      .toBe('123456789');
  });

  it('should extract Best Buy SKU (old format)', () => {
    const patterns = [/\/(\d{7})\.p/];

    expect(extractIdFromUrl('https://bestbuy.com/site/product/6505727.p', patterns))
      .toBe('6505727');
  });

  it('should extract Best Buy product ID (new format)', () => {
    const patterns = [/\/product\/[^/]+\/([A-Z0-9]{8,12})(?:\/|$)/i];

    expect(extractIdFromUrl('https://bestbuy.com/product/sony-tv/J2FPJK9P43', patterns))
      .toBe('J2FPJK9P43');
  });

  it('should return null for no match', () => {
    const patterns = [/\/dp\/([A-Z0-9]{10})/];
    expect(extractIdFromUrl('https://example.com/no-match', patterns)).toBeNull();
  });

  it('should return null for empty patterns', () => {
    expect(extractIdFromUrl('https://example.com/test', [])).toBeNull();
  });

  it('should try patterns in order and return first match', () => {
    const patterns = [/\/first\/(\d+)/, /\/second\/(\d+)/];

    // 第一個匹配
    expect(extractIdFromUrl('https://example.com/first/123', patterns)).toBe('123');
    // 第二個匹配
    expect(extractIdFromUrl('https://example.com/second/456', patterns)).toBe('456');
  });
});

describe('toJsonlRecords', () => {
  it('should convert products to JSONL records', () => {
    const products: DiscoveredProduct[] = [
      {
        product_id: 'TEST123',
        title: 'Test Product',
        rank: 1,
        price: '$99.99',
        rating: '4.5',
        review_count: '100',
        source: 'bestsellers',
        category: 'electronics',
      },
    ];

    const buildUrl = (id: string) => `https://test.com/product/${id}`;
    const records = toJsonlRecords(products, 'TestPlatform', buildUrl);

    expect(records).toHaveLength(1);
    expect(records[0].product_id).toBe('TEST123');
    expect(records[0].url).toBe('https://test.com/product/TEST123');
    expect(records[0].platform).toBe('TestPlatform');
    expect(records[0].discovered_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should handle null values', () => {
    const products: DiscoveredProduct[] = [
      {
        product_id: 'TEST123',
        title: 'Test Product',
        rank: 1,
        price: null,
        rating: null,
        review_count: null,
        source: 'bestsellers',
        category: 'electronics',
      },
    ];

    const records = toJsonlRecords(products, 'Test', (id) => `/${id}`);

    expect(records[0].price).toBeNull();
    expect(records[0].rating).toBeNull();
    expect(records[0].review_count).toBeNull();
  });
});
