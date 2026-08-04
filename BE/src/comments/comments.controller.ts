import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CommentsService } from "./comments.service";
import { CreateCommentDto } from "./dto/create-comment.dto";

@ApiTags("comments")
@Controller({ path: "comments", version: "1" })
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get("document/:documentId")
  findByDocument(@Param("documentId") documentId: string) {
    return this.commentsService.findByDocument(documentId);
  }

  @Post()
  create(@Body() dto: CreateCommentDto) {
    return this.commentsService.create(dto);
  }

  @Patch(":id/resolve")
  resolve(@Param("id") id: string) {
    return this.commentsService.resolve(id);
  }
}
