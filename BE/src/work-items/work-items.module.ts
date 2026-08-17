import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CollaborationModule } from "../collaboration/collaboration.module";
import { MediaModule } from "../media/media.module";
import { WorkboardColumnsModule } from "../workboard-columns/workboard-columns.module";
import { WorkItemsController } from "./work-items.controller";
import { WorkItemsService } from "./work-items.service";

@Module({
  imports: [AuthModule, CollaborationModule, MediaModule, WorkboardColumnsModule],
  controllers: [WorkItemsController],
  providers: [WorkItemsService]
})
export class WorkItemsModule {}
