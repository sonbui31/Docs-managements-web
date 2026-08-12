import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CollaborationModule } from "../collaboration/collaboration.module";
import { DocumentsModule } from "../documents/documents.module";
import { MediaModule } from "../media/media.module";
import { ImportsController } from "./imports.controller";
import { ImportsService } from "./imports.service";

@Module({
  imports: [AuthModule, CollaborationModule, DocumentsModule, MediaModule],
  controllers: [ImportsController],
  providers: [ImportsService]
})
export class ImportsModule {}
