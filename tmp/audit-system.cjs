const { chromium } = require("../BE/node_modules/playwright");

const API = process.env.API_BASE || "http://localhost:3000/api/v1";
const FE = process.env.FE_BASE || "http://localhost:5173";
const PASSWORD = "Abc@1234";
const accounts = {
  admin: { email: "son@yopmail.com", password: PASSWORD },
  manager: { email: "testA@yopmail.com", password: PASSWORD },
  employee: { email: "tuan1@yopmail.com", password: PASSWORD }
};

const results = [];
const timings = [];
let cleanup = { projectId: null, documentId: null, workItemId: null, commentId: null };
let auditCode = `AUD${Date.now().toString().slice(-8)}`;
let adminSession = null;

function record(name, ok, detail = "") {
  const passed = Boolean(ok);
  results.push({ name, ok: passed, detail });
  const marker = passed ? "PASS" : "FAIL";
  console.log(`${marker} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function timed(name, fn) {
  const started = Date.now();
  try {
    return await fn();
  } finally {
    timings.push({ name, ms: Date.now() - started });
  }
}

async function request(method, path, token, body, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const options = { method, headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    if (body instanceof FormData) {
      options.body = body;
    } else {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
  }
  const response = await fetch(`${API}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  let data = null;
  if (contentType.includes("application/json")) data = await response.json().catch(() => null);
  else data = await response.text().catch(() => "");
  return { status: response.status, ok: response.ok, data };
}

async function expectStatus(name, expected, method, path, token, body, extraHeaders) {
  const response = await timed(name, () => request(method, path, token, body, extraHeaders));
  const ok = Array.isArray(expected) ? expected.includes(response.status) : response.status === expected;
  const errorDetail = ok ? "" : `, body=${JSON.stringify(response.data).slice(0, 500)}`;
  record(name, ok, `status=${response.status}, expected=${Array.isArray(expected) ? expected.join("/") : expected}${errorDetail}`);
  return response;
}

async function login(label, account) {
  const response = await timed(`login:${label}`, () =>
    request("POST", "/auth/login", null, { email: account.email, password: account.password })
  );
  const ok = response.ok && response.data?.accessToken && response.data?.user?.email;
  record(`Đăng nhập ${label}`, ok, ok ? `${response.data.user.email}, role=${response.data.user.role}` : JSON.stringify(response.data));
  if (!ok) throw new Error(`Cannot login ${label}`);
  return response.data;
}

async function tryLogin(label, account) {
  try {
    return await login(label, account);
  } catch {
    return null;
  }
}

async function runApiAudit() {
  await expectStatus("Negative auth: sai password bị chặn", 401, "POST", "/auth/login", null, {
    email: accounts.admin.email,
    password: "Wrong@1234"
  });
  await expectStatus("Negative auth: không token không được xem projects", 401, "GET", "/projects");
  await expectStatus("Negative auth: token rác không được /auth/me", 401, "GET", "/auth/me", "bad.token.value");

  const admin = await login("admin", accounts.admin);
  adminSession = admin;
  const manager = await tryLogin("manager", accounts.manager);
  const employee = await tryLogin("employee", accounts.employee);

  const usersResponse = await expectStatus("Admin xem danh sách user", 200, "GET", "/users", admin.accessToken);
  const users = Array.isArray(usersResponse.data) ? usersResponse.data : [];
  const managerUser = users.find((user) => user.email?.toLowerCase() === accounts.manager.email.toLowerCase());
  const employeeUser = users.find((user) => user.email?.toLowerCase() === accounts.employee.email.toLowerCase());
  record("Tìm được manager trong /users", Boolean(managerUser?.id), managerUser?.id || "missing");
  record("Tìm được employee trong /users", Boolean(employeeUser?.id), employeeUser?.id || "missing");

  if (!employee) {
    record("Employee account dùng được cho negative/happy case", false, "không login được employee, bỏ qua nhóm test employee");
  }
  if (!manager) {
    record("Manager account dùng được cho manager happy case", false, "không login được manager, bỏ qua nhóm test manager");
  }

  if (employee) await expectStatus("Employee không được xem admin users", 403, "GET", "/users", employee.accessToken);
  await expectStatus("Validation: reject field lạ khi tạo project", 400, "POST", "/projects", admin.accessToken, {
    name: `Invalid ${auditCode}`,
    unexpected: true
  });

  const projectResponse = await expectStatus("Admin tạo project audit", 201, "POST", "/projects", admin.accessToken, {
    code: auditCode,
    name: `Audit ${auditCode}`,
    client: "Audit Suite"
  });
  if (!projectResponse.ok) throw new Error("Cannot create audit project");
  cleanup.projectId = projectResponse.data.id;

  if (managerUser?.id) {
    await expectStatus("Admin assign manager làm MANAGER project", [200, 201], "POST", `/users/${managerUser.id}/projects`, admin.accessToken, {
      projectId: cleanup.projectId,
      roles: ["MANAGER"]
    });
  }

  const docResponse = await expectStatus("Admin tạo document trong project", 201, "POST", "/documents", admin.accessToken, {
    projectId: cleanup.projectId,
    title: `Audit Document ${auditCode}`,
    type: "BRD",
    htmlContent: "<h3>REQ-001</h3><p>Audit happy path content</p>"
  });
  if (!docResponse.ok) throw new Error("Cannot create audit document");
  cleanup.documentId = docResponse.data.id;

  if (manager) {
    await expectStatus("Manager xem project được cấp quyền", 200, "GET", `/projects/${cleanup.projectId}`, manager.accessToken);
    await expectStatus("Manager cập nhật project được cấp quyền", 200, "PATCH", `/projects/${cleanup.projectId}`, manager.accessToken, {
      name: `Audit ${auditCode} Updated`
    });
    await expectStatus("Manager tạo document trong project được cấp quyền", 201, "POST", "/documents", manager.accessToken, {
      projectId: cleanup.projectId,
      title: `Manager Doc ${auditCode}`,
      type: "SRS",
      htmlContent: "<h3>REQ-MGR</h3><p>Manager can create</p>"
    });
  }

  if (employeeUser?.id) {
    await expectStatus("Admin assign employee VIEWER trên document", [200, 201], "POST", `/users/${employeeUser.id}/documents`, admin.accessToken, {
      documentId: cleanup.documentId,
      roles: ["VIEWER"]
    });
  }
  if (employee) {
    await expectStatus("Employee VIEWER xem document", 200, "GET", `/documents/${cleanup.documentId}`, employee.accessToken);
    await expectStatus("Employee VIEWER không được sửa document", 403, "PATCH", `/documents/${cleanup.documentId}`, employee.accessToken, {
      title: "Viewer must not edit"
    });
    await expectStatus("Employee VIEWER không được comment", 403, "POST", "/comments", employee.accessToken, {
      documentId: cleanup.documentId,
      blockId: "REQ-001",
      selectedText: "Audit",
      content: "Viewer should not comment"
    });
    await expectStatus("Employee VIEWER không được tạo work item", 403, "POST", "/work-items", employee.accessToken, {
      projectId: cleanup.projectId,
      documentId: cleanup.documentId,
      title: "Viewer should not create ticket"
    });
  }

  await expectStatus("Admin deploy document để test work item", 200, "PATCH", `/documents/${cleanup.documentId}`, admin.accessToken, {
    status: "DEPLOYED"
  });

  if (employee && employeeUser?.id) {
    await expectStatus("Admin nâng employee lên REVIEWER document", [200, 201], "POST", `/users/${employeeUser.id}/documents`, admin.accessToken, {
      documentId: cleanup.documentId,
      roles: ["REVIEWER"]
    });
    const commentResponse = await expectStatus("Employee REVIEWER tạo comment", 201, "POST", "/comments", employee.accessToken, {
      documentId: cleanup.documentId,
      blockId: "REQ-001",
      selectedText: "Audit",
      content: `Reviewer comment ${auditCode}`
    });
    if (commentResponse.ok) cleanup.commentId = commentResponse.data.id;
    await expectStatus("Employee sửa comment của mình", 200, "PATCH", `/comments/${cleanup.commentId}`, employee.accessToken, {
      content: `Reviewer comment ${auditCode} edited`
    });
    await expectStatus("Employee resolve comment của mình", 200, "PATCH", `/comments/${cleanup.commentId}/resolve`, employee.accessToken);
  }

  const workItemActor = manager || admin;
  const workItemResponse = await expectStatus(manager ? "Manager tạo work item" : "Admin tạo work item thay manager bị thiếu login", 201, "POST", "/work-items", workItemActor.accessToken, {
    projectId: cleanup.projectId,
    documentId: cleanup.documentId,
    title: `Audit ticket ${auditCode}`,
    type: "TASK",
    priority: "MEDIUM",
    status: "TODO"
  });
  if (workItemResponse.ok) cleanup.workItemId = workItemResponse.data.id;
  if (employee && cleanup.workItemId) {
    await expectStatus("Employee REVIEWER xem work item", 200, "GET", `/work-items/${cleanup.workItemId}`, employee.accessToken);
    await expectStatus("Employee REVIEWER cập nhật work item", 200, "PATCH", `/work-items/${cleanup.workItemId}`, employee.accessToken, {
      status: "IN_PROGRESS"
    });
  }

  if (employee && employeeUser?.id) {
    await expectStatus("Admin hạ employee xuống VIEWER project", [200, 201], "POST", `/users/${employeeUser.id}/projects`, admin.accessToken, {
      projectId: cleanup.projectId,
      roles: ["VIEWER"]
    });
    await expectStatus("Employee không được xóa project", 403, "DELETE", `/projects/${cleanup.projectId}`, employee.accessToken);
  }

  const form = new FormData();
  form.append("projectId", cleanup.projectId);
  form.append("file", new Blob(["not an image"], { type: "text/plain" }), "audit.txt");
  await expectStatus("Upload security: media reject file .txt", 400, "POST", "/media/upload", admin.accessToken, form);
}

async function runUiAudit() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const consoleErrors = [];
  const apiRequests = [];
  const shareWrites = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleErrors.push(`${message.type()}: ${message.text()}`);
  });
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/api/v1/")) apiRequests.push({ method: request.method(), url });
    if (/\/api\/v1\/users\/.+\/(projects|documents)/.test(url) && ["POST", "PATCH", "DELETE"].includes(request.method())) {
      shareWrites.push({ method: request.method(), url });
    }
  });

  const started = Date.now();
  await page.goto(FE, { waitUntil: "networkidle" });
  const emailInput = page.locator('input[placeholder="Email"]').first();
  await emailInput.fill(accounts.admin.email);
  await page.locator('input[placeholder="Nhập mật khẩu"]').first().fill(accounts.admin.password);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/v1/auth/login")).catch(() => null),
    page.getByRole("button", { name: /Đăng Nhập Hệ Thống/i }).click()
  ]);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  const loginMs = Date.now() - started;
  const hasWorkspace = await page.locator(".app-shell, .document-row, .share-highlight-btn").first().isVisible().catch(() => false);
  record("UI admin login vào workspace", hasWorkspace, `time=${loginMs}ms, apiRequests=${apiRequests.length}`);

  const beforeReloadRequests = apiRequests.length;
  const reloadStarted = Date.now();
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  record("UI reload không crash", await page.getByText(/Dự án|Tài liệu|Workboard|Dashboard/i).first().isVisible().catch(() => false), `time=${Date.now() - reloadStarted}ms, apiRequests=${apiRequests.length - beforeReloadRequests}`);

  const documentRow = page.locator(".document-row").first();
  if (await documentRow.count()) {
    await documentRow.hover();
    await page.waitForTimeout(600);
    record("UI hover document không phát sinh console error nghiêm trọng", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" || "));
  } else {
    record("UI có document row để test prefetch hover", false, "không tìm thấy .document-row");
  }

  const shareButton = page.locator(".share-highlight-btn").first();
  if (await shareButton.count()) {
    await shareButton.hover();
    await page.waitForTimeout(500);
    const writesBeforeOpen = shareWrites.length;
    await shareButton.click();
    await page.waitForTimeout(900);
    const roleButtons = page.getByRole("button", { name: /Bình luận|Sửa|Quản lý|Xem/i });
    const count = await roleButtons.count();
    if (count > 0) {
      await roleButtons.nth(Math.min(1, count - 1)).click();
      await page.waitForTimeout(800);
      record("UI share role click chưa gọi API trước nút Xong", shareWrites.length === writesBeforeOpen, `writesAfterRoleClick=${shareWrites.length - writesBeforeOpen}`);
    } else {
      record("UI share modal có role button", false, "không tìm thấy role button");
    }
  } else {
    record("UI có nút Chia sẻ", false, "không tìm thấy .share-highlight-btn");
  }

  await page.screenshot({ path: "tmp/audit-ui-final.png", fullPage: true });
  await browser.close();
}

async function cleanupAudit() {
  const token = adminSession?.accessToken || (await login("admin-cleanup", accounts.admin)).accessToken;
  if (cleanup.projectId) {
    const response = await request("DELETE", `/projects/${cleanup.projectId}`, token);
    record("Cleanup project audit", [200, 404].includes(response.status), `status=${response.status}`);
  }
}

async function runRateLimitAudit() {
  let saw429 = false;
  for (let i = 0; i < 12; i += 1) {
    const response = await request("POST", "/auth/login", null, { email: `nope-${auditCode}@yopmail.com`, password: "bad" });
    if (response.status === 429) {
      saw429 = true;
      break;
    }
  }
  record("Rate limit login phát 429 sau nhiều request sai", saw429, saw429 ? "429 observed" : "không thấy 429 trong 12 lần");
}

async function main() {
  try {
    await runApiAudit();
    await runUiAudit();
  } catch (error) {
    record("Audit runner không bị crash", false, error.stack || error.message);
  } finally {
    try {
      await cleanupAudit();
    } catch (error) {
      record("Cleanup không bị crash", false, error.stack || error.message);
    }
    try {
      await runRateLimitAudit();
    } catch (error) {
      record("Rate limit audit không bị crash", false, error.stack || error.message);
    }
    console.log("\nSUMMARY_JSON_START");
    console.log(JSON.stringify({ results, timings, cleanup, auditCode }, null, 2));
    console.log("SUMMARY_JSON_END");
    const failed = results.filter((result) => !result.ok);
    process.exitCode = failed.length ? 1 : 0;
  }
}

main();
