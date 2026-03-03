import { AuthController } from '@auth/presentation/auth.controller';
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [AuthController],
  providers: [],
})
export class AppModule { }
