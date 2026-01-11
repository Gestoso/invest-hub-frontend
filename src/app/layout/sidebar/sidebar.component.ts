import { Component, OnInit } from '@angular/core';
import { PortfoliosService, PortfolioNode } from '../../core/api/portfolios.service';
import { AuthService, AuthUser } from '../../core/auth/auth.service';
import { Observable } from 'rxjs';
import { UiStateService } from 'src/app/core/ui/ui-state.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  user$: Observable<AuthUser | null>;
  roots: PortfolioNode[] = [];
  loading = false;
  error = '';

  constructor(private portfolios: PortfoliosService, private ui: UiStateService, private auth: AuthService, private router: Router) {
    this.user$ = this.auth.user$;
  }

  ngOnInit(): void {
    this.loading = true;
    this.portfolios.tree().subscribe({
      next: (res) => {
        this.reloadTree()
        this.roots = res.roots || [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Error cargando portfolios';
      }
    });
  }

  trackById(_: number, item: PortfolioNode) {
    return item.id;
  }

  closeOnMobile(): void {
    this.ui.closeSidebar();
  }
  
  addSubportfolioOpen = false;

  openAddSubportfolio(): void {
    this.addSubportfolioOpen = true;
  }

  reloadTree(): void {
    this.loading = true;
    this.portfolios.tree().subscribe({
      next: (res) => {
        this.roots = res.roots || [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Error cargando portfolios';
      }
    });
  }

  onSubportfolioCreated(evt: { id: string; name: string }): void {
    this.addSubportfolioOpen = false;
    this.reloadTree();
    this.router.navigate(['/dashboard'], { queryParams: { portfolioId: evt.id } });
    this.ui.closeSidebar(); // opcional: en móvil cierra sidebar
  }

}
