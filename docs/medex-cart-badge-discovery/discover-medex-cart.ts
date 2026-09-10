import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const WEB_BASE = process.env.BASE_URL ?? 'https://app-stg.arincare.com';
const USERNAME = process.env.TEST_USERNAME ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';
const COMPANY_NAME = process.env.COMPANY_NAME ?? 'Arincare Pharmacy';

const OUT = __dirname;
function save(name: string, content: string) {
  fs.writeFileSync(path.join(OUT, name), content, 'utf-8');
  console.log('saved', name);
}

(async () => {
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false', slowMo: 50 });
  const page = await (await browser.newContext({ locale: 'th-TH' })).newPage();

  console.log('1. login...');
  await page.goto(`${WEB_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#preloader', { state: 'hidden', timeout: 15000 }).catch(() => {});
  console.log('page title:', await page.title());
  console.log('page url:', page.url());
  await page.screenshot({ path: path.join(OUT, '00-login-page.png'), fullPage: true }).catch(() => {});
  save('00-login-page.html', await page.content());
  await page.locator('input[name="email"]').fill(USERNAME);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('#login-btn').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  console.log('2. select company...');
  const companyEl = page.getByText(COMPANY_NAME, { exact: false }).first();
  if (await companyEl.isVisible({ timeout: 8000 }).catch(() => false)) {
    await companyEl.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
  }

  console.log('3. goto marketplace (no branch select)...');
  await page.goto(`${WEB_BASE}/companies/marketplace?page=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, '01-marketplace-initial.png'), fullPage: false });
  console.log('URL after nav:', page.url());

  // close cart-restore modal ("การกู้ข้อมูลตะกร้าสินค้า") or any other leftover modal if present
  const anyModalCloseBtn = page.locator('.modal.in button.close, .modal.fade.in [aria-label="Close"], .modal.in button:has-text("×")').first();
  if (await anyModalCloseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('closing leftover modal (e.g. cart-restore notice)...');
    await anyModalCloseBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Dump header area (look for cart icon)
  const headerHtml = await page.evaluate(() => {
    const header = document.querySelector('header') || document.querySelector('nav') || document.body;
    return header ? header.outerHTML.slice(0, 8000) : 'NO HEADER FOUND';
  });
  save('dom-header.html', headerHtml);

  // Try to find cart-related elements by common patterns
  const cartCandidates = await page.evaluate(() => {
    const results: any[] = [];
    const all = Array.from(document.querySelectorAll('a,button,div,span'));
    for (const el of all) {
      const text = (el.textContent || '').trim();
      const cls = el.className?.toString?.() || '';
      if (
        text.includes('ตะกร้า') ||
        cls.toLowerCase().includes('cart') ||
        el.getAttribute('href')?.includes('cart')
      ) {
        results.push({
          tag: el.tagName,
          class: cls,
          text: text.slice(0, 60),
          html: el.outerHTML.slice(0, 500),
        });
      }
      if (results.length > 30) break;
    }
    return results;
  });
  save('cart-candidates.json', JSON.stringify(cartCandidates, null, 2));

  // Dump first few product cards
  const productCardsHtml = await page.evaluate(() => {
    // heuristics: look for repeated card-like containers with a price and a button
    const candidates = Array.from(document.querySelectorAll('[class*="product"], [class*="card"]'));
    return candidates.slice(0, 3).map((el) => el.outerHTML.slice(0, 3000));
  });
  save('dom-product-cards.json', JSON.stringify(productCardsHtml, null, 2));

  await page.screenshot({ path: path.join(OUT, '02-marketplace-full.png'), fullPage: true });

  console.log('4. try clicking first "เพิ่มสินค้าลงตะกร้า" button...');
  const firstCard = page.locator('.link-product').first();
  const addBtn = firstCard.locator('button:has-text("เพิ่มสินค้าลงตะกร้า"), button:has-text("สั่งซื้อสินค้า")').first();
  const addBtnVisible = await addBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('add button visible:', addBtnVisible);
  if (addBtnVisible) {
    const cardBefore = await firstCard.evaluate((el) => el.outerHTML);
    save('dom-card-before-add.html', cardBefore);

    await addBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, '03a-confirm-modal.png'), fullPage: false });
    save('dom-confirm-modal.html', await page.evaluate(() => {
      const modal = document.querySelector('.modal.fade.in, .modal.in, [role="dialog"]');
      return modal ? modal.outerHTML : 'NO CONFIRM MODAL FOUND';
    }));

    // confirm the "ยืนยันการเพิ่มสินค้า" modal if present
    const confirmBtn = page.locator('button:has-text("ตกลง")').first();
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('confirm modal found, clicking ตกลง...');
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('no confirm modal appeared');
    }

    await page.screenshot({ path: path.join(OUT, '03-after-add-to-cart.png'), fullPage: false });
    const cardAfter = await firstCard.evaluate((el) => el.outerHTML).catch(() => 'ERROR reading card after add');
    save('dom-card-after-add.html', cardAfter);
  }

  console.log('5. try clicking cart icon...');
  // close any leftover modal/backdrop first
  const closeBtn = page.locator('button:has-text("ยกเลิก"), .modal button.close, [aria-label="Close"]').first();
  if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);

  const cartIcon = page.locator('#nav-cart-button');
  let cartHovered = false;
  if (await cartIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('found cart icon: #nav-cart-button — HOVERING (not clicking) per user confirmation');
    await cartIcon.hover();
    cartHovered = true;
  }
  console.log('cart hovered:', cartHovered);
  if (cartHovered) {
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, '04-cart-popup-hover.png'), fullPage: false });
    console.log('URL after hover (should be unchanged):', page.url());

    const popupHtml = await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll('[class*="popup"], [class*="dropdown"], [class*="Popup"], [class*="Dropdown"], [class*="preview"], [class*="Preview"]')
      ).filter((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      return candidates.map((el) => ({ class: el.className.toString(), html: el.outerHTML.slice(0, 6000) }));
    });
    save('dom-cart-popup-hover.json', JSON.stringify(popupHtml, null, 2));

    // find by the exact text seen in the popup header ("รายการในตะกร้า") and walk up to a reasonably-sized ancestor
    const byText = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.textContent && node.textContent.includes('รายการในตะกร้า')) {
          let el: Element | null = node.parentElement;
          for (let i = 0; i < 8 && el; i++) {
            if (el.outerHTML.length > 400) break;
            el = el.parentElement;
          }
          return el ? { tag: el.tagName, class: el.className?.toString(), id: (el as HTMLElement).id, html: el.outerHTML.slice(0, 8000) } : null;
        }
      }
      return null;
    });
    save('dom-cart-popup-by-text.json', JSON.stringify(byText, null, 2));

    const popoverFull = await page.evaluate(() => {
      const header = document.querySelector('.cart-popover-header');
      if (!header) return 'NOT FOUND';
      // header, content, footer are siblings — capture their common direct parent only (1 level up)
      const container = header.parentElement;
      return container ? container.outerHTML : header.outerHTML;
    });
    save('dom-cart-popover-full.html', popoverFull.length > 20000 ? popoverFull.slice(0, 20000) + '\n...[TRUNCATED]' : popoverFull);

    // also dump the direct parent/sibling area of the cart button in case popup is a sibling, not matched above
    const cartButtonAreaHtml = await cartIcon.evaluate((el) => {
      const parent = el.closest('div')?.parentElement;
      return parent ? parent.outerHTML.slice(0, 10000) : 'NO PARENT FOUND';
    });
    save('dom-cart-button-area.html', cartButtonAreaHtml);
  }

  console.log('6. goto full cart page to inspect row/delete-button structure...');
  await page.goto(`${WEB_BASE}/companies/marketplace/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '05-cart-page.png'), fullPage: true });
  const cartPageRow = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr'));
    const row = rows.find((r) => r.textContent?.includes('ACCIN-BP'));
    return row ? row.outerHTML : 'ROW NOT FOUND';
  });
  save('dom-cart-page-row.html', cartPageRow);

  console.log('DONE. Files saved to', OUT);
  await browser.close();
})().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
