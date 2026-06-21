import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';
import { CustomerFormPage } from '../pages/CustomerFormPage.js';

type Fixtures = {
  loginPage: LoginPage;
  customerForm: CustomerFormPage;
  loggedIn: void;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
  customerForm: async ({ page }, use) => { await use(new CustomerFormPage(page)); },

  // login + เลือกบริษัท ก่อนทุกเทสที่ใช้ fixture นี้
  loggedIn: async ({ loginPage }, use) => {
    await loginPage.goto();
    await loginPage.login(
      process.env.TEST_USERNAME ?? 'watcharin.arincare@gmail.com',
      process.env.TEST_PASSWORD ?? '01072024',
    );
    await loginPage.selectCompany(process.env.COMPANY_NAME ?? 'Arincare Pharmacy');
    await loginPage.expectLoggedIn();
    await use();
  },
});

export const expect = test.expect;
