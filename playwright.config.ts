import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,            // ฟอร์มสร้างลูกค้าใช้ session ร่วม → รันแบบ serial ปลอดภัยกว่า
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://app-stg.arincare.com',
    headless: process.env.HEADLESS !== 'false',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'on',              // บันทึก screenshot ทุกเทสตามที่ requirement กำหนด
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-liff',
      use: {
        browserName: 'chromium',
        ...devices['iPhone 13'],
        locale: 'th-TH',
        timezoneId: 'Asia/Bangkok',
        permissions: ['camera', 'geolocation'],
        launchOptions: {
          // ใช้ fake camera device แทน webcam จริง
          // → Chromium แสดง test pattern video ให้ KYC step ถ่ายรูปได้โดยไม่ต้องมีกล้องจริง
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
          ],
        },
      },
      testMatch: ['**/liff-patient.spec.ts', '**/liff-ekyc.spec.ts'],
    },
  ],
});
