import { Page } from '@playwright/test';
import fs from 'node:fs';

const DIR = 'screenshots';

/** บันทึก screenshot เข้าโฟลเดอร์ screenshots/ พร้อมตั้งชื่อชัดเจน */
export async function shot(page: Page, name: string) {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  const safe = name.replace(/[^\w\u0E00-\u0E7F.-]+/g, '_');
  await page.screenshot({ path: `${DIR}/${safe}.png`, fullPage: true });
}
