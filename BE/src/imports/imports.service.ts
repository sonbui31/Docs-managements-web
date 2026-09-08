import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createCanvas, DOMMatrix, ImageData, loadImage, Path2D } from "@napi-rs/canvas";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import mammoth = require("mammoth");
import pdfParse = require("pdf-parse");
import sanitizeHtml = require("sanitize-html");
import * as showdown from "showdown";
import { AuthenticatedUser } from "../auth/auth.types";
import { CollaborationService } from "../collaboration/collaboration.service";
import { DocumentsService } from "../documents/documents.service";
import { MediaService } from "../media/media.service";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { ImportDocumentDto } from "./dto/import-document.dto";

const execFileAsync = promisify(execFile);
const importEsm = new Function("specifier", "return import(specifier)") as <T>(specifier: string) => Promise<T>;
const PDF_RENDER_SCALE = 1.35;
const PDF_PAGE_RENDER_CONCURRENCY = 2;

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfOutlineEntry = {
  title: string;
  pageNumber: number;
  pdfTop: number | null;
};

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
    private readonly permissions: PermissionsService,
    private readonly collaboration: CollaborationService
  ) {}

  async importDocument(file: Express.Multer.File | undefined, dto: ImportDocumentDto, user: AuthenticatedUser) {
    if (!file) {
      throw new BadRequestException("File is required");
    }

    await this.permissions.assertProjectRole(user, dto.projectId, ["EDITOR", "MANAGER"]);
    const normalizedFile: Express.Multer.File = {
      ...file,
      originalname: this.normalizeUploadedFileName(file.originalname)
    };

    const importJob = await this.prisma.importJob.create({
      data: {
        projectId: dto.projectId,
        sourceFileName: normalizedFile.originalname,
        sourceFileType: normalizedFile.mimetype
      }
    });

    try {
      const htmlContent = await this.convertToHtml(normalizedFile, dto, user);
      const document = dto.documentId
        ? await this.updateImportedDocument(dto.documentId, dto, normalizedFile, htmlContent, user)
        : await this.documentsService.create({
            projectId: dto.projectId,
            title: dto.title ?? this.titleFromFileName(normalizedFile.originalname),
            type: dto.type ?? this.typeFromFileName(normalizedFile.originalname),
            htmlContent,
            sourceType: "imported",
            sourceFileName: normalizedFile.originalname
          }, user);

      await this.prisma.importJob.update({
        where: { id: importJob.id },
        data: {
          documentId: dto.documentId ? undefined : document.id,
          status: "COMPLETED",
          completedAt: new Date()
        }
      });
      await this.collaboration.log(
        user,
        dto.documentId ? "DOCUMENT_REIMPORTED" : "DOCUMENT_IMPORTED",
        "Document",
        document.id,
        { projectId: dto.projectId, importJobId: importJob.id, sourceFileName: normalizedFile.originalname }
      );
      await this.collaboration.notifyDocumentParticipants(
        document.id,
        dto.documentId ? "Tài liệu vừa được cập nhật" : "Tài liệu mới được import",
        `${document.title} từ file ${normalizedFile.originalname}`,
        user.id
      );

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
          sourceFileName: file.originalname,
          createdBy: user.name || user.email,
          createdByEmail: user.email
        },
        include: { _count: { select: { comments: { where: { status: "OPEN", parentId: null } }, versions: true } } }
      });

      await tx.documentVersion.upsert({
        where: { documentId_version: { documentId, version: nextVersion } },
        create: {
          documentId,
          version: nextVersion,
          htmlContent,
          changeNote: `Re-imported from ${file.originalname}`,
          createdBy: user.name || user.email
        },
        update: {
          htmlContent,
          changeNote: `Re-imported from ${file.originalname}`,
          createdBy: user.name || user.email
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "DOCUMENT_VERSION_CREATED",
          entityType: "Document",
          entityId: documentId,
          metadata: {
            projectId: existingDocument.projectId,
            sourceFileName: file.originalname,
            previousVersion: existingDocument.currentVersion,
            newVersion: nextVersion
          }
        }
      });

      await tx.documentEditingSession.deleteMany({ where: { documentId } });

      return updatedDocument;
    });
  }

  private async convertToHtml(file: Express.Multer.File, dto: ImportDocumentDto, user: AuthenticatedUser) {
    const extension = file.originalname.split(".").pop()?.toLowerCase();

    if (extension === "md") {
      return this.cleanHtml(this.convertMarkdownToHtml(file.buffer.toString("utf8")));
    }

    if (extension === "docx") {
      const imageUploadCache = new Map<string, Promise<string>>();
      const result = await mammoth.convertToHtml({ buffer: file.buffer }, {
        convertImage: mammoth.images.imgElement(async (image) => {
          const imageBuffer = await image.read();
          const mimeType = image.contentType || this.detectImageMimeType(imageBuffer);
          const dimensions = await this.getImageDimensions(imageBuffer);
          const src = await this.uploadImportedImageCached(
            imageUploadCache,
            imageBuffer,
            mimeType,
            file,
            "word-image",
            dto,
            user
          );
          return {
            src,
            class: "imported-doc-image",
            loading: "lazy",
            ...(dimensions
              ? {
                  width: String(dimensions.width),
                  height: String(dimensions.height)
                }
              : {})
          };
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

  private convertMarkdownToHtml(markdown: string) {
    const mermaidBlocks: string[] = [];
    const protectedMarkdown = markdown.replace(
      /(^|\n)(`{3,}|~{3,})[ \t]*([^\n]*)\n([\s\S]*?)\n\2[ \t]*(?=\n|$)/gi,
      (match, prefix: string, _fence: string, rawInfo: string, rawCode: string) => {
        const code = rawCode.trim();
        const info = rawInfo.trim().toLowerCase();
        if (!info.includes("mermaid") && !this.isMermaidSource(code)) return match;
        const index = mermaidBlocks.push(code) - 1;
        return `${prefix}\n\nBA-DOC-MERMAID-BLOCK-${index}\n\n`;
      }
    );

    let html = this.markdownConverter.makeHtml(protectedMarkdown);
    mermaidBlocks.forEach((code, index) => {
      html = html.replace(
        new RegExp(`<p>BA-DOC-MERMAID-BLOCK-${index}<\\/p>|BA-DOC-MERMAID-BLOCK-${index}`, "g"),
        `<pre><code class="mermaid language-mermaid">${this.escapeHtml(code)}</code></pre>`
      );
    });
    return html;
  }

  private isMermaidSource(code: string) {
    return /^(graph|flowchart|sequenceDiagram|gantt|classDiagram|classDiagram-v2|stateDiagram-v2|stateDiagram|erDiagram|journey|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4Context|subgraph)\b/i.test(code.trim());
  }

  private async convertPdfToVisualHtml(file: Express.Multer.File, dto: ImportDocumentDto, user: AuthenticatedUser) {
    const pdfjs = await this.loadPdfJs();
    const loadingTask = (pdfjs as any).getDocument({
      data: new Uint8Array(file.buffer),
      disableFontFace: true,
      useSystemFonts: true
    });
    const pdf = await loadingTask.promise;
    const outlineByPage = await this.buildPdfOutlineByPage(pdf);

    const figures = await this.mapWithConcurrency(
      Array.from({ length: pdf.numPages }, (_, index) => index + 1),
      PDF_PAGE_RENDER_CONCURRENCY,
      async (pageNumber) => {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
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
      const textLayer = await this.buildPdfTextLayer(pdfjs, page, viewport);
      const headings = this.buildPdfPageHeadings(
        pageNumber,
        outlineByPage.get(pageNumber) ?? [],
        textLayer.inferredHeading,
        viewport
      );
      return [
        `<article class="pdf-hybrid-page" data-page="${pageNumber}" data-block-id="PDF-P${pageNumber}" style="width:${Math.round(viewport.width)}px;height:${Math.round(viewport.height)}px">`,
        headings,
        `<img class="pdf-page-bg" src="${imageSource}" alt="${alt}" loading="lazy" />`,
        `<div class="pdf-text-layer" aria-label="PDF text layer">`,
        textLayer.html,
        `</div>`,
        `</article>`
      ].join("");
      }
    );

    if (!figures.length) {
      throw new BadRequestException("Không render được trang PDF");
    }

    return `<section class="pdf-document-render pdf-hybrid-document" data-source="pdf">${figures.join("\n")}</section>`;
  }

  private async buildPdfTextLayer(
    pdfjs: PdfJsModule,
    page: any,
    viewport: any
  ) {
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{
      str?: string;
      transform?: number[];
      width?: number;
      height?: number;
      hasEOL?: boolean;
    }>;
    let inferredHeading = "";
    let largestFontSize = 0;

    const spans = items
      .map((item) => {
        const text = (item.str ?? "").replace(/\s+/g, " ");
        if (!text.trim() || !item.transform) return "";

        const transform = (pdfjs as any).Util ? (pdfjs as any).Util.transform(viewport.transform, item.transform) : item.transform;
        const fontSize = Math.max(1, Math.hypot(transform[2], transform[3]));
        const left = transform[4];
        const top = transform[5] - fontSize;
        const width = Math.max(1, (item.width ?? text.length * fontSize * 0.45) * PDF_RENDER_SCALE);
        const height = Math.max(fontSize, item.height ? item.height * PDF_RENDER_SCALE : fontSize);
        const trimmed = text.trim();

        if (fontSize > largestFontSize && trimmed.length >= 4 && trimmed.length <= 140) {
          largestFontSize = fontSize;
          inferredHeading = trimmed;
        }

        return [
          `<span class="pdf-text-item" data-block-id="PDF-PAGE-TEXT" style="left:${this.roundCssPx(left)};top:${this.roundCssPx(top)};width:${this.roundCssPx(width)};height:${this.roundCssPx(height)};font-size:${this.roundCssPx(fontSize)}">`,
          this.escapeHtml(text),
          `</span>`
        ].join("");
      })
      .join("");

    return { html: spans, inferredHeading };
  }

  private async buildPdfOutlineByPage(pdf: any) {
    const outlineByPage = new Map<number, PdfOutlineEntry[]>();
    const outline = await pdf.getOutline().catch(() => null);
    if (!outline?.length) return outlineByPage;

    const visit = async (items: Array<{ title?: string; dest?: unknown; items?: unknown[] }>) => {
      for (const item of items) {
        const title = item.title?.trim();
        const destination = title ? await this.resolvePdfOutlineDestination(pdf, item.dest) : null;
        if (title && destination) {
          outlineByPage.set(destination.pageNumber, [
            ...(outlineByPage.get(destination.pageNumber) ?? []),
            { title, pageNumber: destination.pageNumber, pdfTop: destination.pdfTop }
          ]);
        }
        if (Array.isArray(item.items) && item.items.length) {
          await visit(item.items as Array<{ title?: string; dest?: unknown; items?: unknown[] }>);
        }
      }
    };

    await visit(outline as Array<{ title?: string; dest?: unknown; items?: unknown[] }>);
    return outlineByPage;
  }

  private async resolvePdfOutlineDestination(
    pdf: any,
    dest: unknown
  ) {
    const destination = typeof dest === "string" ? await pdf.getDestination(dest).catch(() => null) : dest;
    if (!Array.isArray(destination) || !destination[0]) return null;
    const pageIndex = await pdf.getPageIndex(destination[0]).catch(() => null);
    if (typeof pageIndex !== "number") return null;

    const mode = this.pdfDestinationMode(destination[1]);
    let pdfTop: number | null = null;
    if (mode === "XYZ" && typeof destination[3] === "number") {
      pdfTop = destination[3];
    } else if ((mode === "FitH" || mode === "FitBH") && typeof destination[2] === "number") {
      pdfTop = destination[2];
    } else if (mode === "FitR" && typeof destination[5] === "number") {
      pdfTop = destination[5];
    }

    return { pageNumber: pageIndex + 1, pdfTop };
  }

  private pdfDestinationMode(destinationMode: unknown) {
    if (!destinationMode) return null;
    if (typeof destinationMode === "string") return destinationMode;
    if (typeof destinationMode === "object" && "name" in destinationMode) {
      return String((destinationMode as { name?: unknown }).name ?? "");
    }
    return null;
  }

  private buildPdfPageHeadings(
    pageNumber: number,
    outlineEntries: PdfOutlineEntry[],
    inferredHeading: string,
    viewport: { height: number; convertToViewportPoint?: (x: number, y: number) => number[] }
  ) {
    const entries = outlineEntries.length
      ? outlineEntries
      : [{ title: inferredHeading || `Trang ${pageNumber}`, pageNumber, pdfTop: null }];

    return entries
      .filter(Boolean)
      .map((entry, index) => {
        const id = `pdf-page-${pageNumber}-heading-${index}`;
        const top = this.pdfDestinationTopToViewportTop(entry.pdfTop, viewport);
        return `<h2 id="${id}" class="pdf-page-heading" data-page="${pageNumber}" style="top:${this.roundCssPx(top)}">${this.escapeHtml(entry.title)}</h2>`;
      })
      .join("");
  }

  private pdfDestinationTopToViewportTop(
    pdfTop: number | null,
    viewport: { height: number; convertToViewportPoint?: (x: number, y: number) => number[] }
  ) {
    if (typeof pdfTop !== "number" || !Number.isFinite(pdfTop)) return 0;
    const point = typeof viewport.convertToViewportPoint === "function"
      ? viewport.convertToViewportPoint(0, pdfTop)
      : [0, pdfTop];
    const top = Array.isArray(point) && typeof point[1] === "number" ? point[1] : 0;
    return Math.max(0, Math.min(viewport.height - 1, top));
  }

  private roundCssPx(value: number) {
    return `${Math.round(value * 100) / 100}px`;
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

  private uploadImportedImageCached(
    cache: Map<string, Promise<string>>,
    buffer: Buffer,
    contentType: string,
    sourceFile: Express.Multer.File,
    suffix: string,
    dto: ImportDocumentDto,
    user: AuthenticatedUser
  ) {
    const cacheKey = `${contentType}:${createHash("sha1").update(buffer).digest("hex")}`;
    const existing = cache.get(cacheKey);
    if (existing) return existing;

    const uploadPromise = this.uploadImportedImage(buffer, contentType, sourceFile, suffix, dto, user);
    cache.set(cacheKey, uploadPromise);
    return uploadPromise;
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>
  ) {
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(concurrency, items.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
          const currentIndex = nextIndex;
          nextIndex += 1;
          results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
      })
    );

    return results;
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

  private async getImageDimensions(buffer: Buffer) {
    try {
      const image = await loadImage(buffer);
      const width = Math.round(image.naturalWidth || image.width);
      const height = Math.round(image.naturalHeight || image.height);
      if (!width || !height) return null;
      return { width, height };
    } catch {
      return null;
    }
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
        "article",
        "figure",
        "figcaption",
        "span",
        "iframe"
      ]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        "*": ["data-block-id", "data-source", "data-page", "class", "style", "id", "aria-label"],
        img: ["src", "alt", "width", "height", "loading", "class"],
        iframe: ["src", "title", "loading", "class"]
      },
      allowedStyles: {
        "*": {
          left: [/^\d+(\.\d+)?px$/],
          top: [/^-?\d+(\.\d+)?px$/],
          width: [/^\d+(\.\d+)?px$/],
          height: [/^\d+(\.\d+)?px$/],
          "font-size": [/^\d+(\.\d+)?px$/]
        }
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

    let result = this.recoverUtf8Mojibake(str).normalize("NFC");

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

  private normalizeUploadedFileName(fileName: string) {
    return this.normalizeVietnameseText(fileName);
  }

  private recoverUtf8Mojibake(value: string) {
    if (!this.looksLikeUtf8Mojibake(value)) return value;

    try {
      const decoded = Buffer.from(value, "latin1").toString("utf8");
      return this.scoreUtf8Mojibake(decoded) < this.scoreUtf8Mojibake(value) ? decoded : value;
    } catch {
      return value;
    }
  }

  private looksLikeUtf8Mojibake(value: string) {
    return /[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàâ€šƒ„…†‡ˆ‰Š‹ŒŽ]/.test(value)
      || /[\u0080-\u009F]/.test(value);
  }

  private scoreUtf8Mojibake(value: string) {
    const markers = value.match(/[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàâ€šƒ„…†‡ˆ‰Š‹ŒŽ]|[\u0080-\u009F]|�/g);
    return markers?.length ?? 0;
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
