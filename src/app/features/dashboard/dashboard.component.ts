import { Component, OnInit } from '@angular/core';
import { DashboardService, DashboardSummary } from '../../core/api/dashboard.service';
import { AuthService } from '../../core/auth/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { ChartConfiguration, ChartOptions } from 'chart.js';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  loading = false;
  error = '';
  data: DashboardSummary | null = null;
  // Pie: por tipo
  pieByTypeLabels: string[] = [];
  pieByTypeData: number[] = [];

  // Pie: por portfolio
  pieByPortfolioLabels: string[] = [];
  pieByPortfolioData: number[] = [];

  // Opciones (dark friendly)
  pieOptions: ChartOptions<'pie'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#e9ecef' // texto claro para tema oscuro
        }
      }
    }
  };

  // Dataset config (Chart.js)
  pieByTypeDataset: ChartConfiguration<'pie'>['data'] = {
    labels: this.pieByTypeLabels,
    datasets: [{ data: this.pieByTypeData }]
  };

  pieByPortfolioDataset: ChartConfiguration<'pie'>['data'] = {
    labels: this.pieByPortfolioLabels,
    datasets: [{ data: this.pieByPortfolioData }]
  };

  constructor(
  private dash: DashboardService,
  private auth: AuthService,
  private router: Router,
  private route: ActivatedRoute
  ) {}

ngOnInit(): void {
  this.loading = true;

  this.route.queryParamMap
    .pipe(
      switchMap((params) => {
        const portfolioId = params.get('portfolioId') || undefined;
        return this.dash.summary(portfolioId);
      })
    )
    .subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
        this.pieByTypeLabels = res.byType.map(x => x.type);
        this.pieByTypeData = res.byType.map(x => x.total);

        this.pieByPortfolioLabels = res.byPortfolio.map(p => p.name);
        this.pieByPortfolioData = res.byPortfolio.map(p => p.total);

        // Refresca datasets (para que Angular detecte cambios)
        this.pieByTypeDataset = {
          labels: this.pieByTypeLabels,
          datasets: [{ data: this.pieByTypeData }]
        };

        this.pieByPortfolioDataset = {
          labels: this.pieByPortfolioLabels,
          datasets: [{ data: this.pieByPortfolioData }]
        };
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Error cargando dashboard';
        if (err?.status === 401) this.router.navigateByUrl('/login');
      }
    });
}

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
