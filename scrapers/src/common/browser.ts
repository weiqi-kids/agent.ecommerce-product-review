/**
 * 共用瀏覽器啟動與反偵測設定
 * 使用 playwright-extra + puppeteer-extra-plugin-stealth
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, BrowserContext, Page } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// 全域套用 stealth plugin
chromium.use(StealthPlugin());

export interface BrowserOptions {
  headless?: boolean;
  timeout?: number;
  locale?: string;
}

export interface PersistentContextOptions extends BrowserOptions {
  userDataDir: string;
}

const DEFAULT_OPTIONS: Required<BrowserOptions> = {
  headless: true,
  timeout: 30000,
  locale: 'en-US',
};

/**
 * 啟動瀏覽器，套用 stealth plugin 反偵測
 */
export async function launchBrowser(options: BrowserOptions = {}): Promise<Browser> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const browser = await chromium.launch({
    headless: opts.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
    ],
  });

  return browser;
}

/**
 * 建立瀏覽器上下文，模擬真實使用者環境
 */
export async function createContext(
  browser: Browser,
  options: BrowserOptions = {}
): Promise<BrowserContext> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const context = await browser.newContext({
    locale: opts.locale,
    timezoneId: getTimezoneForLocale(opts.locale),
    userAgent: getRandomUserAgent(),
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    hasTouch: false,
    javaScriptEnabled: true,
    colorScheme: 'light',
  });

  // 設定預設超時
  context.setDefaultTimeout(opts.timeout);
  context.setDefaultNavigationTimeout(opts.timeout * 2);

  return context;
}

/**
 * 建立新頁面
 * Stealth plugin 自動處理大部分反偵測，僅保留 timing jitter
 */
export async function createPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();

  // 注入 timing jitter 增加隨機性
  await page.addInitScript(() => {
    const originalSetTimeout = window.setTimeout;
    (window as any).setTimeout = function(fn: any, delay?: number, ...args: any[]) {
      const jitter = delay ? Math.random() * Math.min(delay * 0.1, 10) : 0;
      return originalSetTimeout(fn, (delay || 0) + jitter, ...args);
    };
  });

  return page;
}

/**
 * 隨機等待（模擬人類行為）
 */
export async function randomDelay(min: number = 1000, max: number = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min) + min);
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 啟動持久化瀏覽器上下文（保留登入狀態）
 * 用於需要登入的場景，session 會保存在 userDataDir
 */
export async function launchPersistentContext(
  options: PersistentContextOptions
): Promise<BrowserContext> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 確保 userDataDir 存在
  if (!existsSync(opts.userDataDir)) {
    mkdirSync(opts.userDataDir, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(opts.userDataDir, {
    headless: opts.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
    ],
    locale: opts.locale,
    timezoneId: getTimezoneForLocale(opts.locale),
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    hasTouch: false,
    javaScriptEnabled: true,
    colorScheme: 'light',
  });

  // 設定預設超時
  context.setDefaultTimeout(opts.timeout);
  context.setDefaultNavigationTimeout(opts.timeout * 2);

  return context;
}

/**
 * 取得預設的 browser profile 目錄
 */
export function getDefaultProfileDir(platform: string): string {
  const baseDir = join(process.cwd(), '.browser-profiles');
  return join(baseDir, platform);
}

function getTimezoneForLocale(locale: string): string {
  const timezones: Record<string, string> = {
    'en-US': 'America/New_York',
    'ja-JP': 'Asia/Tokyo',
    'zh-TW': 'Asia/Taipei',
    'de-DE': 'Europe/Berlin',
    'fr-FR': 'Europe/Paris',
    'en-GB': 'Europe/London',
  };
  return timezones[locale] || 'America/New_York';
}

function getRandomUserAgent(): string {
  // Updated to Chrome 133 / Firefox 135 (2025)
  const agents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}
