import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AutoTranslateDto } from "./dto/auto-translate.dto";
import { CreateDocumentTranslationDto } from "./dto/create-document-translation.dto";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { PublishDocumentVersionDto } from "./dto/publish-document-version.dto";
import { TransferDocumentOwnerDto } from "./dto/transfer-document-owner.dto";
import { UpdateDocumentTranslationDto } from "./dto/update-document-translation.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { DocumentsService } from "./documents.service";

@ApiTags("documents")
@UseGuards(JwtAuthGuard)
@Controller({ path: "documents", version: "1" })
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get("project/:projectId")
  findByProject(@Param("projectId") projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.findByProject(projectId, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.findOne(id, user);
  }

  @Get(":id/versions")
  versions(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.versions(id, user);
  }

  @Get(":id/translations")
  listTranslations(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.listTranslations(id, user);
  }

  @Get(":id/translations/:language")
  findTranslation(
    @Param("id") id: string,
    @Param("language") language: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.documentsService.findTranslation(id, language, user);
  }

  @Post(":id/translations")
  createTranslation(
    @Param("id") id: string,
    @Body() dto: CreateDocumentTranslationDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.documentsService.createTranslation(id, dto, user);
  }

  @Patch(":id/translations/:language")
  updateTranslation(
    @Param("id") id: string,
    @Param("language") language: string,
    @Body() dto: UpdateDocumentTranslationDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.documentsService.updateTranslation(id, language, dto, user);
  }

  @Delete(":id/translations/:language")
  deleteTranslation(
    @Param("id") id: string,
    @Param("language") language: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.documentsService.deleteTranslation(id, language, user);
  }

  @Post("auto-translate")
  autoTranslate(@Body() dto: AutoTranslateDto) {
    return this.documentsService.autoTranslate(dto);
  }

  @Post(":id/versions")
  publishVersion(
    @Param("id") id: string,
    @Body() dto: PublishDocumentVersionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.documentsService.publishVersion(id, dto, user);
  }

  @Post(":id/versions/:versionId/restore")
  restoreVersion(
    @Param("id") id: string,
    @Param("versionId") versionId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.documentsService.restoreVersion(id, versionId, user);
  }

  @Post(":id/edit-session")
  acquireEditSession(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.acquireEditSession(id, user);
  }

  @Patch(":id/edit-session")
  heartbeatEditSession(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.heartbeatEditSession(id, user);
  }

  @Delete(":id/edit-session")
  releaseEditSession(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.releaseEditSession(id, user);
  }

  @Patch(":id/owner")
  transferOwner(
    @Param("id") id: string,
    @Body() dto: TransferDocumentOwnerDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.documentsService.transferOwner(id, dto, user);
  }

  @Post()
  create(@Body() dto: CreateDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.remove(id, user);
  }
}
