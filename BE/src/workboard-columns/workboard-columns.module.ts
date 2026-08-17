import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { WorkboardColumnsController } from "./workboard-columns.controller";
import { WorkboardColumnsService } from "./workboard-columns.service";

@Module({
  imports: [AuthModule],
  controllers: [WorkboardColumnsController],
  providers: [WorkboardColumnsService],
  exports: [WorkboardColumnsService]
})
export class WorkboardColumnsModule {}
