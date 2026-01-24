import { Component, OnInit } from '@angular/core';
import { AuthService } from './core/auth/auth.service';
import { TokenService } from './core/auth/token.service';
import { UiStateService } from './core/ui/ui-state.service';
import { Observable } from 'rxjs';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  sidebarOpen$: Observable<boolean>;
isDashboardRoute = false;
  constructor( private router: Router, private auth: AuthService, private ui: UiStateService, private token: TokenService) {this.sidebarOpen$ = this.ui.sidebarOpen$;}

  ngOnInit(): void {
    this.router.events
    .pipe(filter(e => e instanceof NavigationEnd))
    .subscribe(() => {
    this.isDashboardRoute = this.router.url.startsWith('/dashboard');
    });
    if (this.token.isLoggedIn()) {
      this.auth.me().subscribe({
        error: () => {
          // token inválido
          this.auth.logout();
        }
      });
    }
  }
  closeSidebar(): void {
    this.ui.closeSidebar();
  }
  

}
