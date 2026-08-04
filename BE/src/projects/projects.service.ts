import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { documents: true, importJobs: true }
        }
      }
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        documents: { orderBy: { updatedAt: "desc" } },
        mediaAssets: { orderBy: { createdAt: "desc" }, take: 20 }
      }
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    return project;
  }

  create(dto: CreateProjectDto) {
    return this.prisma.project.create({ data: dto });
  }
}
