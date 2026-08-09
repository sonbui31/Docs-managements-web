import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import HTMLtoDOCX from "html-to-docx";
import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { Browser, chromium } from "playwright";
import { AuthenticatedUser } from "../auth/auth.types";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";

type ExportDocument = Prisma.DocumentGetPayload<{
  include: { project: { select: { code: true; name: true; client: true } } };
}>;

@Injectable()
export class ExportsService {
  private browserPromise: Promise<Browser> | null = null;
  private readonly cacheDir = join(process.cwd(), ".export-cache");

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService
  ) {}

  async exportPdf(id: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, id, ["VIEWER"]);
    const document = await this.getDocument(id);
    const filename = this.exportFilename(document, "pdf");
    const cached = await this.readCachedExport(document, "pdf", filename);
    if (cached) return cached;

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(this.renderExportHtml(document, user), { waitUntil: "domcontentloaded" });
      await this.waitForImages(page, 6000);
      const buffer = await page.pdf(this.pdfOptions(document));
      await this.writeCachedExport(document, "pdf", buffer);
      return { buffer, filename };
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  async exportDocx(id: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, id, ["VIEWER"]);
    const document = await this.getDocument(id);
    const filename = this.exportFilename(document, "docx");
    const cached = await this.readCachedExport(document, "docx", filename);
    if (cached) return cached;

    const buffer = await HTMLtoDOCX(this.renderDocxHtml(document, user), undefined, {
      title: document.title,
      footer: true,
      pageNumber: true
    });
    await this.writeCachedExport(document, "docx", buffer);
    return { buffer, filename };
  }

  private async getDocument(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: { project: { select: { code: true, name: true, client: true } } }
    });
    if (!document) {
      throw new NotFoundException("Document not found");
    }
    return document;
  }

  private renderDocxHtml(document: ExportDocument, user: AuthenticatedUser) {
    const content = this.prepareDocxContent(document.htmlContent);
    return `
      <h1>${this.escapeHtml(document.title)}</h1>
      ${this.renderMetadata(document, user)}
      ${content}
    `;
  }

  private renderExportHtml(document: ExportDocument, user: AuthenticatedUser) {
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, "Helvetica Neue", sans-serif;
      color: #0f172a;
      line-height: 1.58;
      font-size: 12px;
    }
    .export-cover {
      border-bottom: 2px solid #4f46e5;
      margin-bottom: 22px;
      padding-bottom: 16px;
      break-inside: avoid;
    }
    .export-eyebrow {
      margin: 0 0 6px;
      text-transform: uppercase;
      letter-spacing: .08em;
      font-size: 10px;
      font-weight: 700;
      color: #4f46e5;
    }
    h1 {
      margin: 0;
      color: #111827;
      font-size: 28px;
      line-height: 1.2;
    }
    h2, h3, h4 {
      color: #245a73;
      break-after: avoid;
    }
    p, li { orphans: 3; widows: 3; }
    table {
      width: 100%;
      border-collapse: collapse;
      break-inside: auto;
      margin: 12px 0;
    }
    tr { break-inside: avoid; }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 8px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #f1f5f9; }
    img {
      max-width: 100%;
      height: auto;
      break-inside: avoid;
    }
    pre, code {
      font-family: Consolas, monospace;
      background: #f8fafc;
      border-radius: 4px;
    }
    pre {
      padding: 10px;
      white-space: pre-wrap;
      border: 1px solid #e2e8f0;
      break-inside: avoid;
    }
    .export-meta {
      margin-top: 14px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      color: #475569;
      font-size: 11px;
    }
    .export-meta strong {
      color: #0f172a;
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .pdf-text-layer { display: none !important; }
    .pdf-hybrid-page {
      position: relative;
      max-width: 100% !important;
      height: auto !important;
      margin: 0 auto 14px;
      break-inside: avoid;
    }
    .pdf-page-bg { width: 100%; height: auto; display: block; }
  </style>
</head>
<body>
  <section class="export-cover">
    <p class="export-eyebrow">Tài liệu xuất bản</p>
    <h1>${this.escapeHtml(document.title)}</h1>
    ${this.renderMetadata(document, user)}
  </section>
  ${document.htmlContent}
</body>
</html>`;
  }

  private renderMetadata(document: ExportDocument, user: AuthenticatedUser) {
    return `<div class="export-meta">
      <div><strong>Dự án</strong>${this.escapeHtml(document.project.code)} - ${this.escapeHtml(document.project.name)}</div>
      <div><strong>Khách hàng</strong>${this.escapeHtml(document.project.client ?? "Internal Team")}</div>
      <div><strong>Phiên bản</strong>${this.escapeHtml(document.currentVersion)}</div>
      <div><strong>Ngày xuất</strong>${new Date().toLocaleString("vi-VN")}</div>
      <div><strong>Người xuất</strong>${this.escapeHtml(user.name || user.email)}</div>
      <div><strong>Loại tài liệu</strong>${this.escapeHtml(document.type)}</div>
    </div>`;
  }

  private async waitForImages(page: import("playwright").Page, timeoutMs: number) {
    await page.evaluate(async (timeout) => {
      const images = Array.from(document.images);
      const timer = new Promise<void>((resolve) => window.setTimeout(resolve, timeout));
      const imageLoads = Promise.all(
        images.map((image) => {
          image.loading = "eager";
          if (image.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            image.onload = () => resolve();
            image.onerror = () => resolve();
          });
        })
      ).then(() => undefined);
      await Promise.race([imageLoads, timer]);
    }, timeoutMs);
  }

  private pdfOptions(document: ExportDocument) {
    return {
      format: "A4" as const,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:8px;color:#64748b;width:100%;padding:0 16mm;">${this.escapeHtml(document.project.code)} - ${this.escapeHtml(document.title)}</div>`,
      footerTemplate: `<div style="font-size:8px;color:#64748b;width:100%;padding:0 16mm;display:flex;justify-content:space-between;"><span>Docs Management</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`,
      margin: { top: "22mm", right: "16mm", bottom: "22mm", left: "16mm" }
    };
  }

  private async getBrowser() {
    this.browserPromise ??= chromium.launch({ headless: true });
    return this.browserPromise;
  }

  private async readCachedExport(document: ExportDocument, extension: "pdf" | "docx", filename: string) {
    const cachePath = this.cachePath(document, extension);
    const buffer = await readFile(cachePath).catch(() => null);
    return buffer ? { buffer, filename } : null;
  }

  private async writeCachedExport(document: ExportDocument, extension: "pdf" | "docx", buffer: Buffer) {
    await mkdir(this.cacheDir, { recursive: true });
    await writeFile(this.cachePath(document, extension), buffer);
  }

  private cachePath(document: ExportDocument, extension: "pdf" | "docx") {
    return join(this.cacheDir, `${this.cacheKey(document, extension)}.${extension}`);
  }

  private cacheKey(document: ExportDocument, extension: "pdf" | "docx") {
    return createHash("sha1")
      .update([document.id, document.currentVersion, document.updatedAt.toISOString(), extension].join(":"))
      .digest("hex");
  }

  private prepareDocxContent(content: string) {
    if (!content.includes("pdf-hybrid-page")) return content;
    return content
      .replace(/<div class="pdf-text-layer"[\s\S]*?<\/div>/g, "")
      .replace(/\sstyle="[^"]*position:[^"]*"/g, "")
      .replace(/class="pdf-page-bg"/g, 'class="pdf-page-bg" style="max-width:100%;height:auto;"');
  }

  private exportFilename(document: ExportDocument, extension: "pdf" | "docx") {
    const name = [document.project.code, document.title, document.currentVersion]
      .map((part) => this.slug(part))
      .filter(Boolean)
      .join("-");
    return `${name || "document"}.${extension}`;
  }

  private slug(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
