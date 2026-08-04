import { BadRequestException, Injectable } from "@nestjs/common";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import sanitizeHtml = require("sanitize-html");
import * as showdown from "showdown";
import { AuthenticatedUser } from "../auth/auth.types";
import { DocumentsService } from "../documents/documents.service";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { ImportDocumentDto } from "./dto/import-document.dto";

@Injectable()
export class ImportsService {
  private readonly markdownConverter = new showdown.Converter({
    tables: true,
    strikethrough: true,
    tasklists: true,
    simplifiedAutoLink: true
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService,
    private readonly permissions: PermissionsService
  ) {}

  async importDocument(file: Express.Multer.File | undefined, dto: ImportDocumentDto, user: AuthenticatedUser) {
    if (!file) {
      throw new BadRequestException("File is required");
    }

    await this.permissions.assertProjectRole(user, dto.projectId, ["EDITOR", "MANAGER"]);

    const importJob = await this.prisma.importJob.create({
      data: {
        projectId: dto.projectId,
        sourceFileName: file.originalname,
        sourceFileType: file.mimetype
      }
    });

    try {
      const htmlContent = await this.convertToHtml(file);
      const document = await this.documentsService.create({
        projectId: dto.projectId,
        title: dto.title ?? this.titleFromFileName(file.originalname),
        type: dto.type ?? this.typeFromFileName(file.originalname),
        htmlContent,
        sourceType: "imported",
        sourceFileName: file.originalname
      }, user);

      await this.prisma.importJob.update({
        where: { id: importJob.id },
        data: {
          documentId: document.id,
          status: "COMPLETED",
          completedAt: new Date()
        }
      });

      return document;
    } catch (error) {
      await this.prisma.importJob.update({
        where: { id: importJob.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Unknown import error"
        }
      });
      throw error;
    }
  }

  private async convertToHtml(file: Express.Multer.File) {
    const extension = file.originalname.split(".").pop()?.toLowerCase();

    if (extension === "md") {
      return this.cleanHtml(this.markdownConverter.makeHtml(file.buffer.toString("utf8")));
    }

    if (extension === "docx") {
      const result = await mammoth.convertToHtml({ buffer: file.buffer });
      return this.cleanHtml(result.value);
    }

    if (extension === "pdf") {
      const result = await pdfParse(file.buffer);
      const paragraphs = result.text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph) => `<p>${this.escapeHtml(paragraph)}</p>`)
        .join("\n");
      return this.cleanHtml(paragraphs);
    }

    throw new BadRequestException("Only .md, .docx and .pdf files are supported");
  }

  private cleanHtml(html: string) {
    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "table", "thead", "tbody", "tr", "th", "td"]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        "*": ["data-block-id", "class"],
        img: ["src", "alt", "width", "height"]
      }
    });
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private titleFromFileName(fileName: string) {
    return fileName.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
  }

  private typeFromFileName(fileName: string) {
    const normalized = fileName.toLowerCase();
    if (normalized.includes("brd")) return "BRD";
    if (normalized.includes("srs")) return "SRS";
    if (normalized.includes("change")) return "CR";
    if (normalized.includes("uat")) return "UAT";
    return "DOC";
  }
}
