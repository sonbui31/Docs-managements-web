import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DocumentsModule } from "../documents/documents.module";
import { CollaborationController } from "./collaboration.controller";
import { CollaborationService } from "./collaboration.service";

@Module({
  imports: [AuthModule, DocumentsModule],
  controllers: [CollaborationController],
  providers: [CollaborationService],
  exports: [CollaborationService]
})
export class CollaborationModule {}
