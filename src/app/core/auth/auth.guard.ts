import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { TokenService } from './token.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private token: TokenService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    if (this.token.isLoggedIn()) return true;
    return this.router.parseUrl('/login');
  }
}
