import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { DocumentsService } from "./documents.service";

@ApiTags("documents")
@Controller({ path: "documents", version: "1" })
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get("project/:projectId")
  findByProject(@Param("projectId") projectId: string) {
    return this.documentsService.findByProject(projectId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.documentsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateDocumentDto) {
    return this.documentsService.create(dto);
  }
}
