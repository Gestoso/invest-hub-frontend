import { Component, OnInit } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../core/auth/auth.service';
import { PortfoliosService } from '../../core/api/portfolios.service';
import { Router } from '@angular/router';
import { UiStateService } from 'src/app/core/ui/ui-state.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  user$ = this.auth.user$;

  loading = false;
  error = '';
  addSubportfolioOpen = false;

  roots: any[] = [];
  menuItems: MenuItem[] = [];

  constructor(
    private auth: AuthService,
    private portfoliosService: PortfoliosService,
    private router: Router,
    private ui: UiStateService
  ) {}

  ngOnInit(): void {
    this.loadTree();
  }


  loadTree(): void {
    this.loading = true;
    this.portfoliosService.tree().subscribe({
      next: (res) => {
        this.roots = res.roots || [];
        this.menuItems = this.buildMenu(this.roots);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Error cargando portfolios';
      }
    });
  }

  buildMenu(nodes: any[]): MenuItem[] {
    return nodes.map((node) => ({
      label: node.name,
      icon: 'pi pi-folder',
      command: () => {
        this.router.navigate(['/dashboard'], {
          queryParams: { portfolioId: node.id }
        });
        this.closeOnMobile();
      },
      items: node.children?.length
        ? this.buildMenu(node.children)
        : undefined
    }));
  }

  openAddSubportfolio(): void {
    this.addSubportfolioOpen = true;
  }

  onSubportfolioCreated(): void {
    this.addSubportfolioOpen = false;
    this.loadTree();
  }

  closeOnMobile(): void {
  this.ui.closeSidebar();
  }
}