/**
 * Amazon 登入與 Session 管理
 */

import type { Page, BrowserContext } from 'playwright';
import { launchPersistentContext, getDefaultProfileDir, randomDelay } from '../common/browser.js';
import { AMAZON_DOMAINS } from './selectors.js';

const LOGIN_URL = 'https://www.amazon.com/ap/signin?openid.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.amazon.com%2F&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=usflex&openid.mode=checkid_setup&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0';

/**
 * 檢查是否已登入 Amazon
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    // 檢查是否有 "Hello, Sign in" 文字（未登入狀態）
    const signInText = await page.$('#nav-link-accountList-nav-line-1');
    if (signInText) {
      const text = await signInText.textContent();
      if (text?.includes('Sign in') || text?.includes('Hello, sign in')) {
        return false;
      }
      // 已登入會顯示 "Hello, {Name}"
      if (text?.includes('Hello,') && !text?.includes('sign in')) {
        return true;
      }
    }

    // 備用檢查：看是否有帳戶名稱
    const accountName = await page.$('#nav-link-accountList .nav-line-1');
    if (accountName) {
      const text = await accountName.textContent();
      return !text?.toLowerCase().includes('sign in');
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * 檢查是否在登入頁面
 */
export async function isOnLoginPage(page: Page): Promise<boolean> {
  const url = page.url();
  return url.includes('/ap/signin') || url.includes('/ap/register');
}

/**
 * 檢查是否需要重新登入（session 過期）
 */
export async function isSessionExpired(page: Page): Promise<boolean> {
  // 如果被導向登入頁，表示 session 過期
  if (await isOnLoginPage(page)) {
    return true;
  }

  // 檢查頁面是否有 "Sign in" 提示
  const signInPrompt = await page.$('input[name="email"], input[name="password"]');
  return signInPrompt !== null;
}

/**
 * 執行互動式登入流程
 * 開啟瀏覽器讓使用者手動登入
 */
export async function interactiveLogin(
  locale: string = 'en-US',
  timeout: number = 300000  // 5 分鐘等待登入
): Promise<void> {
  const profileDir = getDefaultProfileDir('amazon');
  const domain = AMAZON_DOMAINS[locale] || 'www.amazon.com';

  console.log('🔐 開啟 Amazon 登入頁面...');
  console.log(`📁 Profile 目錄: ${profileDir}`);

  const context = await launchPersistentContext({
    userDataDir: profileDir,
    headless: false,  // 必須可視
    locale,
    timeout,
  });

  try {
    const page = context.pages()[0] || await context.newPage();

    // 導航到 Amazon 首頁
    await page.goto(`https://${domain}`, { waitUntil: 'domcontentloaded' });
    await randomDelay(1000, 2000);

    // 檢查是否已登入
    if (await isLoggedIn(page)) {
      console.log('✅ 已偵測到登入狀態，無需重新登入');
      await context.close();
      return;
    }

    // 導航到登入頁
    console.log('📄 導航到登入頁面...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  請在瀏覽器中完成 Amazon 登入');
    console.log('  登入成功後，此程式會自動偵測並關閉瀏覽器');
    console.log('  如遇到 CAPTCHA，請手動完成驗證');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    // 等待登入完成
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      await randomDelay(2000, 3000);

      // 檢查是否回到首頁（登入成功）
      const currentUrl = page.url();
      if (!currentUrl.includes('/ap/signin') && !currentUrl.includes('/ap/register') && !currentUrl.includes('/ap/mfa')) {
        // 再次確認登入狀態
        if (await isLoggedIn(page)) {
          console.log('✅ 登入成功！Session 已保存');
          await randomDelay(1000, 2000);
          await context.close();
          return;
        }
      }

      // 顯示等待狀態
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      process.stdout.write(`\r⏳ 等待登入中... (${elapsed}s)`);
    }

    console.log('\n⚠️ 登入超時，請重新執行');
    await context.close();
  } catch (err) {
    console.error('❌ 登入過程發生錯誤:', err);
    await context.close();
    throw err;
  }
}

/**
 * 取得已登入的 persistent context
 * 如果未登入會拋出錯誤
 */
export async function getAuthenticatedContext(
  locale: string = 'en-US',
  options: { headless?: boolean; timeout?: number } = {}
): Promise<BrowserContext> {
  const profileDir = getDefaultProfileDir('amazon');
  const domain = AMAZON_DOMAINS[locale] || 'www.amazon.com';

  const context = await launchPersistentContext({
    userDataDir: profileDir,
    headless: options.headless ?? true,
    locale,
    timeout: options.timeout ?? 30000,
  });

  // 驗證登入狀態
  const page = context.pages()[0] || await context.newPage();
  await page.goto(`https://${domain}`, { waitUntil: 'domcontentloaded' });
  await randomDelay(1000, 2000);

  if (!await isLoggedIn(page)) {
    await context.close();
    throw new Error('未登入 Amazon，請先執行 --login 進行登入');
  }

  return context;
}
