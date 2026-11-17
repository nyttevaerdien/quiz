import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AdminService } from './admin.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly adminService: AdminService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const header: string = request.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';

    if (!token || !this.adminService.validateToken(token)) {
      throw new UnauthorizedException('Valid admin token required');
    }
    return true;
  }
}
