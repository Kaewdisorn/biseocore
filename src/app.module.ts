import { Module } from '@nestjs/common';
import { AuthController } from './modules/auth/presentation/auth.controller';

@Module({
  imports: [],
  controllers: [AuthController],
  providers: [],
})
export class AppModule { }
