import { Injectable } from '@angular/core';

const TOKEN_KEY = 'accessToken';

@Injectable({ providedIn: 'root' })
export class TokenService {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  set(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('accessToken');
  }
  
}
