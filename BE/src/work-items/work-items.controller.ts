import { Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateWorkItemDto } from "./dto/create-work-item.dto";
import { CreateWorkItemCommentDto } from "./dto/create-work-item-comment.dto";
import { UpdateWorkItemCommentDto } from "./dto/update-work-item-comment.dto";
import { UpdateWorkItemDto } from "./dto/update-work-item.dto";
import { WorkItemsService } from "./work-items.service";

@ApiTags("work-items")
@UseGuards(JwtAuthGuard)
@Controller({ path: "work-items", version: "1" })
export class WorkItemsController {
  constructor(private readonly workItemsService: WorkItemsService) {}

  @Get("project/:projectId")
  findByProject(@Param("projectId") projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workItemsService.findByProject(projectId, user);
  }

  @Post()
  create(@Body() dto: CreateWorkItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workItemsService.create(dto, user);
  }

  @Post("from-comment/:commentId")
  createFromComment(
    @Param("commentId") commentId: string,
    @Body() dto: Omit<CreateWorkItemDto, "projectId" | "documentId" | "sourceCommentId">,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.workItemsService.createFromComment(commentId, dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateWorkItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workItemsService.update(id, dto, user);
  }

  @Post(":id/attachments")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  uploadAttachment(@Param("id") id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    return this.workItemsService.uploadAttachment(id, file, user);
  }

  @Get(":id/activity")
  activity(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workItemsService.activity(id, user);
  }

  @Get(":id/comments")
  comments(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workItemsService.comments(id, user);
  }

  @Post(":id/comments")
  createComment(@Param("id") id: string, @Body() dto: CreateWorkItemCommentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workItemsService.createComment(id, dto, user);
  }

  @Patch(":workItemId/comments/:commentId")
  updateComment(
    @Param("workItemId") workItemId: string,
    @Param("commentId") commentId: string,
    @Body() dto: UpdateWorkItemCommentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.workItemsService.updateComment(workItemId, commentId, dto, user);
  }

  @Delete(":workItemId/comments/:commentId")
  removeComment(
    @Param("workItemId") workItemId: string,
    @Param("commentId") commentId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.workItemsService.removeComment(workItemId, commentId, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workItemsService.remove(id, user);
  }
}
