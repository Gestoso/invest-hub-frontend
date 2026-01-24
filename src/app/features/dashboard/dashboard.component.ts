import { Component, OnInit } from '@angular/core';
import { DashboardService, DashboardSummary } from '../../core/api/dashboard.service';
import { AuthService } from '../../core/auth/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { PricesService } from '../../core/api/prices.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  loading = false;
  error = '';
  data: DashboardSummary | null = null;

  isRootScope = true; // por defecto
  currentScopePortfolioId?: string;

  // Sprint 3.5: precios crypto cacheados en memoria del componente
  cryptoPriceMap: Record<string, number | null> = {};

  // Pie: por tipo
  pieByTypeLabels: string[] = [];
  pieByTypeData: number[] = [];

  // Pie: por portfolio
  pieByPortfolioLabels: string[] = [];
  pieByPortfolioData: number[] = [];

  // Pie: por asset
  pieByAssetLabels: string[] = [];
  pieByAssetData: number[] = [];

  // Opciones (dark friendly)
  pieOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#e9ecef' }
      }
    }
  };

  pieByTypeDataset: ChartConfiguration<'pie'>['data'] = {
    labels: this.pieByTypeLabels,
    datasets: [{ data: this.pieByTypeData }]
  };

  pieByPortfolioDataset: ChartConfiguration<'pie'>['data'] = {
    labels: this.pieByPortfolioLabels,
    datasets: [{ data: this.pieByPortfolioData }]
  };

  pieByAssetDataset: ChartConfiguration<'pie'>['data'] = {
    labels: this.pieByAssetLabels,
    datasets: [{ data: this.pieByAssetData }]
  };

  addPositionOpen = false;

  constructor(
    private dash: DashboardService,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private prices: PricesService,
    private msg: MessageService
  ) {}

  ngOnInit(): void {
    this.loading = true;

    this.route.queryParamMap
      .pipe(
        switchMap((params) => {
          const portfolioId = params.get('portfolioId') || undefined;
          this.loading = true;
          this.error = '';
          return this.loadSummaryAndPrices$(portfolioId);
        })
      )
      .subscribe({
        next: () => {
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.message || 'Error cargando dashboard';
          this.msg.add({
          severity: 'error',
          summary: 'Dashboard',
          detail: this.error,
          life: 3500
          });
          if (err?.status === 401) this.router.navigateByUrl('/login');
        }
      });
  }

  /**
   * Carga summary y luego, si aplica, carga precios crypto (1 request).
   * Devuelve un observable que completa cuando todo termina.
   */
  private loadSummaryAndPrices$(portfolioId?: string) {
    return this.dash.summary(portfolioId).pipe(
      tap((res) => {
        // 1) Estado principal
        this.data = res;
        this.currentScopePortfolioId = res.scope?.portfolioId;

        // 2) Detectar root/subportfolio
        const scopeRow = (res.byPortfolio || []).find(p => p.id === res.scope?.portfolioId);
        this.isRootScope = scopeRow?.parentId === null;

        // 3) Datasets existentes
        this.pieByTypeLabels = res.byType.map(x => x.type);
        this.pieByTypeData = res.byType.map(x => x.total);
        this.pieByTypeDataset = {
          labels: this.pieByTypeLabels,
          datasets: [{ data: this.pieByTypeData }]
        };

        const scopeId = res.scope?.portfolioId;
        const portfolioRows = (res.byPortfolio || []).filter(p => p.parentId === scopeId);
        this.pieByPortfolioLabels = portfolioRows.map(p => p.name);
        this.pieByPortfolioData = portfolioRows.map(p => p.total);
        this.pieByPortfolioDataset = {
          labels: this.pieByPortfolioLabels,
          datasets: [{ data: this.pieByPortfolioData }]
        };

        this.pieByAssetLabels = (res.byAsset || []).map(a => a.symbol ? `${a.symbol}` : a.name);
        this.pieByAssetData = (res.byAsset || []).map(a => a.total);
        this.pieByAssetDataset = {
          labels: this.pieByAssetLabels,
          datasets: [{ data: this.pieByAssetData }]
        };

        // 4) Reset precios al cambiar scope (para que no se queden precios “viejos”)
        this.cryptoPriceMap = {};
      }),

      // 5) Cargar precios crypto (si hay providerRef)
      switchMap((res) => {
        // Esperamos que byAsset traiga providerRef para CRYPTO:
        // { assetId, name, symbol, type, providerRef, total }
        const cryptoRefs = (res.byAsset || [])
          .filter((a: any) => a.type === 'CRYPTO' && !!a.providerRef)
          .map((a: any) => String(a.providerRef).trim().toLowerCase());

        const uniqueRefs = Array.from(new Set(cryptoRefs)).filter(Boolean); 
        console.log(uniqueRefs)
        if (!uniqueRefs.length) {
          // Nada que pedir
          return of(null);
        }

        return this.prices.getCryptoPrices(uniqueRefs, 'eur').pipe(
          tap((p) => {
            const map: Record<string, number | null> = {};
            for (const ref of uniqueRefs) {
              map[ref] = p.data?.[ref]?.price ?? null;
            }
            this.cryptoPriceMap = map;
            console.log('[PRICES LOADED]', this.cryptoPriceMap);
          }),
          catchError((err) => {
            // No rompemos el dashboard si falla el provider
            console.error('Error loading crypto prices', err);
            this.cryptoPriceMap = {};
            return of(null);
          })
        );
      }),

      map(() => true)
    );
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  openAddPosition(): void {
    this.addPositionOpen = true;
  }

  reloadSummary(): void {
    const portfolioId = this.currentScopePortfolioId;
    this.loading = true;
    this.error = '';

    this.loadSummaryAndPrices$(portfolioId).subscribe({
      next: () => {
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Error recargando dashboard';
      }
    });
  }
}
