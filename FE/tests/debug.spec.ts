import { test, expect } from '@playwright/test';

test('capture page error on clicking Du An', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    console.log('=== PLAYWRIGHT CAPTURED PAGE ERROR ===');
    console.log(err.stack || err.message);
    errors.push(err.stack || err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('=== PLAYWRIGHT CAPTURED CONSOLE ERROR ===');
      console.log(msg.text());
    }
  });

  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1500);

  // Click on 'Dự án' button in sidebar
  const duAnBtn = page.locator('button', { hasText: /^Dự án/ }).first();
  await duAnBtn.click();
  await page.waitForTimeout(1500);

  if (errors.length > 0) {
    console.log('TOTAL ERRORS DETECTED:', errors.length);
  } else {
    console.log('NO PAGE ERRORS DETECTED');
  }
});
