import { Component, OnInit } from '@angular/core';
import { AuthService } from './core/auth/auth.service';
import { TokenService } from './core/auth/token.service';
import { UiStateService } from './core/ui/ui-state.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  sidebarOpen$: Observable<boolean>;

  constructor(private auth: AuthService, private ui: UiStateService, private token: TokenService) {this.sidebarOpen$ = this.ui.sidebarOpen$;}

  ngOnInit(): void {
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
