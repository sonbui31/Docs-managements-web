const { chromium } = require("../BE/node_modules/playwright");

const FE = process.env.FE_BASE || "http://localhost:5173";
const API = process.env.API_BASE || "http://localhost:3000/api/v1";
const account = { email: "son@yopmail.com", password: "Abc@1234" };
const employeeEmail = "tuan1@yopmail.com";
const results = [];
let adminToken = null;
let temporaryProjectPermission = null;

function record(name, ok, detail = "") {
  const passed = Boolean(ok);
  results.push({ name, ok: passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function closeBlockingModals(page) {
  for (const name of [/Đóng/i, /×|x/i]) {
    const button = page.getByRole("button", { name }).last();
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => null);
      await page.waitForTimeout(400);
    }
  }
}

async function api(method, path, body) {
  const headers = adminToken ? { Authorization: `Bearer ${adminToken}` } : {};
  const options = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, data };
}

async function loginApi() {
  const response = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(account)
  });
  const data = await response.json();
  adminToken = data.accessToken;
  return data;
}

async function ensureTemporaryProjectPermission(projectName) {
  if (!adminToken || !projectName) return;
  const quoted = projectName.match(/"([^"]+)"/)?.[1];
  const normalizedProjectName = quoted || projectName.replace(/^Chia sẻ\s+/i, "").trim();
  const [usersResponse, projectsResponse] = await Promise.all([
    api("GET", "/users"),
    api("GET", "/projects")
  ]);
  const employee = usersResponse.data?.find((user) => user.email?.toLowerCase() === employeeEmail);
  const project = projectsResponse.data?.find((item) => item.name === normalizedProjectName) || projectsResponse.data?.[0];
  if (!employee?.id || !project?.id) return;
  await api("POST", `/users/${employee.id}/projects`, { projectId: project.id, roles: ["VIEWER"] });
  temporaryProjectPermission = { userId: employee.id, projectId: project.id };
}

async function cleanupTemporaryProjectPermission() {
  if (!temporaryProjectPermission) return;
  await api("DELETE", `/users/${temporaryProjectPermission.userId}/projects/${temporaryProjectPermission.projectId}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const apiRequests = [];
  const shareWrites = [];
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/api/v1/")) apiRequests.push({ method: request.method(), url });
    if (/\/api\/v1\/users\/.+\/(projects|documents)/.test(url) && ["POST", "PATCH", "DELETE"].includes(request.method())) {
      shareWrites.push({ method: request.method(), url });
    }
  });

  try {
    await loginApi();
    const started = Date.now();
    await page.goto(FE, { waitUntil: "networkidle" });
    await page.locator('input[placeholder="Email"]').fill(account.email);
    await page.locator('input[placeholder="Nhập mật khẩu"]').fill(account.password);
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/v1/auth/login")),
      page.getByRole("button", { name: /Đăng Nhập Hệ Thống/i }).click()
    ]);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);
    await closeBlockingModals(page);
    record("UI login thật vào app", await page.locator(".app-shell").isVisible().catch(() => false), `time=${Date.now() - started}ms, api=${apiRequests.length}`);

    const reloadStart = Date.now();
    const beforeReload = apiRequests.length;
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await closeBlockingModals(page);
    record("UI reload workspace", await page.locator(".app-shell").isVisible().catch(() => false), `time=${Date.now() - reloadStart}ms, api=${apiRequests.length - beforeReload}`);

    const docNav = page.getByRole("button", { name: /Tài liệu/i }).first();
    if (await docNav.isVisible().catch(() => false)) {
      await docNav.click();
      await page.waitForLoadState("networkidle").catch(() => null);
      await page.waitForTimeout(1000);
    }

    const rowCount = await page.locator(".document-row").count();
    record("UI có document rows sau khi vào tab tài liệu", rowCount > 0, `rows=${rowCount}`);
    if (rowCount > 0) {
      const beforeHover = apiRequests.length;
      await page.locator(".document-row").first().hover();
      await page.waitForTimeout(800);
      record("UI hover document chạy ổn", consoleErrors.length === 0, `newApi=${apiRequests.length - beforeHover}, consoleErrors=${consoleErrors.length}`);
      await page.locator(".document-row").first().click();
      await page.waitForTimeout(1000);
    }

    const shareButton = page.locator(".share-highlight-btn").first();
    record("UI có nút Chia sẻ trên reader", await shareButton.isVisible().catch(() => false));
    if (await shareButton.isVisible().catch(() => false)) {
      const beforeHoverShare = apiRequests.length;
      await shareButton.hover();
      await page.waitForTimeout(600);
      record("UI hover share prefetch không lỗi", consoleErrors.length === 0, `newApi=${apiRequests.length - beforeHoverShare}`);
      const writesBefore = shareWrites.length;
      await shareButton.click();
      await page.waitForTimeout(1000);
      let roleButtons = page.locator(".share-modal-backdrop .share-access-section:not(.inherited) .share-access-item .share-role-check:not([disabled])");
      let roleCount = await roleButtons.count();
      if (roleCount === 0) {
        await page.locator(".share-modal-backdrop .share-scope-tabs button").nth(1).click();
        await page.waitForTimeout(1000);
        const modalTitle = await page.locator(".share-modal-backdrop h3").first().innerText().catch(() => "");
        await ensureTemporaryProjectPermission(modalTitle);
        await page.locator(".share-modal-backdrop .share-scope-tabs button").nth(0).click();
        await page.waitForTimeout(500);
        await page.locator(".share-modal-backdrop .share-scope-tabs button").nth(1).click();
        await page.waitForTimeout(1000);
        roleButtons = page.locator(".share-modal-backdrop .share-access-section:not(.inherited) .share-access-item .share-role-check:not([disabled])");
        roleCount = await roleButtons.count();
      }
      record("UI share modal có role buttons", roleCount > 0, `buttons=${roleCount}`);
      if (roleCount > 0) {
        await roleButtons.nth(Math.min(1, roleCount - 1)).click();
        await page.waitForTimeout(800);
        record("UI chọn role chưa ghi API trước nút Xong", shareWrites.length === writesBefore, `writes=${shareWrites.length - writesBefore}`);
      }
    }

    await page.screenshot({ path: "tmp/audit-ui-detail.png", fullPage: true });
  } catch (error) {
    record("UI runner không crash", false, error.stack || error.message);
  } finally {
    await cleanupTemporaryProjectPermission().catch((error) => {
      record("UI cleanup quyền tạm không crash", false, error.stack || error.message);
    });
    await browser.close();
    console.log("\nSUMMARY_JSON_START");
    console.log(JSON.stringify({ results }, null, 2));
    console.log("SUMMARY_JSON_END");
    process.exitCode = results.some((result) => !result.ok) ? 1 : 0;
  }
}

main();
