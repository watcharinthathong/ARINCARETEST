import { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE_DIR = 'screenshots';

/** บันทึก screenshot เข้าโฟลเดอร์ screenshots/<project>/ พร้อมตั้งชื่อชัดเจน */
export async function shot(page: Page, name: string) {
  const safe = name.replace(/[^\w฀-๿./-]+/g, '_');
  const filePath = `${BASE_DIR}/${safe}.png`;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: filePath, fullPage: true });
}
