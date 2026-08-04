import { Injectable, NotFoundException } from "@nestjs/common";
import HTMLtoDOCX from "html-to-docx";
import { chromium } from "playwright";
import { AuthenticatedUser } from "../auth/auth.types";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService
  ) {}

  async exportPdf(id: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, id, ["VIEWER"]);
    const document = await this.getDocument(id);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(this.renderExportHtml(document.title, document.htmlContent), {
        waitUntil: "networkidle"
      });
      return page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" }
      });
    } finally {
      await browser.close();
    }
  }

  async exportDocx(id: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, id, ["VIEWER"]);
    const document = await this.getDocument(id);
    return HTMLtoDOCX(document.htmlContent, undefined, {
      title: document.title,
      footer: true,
      pageNumber: true
    });
  }

  private async getDocument(id: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) {
      throw new NotFoundException("Document not found");
    }
    return document;
  }

  private renderExportHtml(title: string, content: string) {
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #20252b; line-height: 1.58; }
    h1, h2, h3 { color: #245a73; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d8d1c3; padding: 8px; text-align: left; }
    img { max-width: 100%; }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(title)}</h1>
  ${content}
</body>
</html>`;
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
