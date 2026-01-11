import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TokenService } from '../../core/auth/token.service';
import { AuthService, AuthUser } from '../../core/auth/auth.service';
import { Observable } from 'rxjs';
import { UiStateService } from '../../core/ui/ui-state.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
    user$: Observable<AuthUser | null>;

  constructor(
    public token: TokenService,
    private auth: AuthService,
    private ui: UiStateService,
    private router: Router
  ) {    this.user$ = this.auth.user$; }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  get isLoggedIn(): boolean {
    return this.token.isLoggedIn();
  }
  
  toggleSidebar(): void {
    this.ui.toggleSidebar();
  }

}
