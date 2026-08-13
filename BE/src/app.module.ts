import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { CollaborationModule } from "./collaboration/collaboration.module";
import { CommentsModule } from "./comments/comments.module";
import { DocumentsModule } from "./documents/documents.module";
import { ExportsModule } from "./exports/exports.module";
import { ImportsModule } from "./imports/imports.module";
import { MediaModule } from "./media/media.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { ProjectsModule } from "./projects/projects.module";
import { UsersModule } from "./users/users.module";
import { WorkItemsModule } from "./work-items/work-items.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    PermissionsModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    DocumentsModule,
    CollaborationModule,
    CommentsModule,
    MediaModule,
    ImportsModule,
    ExportsModule,
    WorkItemsModule
  ]
})
export class AppModule {}
