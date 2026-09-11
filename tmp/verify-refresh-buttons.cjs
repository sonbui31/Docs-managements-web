const { chromium } = require("../BE/node_modules/playwright");

const FE = "http://localhost:5173";
const account = { email: "son@yopmail.com", password: "Abc@1234" };

async function closeBlockingModals(page) {
  for (let i = 0; i < 3; i += 1) {
    const closeByText = page.getByRole("button", { name: /Đóng|Hủy/i }).last();
    const closeIcon = page.locator(".modal-backdrop button, .share-modal-backdrop button").filter({ hasText: /^$/ }).last();
    if (await closeByText.isVisible().catch(() => false)) {
      await closeByText.click().catch(() => null);
      await page.waitForTimeout(300);
    } else if (await closeIcon.isVisible().catch(() => false)) {
      await closeIcon.click().catch(() => null);
      await page.waitForTimeout(300);
    } else {
      await page.keyboard.press("Escape").catch(() => null);
      await page.waitForTimeout(200);
      if (!(await page.locator(".modal-backdrop, .share-modal-backdrop").first().isVisible().catch(() => false))) break;
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const requests = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/")) {
      requests.push({ method: request.method(), url: request.url() });
    }
  });

  await page.goto(FE, { waitUntil: "networkidle" });
  await page.locator('input[placeholder="Email"]').fill(account.email);
  await page.locator('input[placeholder="Nhập mật khẩu"]').fill(account.password);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/v1/auth/login")),
    page.getByRole("button", { name: /Đăng Nhập Hệ Thống/i }).click()
  ]);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await closeBlockingModals(page);

  await page.getByRole("button", { name: /Workboard/i }).click();
  await page.waitForTimeout(1000);
  const beforeWorkboard = requests.length;
  await page.locator(".topbar-actions .exec-action.secondary").filter({ hasText: /Làm mới|Đang tải/i }).click();
  await page.waitForTimeout(1500);
  const workboardRefreshRequests = requests.slice(beforeWorkboard).filter((request) => request.url.includes("/api/v1/work-items/project/"));
  console.log(`workboardRefreshRequests=${workboardRefreshRequests.length}`);

  await closeBlockingModals(page);
  await page.getByRole("button", { name: /Quản trị/i }).click();
  await page.waitForTimeout(1200);
  const roleFilter = page.locator(".admin-filter-select-item .form-select-trigger").first();
  if (await roleFilter.isVisible().catch(() => false)) {
    await roleFilter.click();
    await page.waitForTimeout(300);
  }
  const beforeAdmin = requests.length;
  await page.locator(".topbar-actions .exec-action.secondary").filter({ hasText: /Làm mới/i }).click();
  await page.waitForTimeout(1500);
  const adminRefreshRequests = requests.slice(beforeAdmin).filter((request) => request.url.endsWith("/api/v1/users"));
  console.log(`adminRefreshRequests=${adminRefreshRequests.length}`);

  await browser.close();
  process.exitCode = workboardRefreshRequests.length > 0 && adminRefreshRequests.length > 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
