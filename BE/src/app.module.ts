import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { CommentsModule } from "./comments/comments.module";
import { DocumentsModule } from "./documents/documents.module";
import { ExportsModule } from "./exports/exports.module";
import { ImportsModule } from "./imports/imports.module";
import { MediaModule } from "./media/media.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProjectsModule } from "./projects/projects.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    ProjectsModule,
    DocumentsModule,
    CommentsModule,
    MediaModule,
    ImportsModule,
    ExportsModule
  ]
})
export class AppModule {}
