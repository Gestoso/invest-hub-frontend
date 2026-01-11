import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TokenService } from './token.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private token: TokenService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.token.get();
    if (!token) return next.handle(req);

    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });

    return next.handle(cloned);
  }
}
