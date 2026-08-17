import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateWorkboardColumnDto } from "./dto/create-workboard-column.dto";
import { ReorderWorkboardColumnsDto } from "./dto/reorder-workboard-columns.dto";
import { UpdateWorkboardColumnDto } from "./dto/update-workboard-column.dto";
import { WorkboardColumnsService } from "./workboard-columns.service";

@ApiTags("workboard-columns")
@UseGuards(JwtAuthGuard)
@Controller({ path: "projects/:projectId/workboard-columns", version: "1" })
export class WorkboardColumnsController {
  constructor(private readonly workboardColumnsService: WorkboardColumnsService) {}

  @Get()
  findByProject(@Param("projectId") projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workboardColumnsService.findByProject(projectId, user);
  }

  @Post()
  create(
    @Param("projectId") projectId: string,
    @Body() dto: CreateWorkboardColumnDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.workboardColumnsService.create(projectId, dto, user);
  }

  @Patch("reorder")
  reorder(
    @Param("projectId") projectId: string,
    @Body() dto: ReorderWorkboardColumnsDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.workboardColumnsService.reorder(projectId, dto, user);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateWorkboardColumnDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workboardColumnsService.update(id, dto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workboardColumnsService.remove(id, user);
  }
}
