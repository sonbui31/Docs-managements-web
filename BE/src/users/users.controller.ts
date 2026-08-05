import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AssignDocumentDto } from "./dto/assign-document.dto";
import { AssignDocumentsBatchDto } from "./dto/assign-documents-batch.dto";
import { AssignProjectDto } from "./dto/assign-project.dto";
import { AssignProjectsBatchDto } from "./dto/assign-projects-batch.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@UseGuards(JwtAuthGuard)
@Controller({ path: "users", version: "1" })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findAll(user);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.softDelete(id, user);
  }

  @Post("batch/projects")
  assignProjectsBatch(@Body() dto: AssignProjectsBatchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.assignProjectsBatch(dto, user);
  }

  @Post(":id/projects")
  assignProject(@Param("id") id: string, @Body() dto: AssignProjectDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.assignProject(id, dto, user);
  }

  @Delete(":id/projects/:projectId")
  removeProject(@Param("id") id: string, @Param("projectId") projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.removeProject(id, projectId, user);
  }

  @Post("batch/documents")
  assignDocumentsBatch(@Body() dto: AssignDocumentsBatchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.assignDocumentsBatch(dto, user);
  }

  @Post(":id/documents")
  assignDocument(@Param("id") id: string, @Body() dto: AssignDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.assignDocument(id, dto, user);
  }

  @Delete(":id/documents/:documentId")
  removeDocument(@Param("id") id: string, @Param("documentId") documentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.removeDocument(id, documentId, user);
  }
}
