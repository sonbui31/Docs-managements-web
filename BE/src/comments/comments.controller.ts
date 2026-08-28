import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CommentsService } from "./comments.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";

@ApiTags("comments")
@UseGuards(JwtAuthGuard)
@Controller({ path: "comments", version: "1" })
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get("document/:documentId")
  findByDocument(@Param("documentId") documentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commentsService.findByDocument(documentId, user);
  }

  @Get(":id/context")
  context(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commentsService.context(id, user);
  }

  @Post()
  create(@Body() dto: CreateCommentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commentsService.create(dto, user);
  }

  @Patch(":id/resolve")
  resolve(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commentsService.resolve(id, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCommentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commentsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commentsService.remove(id, user);
  }
}
