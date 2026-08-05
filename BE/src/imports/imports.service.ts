import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import mammoth = require("mammoth");
import pdfParse = require("pdf-parse");
import sanitizeHtml = require("sanitize-html");
import * as showdown from "showdown";
import { AuthenticatedUser } from "../auth/auth.types";
import { DocumentsService } from "../documents/documents.service";
import { MediaService } from "../media/media.service";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { ImportDocumentDto } from "./dto/import-document.dto";

const execFileAsync = promisify(execFile);
const importEsm = new Function("specifier", "return import(specifier)") as <T>(specifier: string) => Promise<T>;

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

@Injectable()
export class ImportsService {
  private readonly markdownConverter = new showdown.Converter({
    tables: true,
    strikethrough: true,
    tasklists: true,
    simplifiedAutoLink: true
  });
  private pdfJsModule: PdfJsModule | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService,
    private readonly mediaService: MediaService,
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
      const htmlContent = await this.convertToHtml(file, dto, user);
      const document = dto.documentId
        ? await this.updateImportedDocument(dto.documentId, dto, file, htmlContent, user)
        : await this.documentsService.create({
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
          documentId: dto.documentId ? undefined : document.id,
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

  private async updateImportedDocument(
    documentId: string,
    dto: ImportDocumentDto,
    file: Express.Multer.File,
    htmlContent: string,
    user: AuthenticatedUser
  ) {
    await this.permissions.assertDocumentRole(user, documentId, ["EDITOR", "MANAGER"]);
    const existingDocument = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, projectId: true, title: true, type: true, currentVersion: true }
    });
    if (!existingDocument) throw new NotFoundException("Document not found");
    if (existingDocument.projectId !== dto.projectId) {
      throw new BadRequestException("Tài liệu cập nhật không thuộc dự án đã chọn");
    }

    const nextVersion = this.nextVersion(existingDocument.currentVersion);
    const title = dto.title?.trim() || existingDocument.title;
    const type = dto.type?.trim() || existingDocument.type;

    return this.prisma.$transaction(async (tx) => {
      const updatedDocument = await tx.document.update({
        where: { id: documentId },
        data: {
          title,
          type,
          currentVersion: nextVersion,
          htmlContent,
          sourceType: "imported",
          sourceFileName: file.originalname
        },
        include: { _count: { select: { comments: true, versions: true } } }
      });

      await tx.documentVersion.upsert({
        where: { documentId_version: { documentId, version: nextVersion } },
        create: {
          documentId,
          version: nextVersion,
          htmlContent,
          changeNote: `Re-imported from ${file.originalname}`,
          createdBy: user.id
        },
        update: {
          htmlContent,
          changeNote: `Re-imported from ${file.originalname}`,
          createdBy: user.id
        }
      });

      return updatedDocument;
    });
  }

  private async convertToHtml(file: Express.Multer.File, dto: ImportDocumentDto, user: AuthenticatedUser) {
    const extension = file.originalname.split(".").pop()?.toLowerCase();

    if (extension === "md") {
      return this.cleanHtml(this.markdownConverter.makeHtml(file.buffer.toString("utf8")));
    }

    if (extension === "docx") {
      const result = await mammoth.convertToHtml({ buffer: file.buffer }, {
        convertImage: mammoth.images.imgElement(async (image) => {
          const imageBuffer = await image.read();
          const src = await this.uploadImportedImage(
            imageBuffer,
            image.contentType || this.detectImageMimeType(imageBuffer),
            file,
            "word-image",
            dto,
            user
          );
          return { src };
        })
      });
      return this.cleanHtml(result.value);
    }

    if (extension === "doc") {
      return this.cleanHtml(await this.convertLegacyWordToHtml(file));
    }

    if (extension === "pdf") {
      try {
        return this.cleanHtml(await this.convertPdfToVisualHtml(file, dto, user));
      } catch (renderError) {
        try {
          return this.cleanHtml(await this.convertPdfToEmbeddedHtml(file, dto, user));
        } catch {
          // Keep text import as a final fallback for unusual PDFs that cannot be rendered or embedded.
        }
      }

      let text: string;
      try {
        const result = await pdfParse(Buffer.from(file.buffer));
        text = result.text;
      } catch (error) {
        text = await this.extractPdfTextInWorker(file.buffer, error);
      }
      const paragraphs = text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph) => `<p>${this.escapeHtml(paragraph)}</p>`)
        .join("\n");
      return this.cleanHtml(paragraphs);
    }

    throw new BadRequestException("Only .md, .doc, .docx and .pdf files are supported");
  }

  private async convertPdfToVisualHtml(file: Express.Multer.File, dto: ImportDocumentDto, user: AuthenticatedUser) {
    const pdfjs = await this.loadPdfJs();
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(file.buffer),
      disableFontFace: true,
      useSystemFonts: true
    });
    const pdf = await loadingTask.promise;
    const figures: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.7 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const canvasContext = canvas.getContext("2d");

      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: canvasContext as unknown as CanvasRenderingContext2D,
        viewport
      }).promise;

      const imageBuffer = canvas.toBuffer("image/png");
      const imageSource = await this.uploadImportedImage(
        imageBuffer,
        "image/png",
        file,
        `page-${pageNumber}`,
        dto,
        user
      );
      const alt = this.escapeHtml(`${file.originalname} - trang ${pageNumber}`);
      figures.push(
        `<figure class="pdf-page-image" data-page="${pageNumber}"><img src="${imageSource}" alt="${alt}" loading="lazy" /></figure>`
      );
    }

    if (!figures.length) {
      throw new BadRequestException("Không render được trang PDF");
    }

    return `<section class="pdf-document-render" data-source="pdf">${figures.join("\n")}</section>`;
  }

  private async convertPdfToEmbeddedHtml(file: Express.Multer.File, dto: ImportDocumentDto, user: AuthenticatedUser) {
    const asset = await this.mediaService.upload(file, {
      projectId: dto.projectId,
      documentId: dto.documentId
    }, user);
    const url = this.escapeHtml(asset.url);
    const title = this.escapeHtml(file.originalname);
    return [
      `<section class="pdf-document-render pdf-document-embed" data-source="pdf">`,
      `<iframe class="pdf-embed-frame" src="${url}" title="${title}" loading="lazy"></iframe>`,
      `</section>`
    ].join("");
  }

  private async uploadImportedImage(
    buffer: Buffer,
    contentType: string,
    sourceFile: Express.Multer.File,
    suffix: string,
    dto: ImportDocumentDto,
    user: AuthenticatedUser
  ) {
    const baseName = sourceFile.originalname.replace(/\.[^/.]+$/, "").replace(/[^\w.-]+/g, "-");
    const extension = this.extensionFromMimeType(contentType);
    const pageFile = {
      fieldname: "file",
      originalname: `${baseName || "import"}-${suffix}.${extension}`,
      encoding: "7bit",
      mimetype: contentType,
      buffer,
      size: buffer.length
    } as Express.Multer.File;

    try {
      const asset = await this.mediaService.upload(pageFile, {
        projectId: dto.projectId,
        documentId: dto.documentId
      }, user);
      return asset.url;
    } catch {
      return `data:${contentType};base64,${buffer.toString("base64")}`;
    }
  }

  private extensionFromMimeType(contentType: string) {
    const normalized = contentType.toLowerCase();
    if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
    if (normalized.includes("png")) return "png";
    if (normalized.includes("gif")) return "gif";
    if (normalized.includes("webp")) return "webp";
    if (normalized.includes("svg")) return "svg";
    return "bin";
  }

  private detectImageMimeType(buffer: Buffer) {
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return "image/png";
    }
    if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
      return "image/jpeg";
    }
    if (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a") {
      return "image/gif";
    }
    if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
      return "image/webp";
    }
    return "application/octet-stream";
  }

  private async loadPdfJs() {
    if (!this.pdfJsModule) {
      this.ensurePdfCanvasGlobals();
      this.pdfJsModule = await importEsm<PdfJsModule>("pdfjs-dist/legacy/build/pdf.mjs");
    }
    return this.pdfJsModule;
  }

  private ensurePdfCanvasGlobals() {
    const pdfGlobals = globalThis as Record<string, unknown>;
    pdfGlobals.DOMMatrix ??= DOMMatrix;
    pdfGlobals.ImageData ??= ImageData;
    pdfGlobals.Path2D ??= Path2D;
  }

  private async extractPdfTextInWorker(buffer: Buffer, originalError: unknown) {
    const tempDir = await mkdtemp(join(tmpdir(), "ba-pdf-import-"));
    const tempFilePath = join(tempDir, "source.pdf");

    try {
      await writeFile(tempFilePath, buffer);
      const script = `
const fs = require("fs");
const pdfParse = require("pdf-parse");
pdfParse(fs.readFileSync(process.argv[1]))
  .then((result) => process.stdout.write(result.text || ""))
  .catch((error) => {
    process.stderr.write(error && error.message ? error.message : String(error));
    process.exit(1);
  });
`;
      const { stdout } = await execFileAsync(process.execPath, ["-e", script, tempFilePath], {
        cwd: process.cwd(),
        maxBuffer: 30 * 1024 * 1024
      });
      if (!stdout.trim()) {
        throw new BadRequestException("Không đọc được nội dung text từ PDF");
      }
      return stdout;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const detail = originalError instanceof Error ? originalError.message : "Unknown PDF parse error";
      throw new BadRequestException(`Không đọc được nội dung PDF: ${detail}`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async convertLegacyWordToHtml(file: Express.Multer.File) {
    const tempDir = await mkdtemp(join(tmpdir(), "ba-doc-import-"));
    const tempFilePath = join(tempDir, "source.doc");

    try {
      await writeFile(tempFilePath, file.buffer);
      const { stdout } = await execFileAsync("textutil", ["-convert", "html", "-stdout", tempFilePath], {
        maxBuffer: 30 * 1024 * 1024
      });
      if (!stdout.trim()) {
        throw new BadRequestException("Không đọc được nội dung từ file .doc");
      }
      return stdout;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException("Không convert được file .doc. Vui lòng thử lưu lại dưới dạng .docx hoặc PDF.");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private cleanHtml(html: string) {
    const sanitized = sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        "img",
        "h1",
        "h2",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "section",
        "figure",
        "figcaption",
        "iframe"
      ]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        "*": ["data-block-id", "data-source", "data-page", "class"],
        img: ["src", "alt", "width", "height", "loading"],
        iframe: ["src", "title", "loading", "class"]
      },
      allowedSchemesByTag: {
        img: ["http", "https", "data"],
        iframe: ["http", "https"]
      }
    });
    return this.normalizeVietnameseText(sanitized);
  }

  private normalizeVietnameseText(str: string): string {
    if (!str) return "";

    let result = str.normalize("NFC");

    result = result
      .replace(/Mò̀\s*Ì\s*rò̀i£ì\s*ng/gi, "Mô hình hệ thống")
      .replace(/tỉ̀\s*nh\s*nà̀\s*ng/gi, "tính năng")
      .replace(/quả̀\s*n\s*lý̀/gi, "quản lý")
      .replace(/tà̀\s*m/gi, "tâm")
      .replace(/Ä̀\s*aì\s*o/gi, "đào")
      .replace(/tài£o/gi, "tạo")
      .replace(/ò̀/g, "ô")
      .replace(/à̀/g, "à")
      .replace(/ỉ̀/g, "ỉ")
      .replace(/ý̀/g, "ý");

    result = result
      .replace(
        /([àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ])[\u0300-\u036F]+/g,
        "$1"
      )
      .replace(/[\u0300-\u036F]/g, "");

    return result.normalize("NFC");
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
    const raw = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
    return this.normalizeVietnameseText(raw);
  }

  private typeFromFileName(fileName: string) {
    const normalized = fileName.toLowerCase();
    if (normalized.includes("brd")) return "BRD";
    if (normalized.includes("srs")) return "SRS";
    if (normalized.includes("change")) return "CR";
    if (normalized.includes("uat")) return "UAT";
    return "DOC";
  }

  private nextVersion(currentVersion: string) {
    const match = currentVersion.match(/^v?(\d+)\.(\d+)$/i);
    if (!match) return `v${Date.now()}`;

    const major = Number(match[1]);
    const minor = Number(match[2]);
    return `v${major}.${minor + 1}`;
  }
}
