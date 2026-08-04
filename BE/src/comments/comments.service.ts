import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCommentDto } from "./dto/create-comment.dto";

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  findByDocument(documentId: string) {
    return this.prisma.comment.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" }
    });
  }

  create(dto: CreateCommentDto) {
    return this.prisma.comment.create({ data: dto });
  }

  resolve(id: string) {
    return this.prisma.comment.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date()
      }
    });
  }
}
