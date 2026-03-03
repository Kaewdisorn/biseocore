import { Body, Controller, Post, Get, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('auth')
export class AuthController {

    @Get('test')
    @HttpCode(HttpStatus.OK)
    test() {
        return { message: 'test endpoint is working' };
    }
}