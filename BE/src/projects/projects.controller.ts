import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ProjectsService } from "./projects.service";

@ApiTags("projects")
@Controller({ path: "projects", version: "1" })
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }
}
