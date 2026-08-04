import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { ImportsController } from "./imports.controller";
import { ImportsService } from "./imports.service";

@Module({
  imports: [DocumentsModule],
  controllers: [ImportsController],
  providers: [ImportsService]
})
export class ImportsModule {}
