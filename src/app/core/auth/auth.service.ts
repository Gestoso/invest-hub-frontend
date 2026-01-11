import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment'; 
import { TokenService } from './token.service';
import { BehaviorSubject, Observable, tap } from 'rxjs';


export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  createdAt: string;
};

type AuthResponse = {
  ok: boolean;
  user: AuthUser;
  accessToken: string;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private base = environment.apiUrl;
  private userSubject = new BehaviorSubject<AuthUser | null>(null);
  user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient, private token: TokenService) {}
  
  private setUser(user: AuthUser | null): void {
    this.userSubject.next(user);
  }

  register(payload: { email: string; name?: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/register`, payload).pipe(
      tap((res) => {
        this.token.set(res.accessToken);
        this.setUser(res.user);
      })
    );
  }

  login(payload: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/login`, payload).pipe(
      tap((res) => {
        this.token.set(res.accessToken);
        this.setUser(res.user);
      })
    );
  }

  me(): Observable<{ ok: boolean; user: AuthUser }> {
    return this.http.get<{ ok: boolean; user: AuthUser }>(`${this.base}/auth/me`).pipe(
      tap((res) => this.setUser(res.user))
    );
  }

  logout(): void {
    this.token.clear();
    this.setUser(null);
  }
  
  get currentUser(): AuthUser | null {
    return this.userSubject.value;
  }

}
