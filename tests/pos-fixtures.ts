import { test as base } from '@playwright/test';
import { PosRegisterPage } from '../pages/PosRegisterPage.js';

type PosFixtures = {
  posRegister: PosRegisterPage;
  posLoggedIn: void;
};

export const test = base.extend<PosFixtures>({
  posRegister: async ({ page }, use) => {
    await use(new PosRegisterPage(page));
  },

  // เข้าสู่ระบบ POS ครบทุกขั้นตอนก่อนแต่ละเทส
  posLoggedIn: async ({ posRegister }, use) => {
    await posRegister.goto();
    await posRegister.loginToPos();
    await use();
  },
});

export const expect = test.expect;
