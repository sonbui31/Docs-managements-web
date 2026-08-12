import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CollaborationService } from "./collaboration.service";
import { CreateRequirementTagDto } from "./dto/create-requirement-tag.dto";
import { CreateTemplateDocumentDto } from "./dto/create-template-document.dto";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { CreateTraceLinkDto } from "./dto/create-trace-link.dto";

@ApiTags("collaboration")
@UseGuards(JwtAuthGuard)
@Controller({ path: "collaboration", version: "1" })
export class CollaborationController {
  constructor(private readonly collaborationService: CollaborationService) {}

  @Get("dashboard")
  workspaceDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.collaborationService.workspaceDashboard(user);
  }

  @Get("projects/:projectId/dashboard")
  dashboard(@Param("projectId") projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.collaborationService.dashboard(projectId, user);
  }

  @Get("projects/:projectId/search")
  search(@Param("projectId") projectId: string, @Query("q") query = "", @CurrentUser() user: AuthenticatedUser) {
    return this.collaborationService.search(projectId, query, user);
  }

  @Get("projects/:projectId/activity")
  activity(@Param("projectId") projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.collaborationService.activity(projectId, user);
  }

  @Get("projects/:projectId/traces")
  traceLinks(@Param("projectId") projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.collaborationService.traceLinks(projectId, user);
  }

  @Post("projects/:projectId/traces")
  createTrace(@Param("projectId") projectId: string, @Body() dto: CreateTraceLinkDto, @CurrentUser() user: AuthenticatedUser) {
    return this.collaborationService.createTrace(projectId, dto, user);
  }

  @Delete("traces/:id")
  removeTrace(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.collaborationService.removeTrace(id, user);
  }

  @Get("documents/:documentId/diff")
  versionDiff(@Param("documentId") documentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.collaborationService.versionDiff(documentId, user);
  }

  @Get("documents/:documentId/tags")
  tagsForDocument(@Param("documentId") documentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.collaborationService.tagsForDocument(documentId, user);
  }

  @Post("documents/:documentId/tags")
  createTag(@Param("documentId") documentId: string, @Body() dto: CreateRequirementTagDto, @CurrentUser() user: AuthenticatedUser) {
    return this.collaborationService.createTag(documentId, dto, user);
  }

  @Delete("tags/:id")
  removeTag(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.collaborationService.removeTag(id, user);
  }

  @Get("notifications")
  notifications(@CurrentUser() user: AuthenticatedUser) {
    return this.collaborationService.notifications(user);
  }

  @Patch("notifications/:id/read")
  markNotificationRead(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.collaborationService.markNotificationRead(id, user);
  }

  @Get("templates")
  templates(@CurrentUser() user: AuthenticatedUser) {
    return this.collaborationService.templates(user);
  }

  @Post("templates")
  createTemplate(@Body() dto: CreateTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.collaborationService.createTemplate(dto, user);
  }

  @Post("templates/:id/documents")
  createDocumentFromTemplate(@Param("id") id: string, @Body() dto: CreateTemplateDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.collaborationService.createDocumentFromTemplate(id, dto, user);
  }
}
