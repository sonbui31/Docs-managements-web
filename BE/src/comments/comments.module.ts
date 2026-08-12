import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CollaborationModule } from "../collaboration/collaboration.module";
import { CommentsController } from "./comments.controller";
import { CommentsService } from "./comments.service";

@Module({
  imports: [AuthModule, CollaborationModule],
  controllers: [CommentsController],
  providers: [CommentsService]
})
export class CommentsModule {}
