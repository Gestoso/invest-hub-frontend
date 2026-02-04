import { Component, OnInit } from '@angular/core';
import { DashboardService, DashboardSummary } from '../../core/api/dashboard.service';
import { AuthService } from '../../core/auth/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { PricesService } from '../../core/api/prices.service';
import { MessageService } from 'primeng/api';
import { HttpClient } from '@angular/common/http';
import { CryptoCatalogService } from 'src/app/core/api/crypto-catalog.service';

type SortBy = 'pct' | 'qty' | 'value' | 'price';

type SortDir = 'desc' | 'asc';

interface TopAssetRow {
  assetId?: string;
  name: string;
  symbol?: string;
  type?: string;
  providerRef?: string;

  valueAmount: number;     // total monetario de ese asset en el portfolio
  weightPct: number;       // % del total
  quantity: number | null; // unidades (calculadas si hay precio)
  unitPrice: number | null; // ✅ precio unitario (calculado)
}


@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})

export class DashboardComponent implements OnInit {

  topAssets: TopAssetRow[] = []; 

  cryptoPriceMap: Record<string, number | null> = {};
  catalogLogoMap: Record<string, string | null> = {};
  private catalogLogosLoaded = false;
  cryptoLogoMap: Record<string, string | null> = {};

  sortBy: SortBy = 'pct';
  sortDir: SortDir = 'desc';

  sortOptions = [
  { label: 'Porcentaje', value: 'pct' },
  { label: 'Cantidad', value: 'qty' },
  { label: 'Valor total', value: 'value' },   // (antes “Valor”)
  { label: 'Precio', value: 'price' },        // ✅ nuevo
];


  get topAssetsSorted(): TopAssetRow[] {
    const list = [...this.topAssets];

    const keyFn = (a: TopAssetRow) => {
      switch (this.sortBy) {
        case 'pct': return a.weightPct ?? 0;
        case 'qty': return a.quantity ?? -1;
        case 'value': return a.valueAmount ?? 0;
        case 'price': return a.unitPrice ?? -1;
      }
    };

    list.sort((a, b) => {
      const diff = keyFn(a) - keyFn(b);
      return this.sortDir === 'asc' ? diff : -diff;
    });

    return list;
  }

  get hasTopAssets(): boolean {
    return Array.isArray(this.topAssetsSorted) && this.topAssetsSorted.length > 0;
  }

  get isTopAssetsEmpty(): boolean {
    return !this.loading && !this.hasTopAssets;
  }
goToAsset(assetId?: string) {
  if (!assetId) return;
  this.router.navigate(['/assets', assetId]);
}


  toggleSortDir() {
    this.sortDir = this.sortDir === 'desc' ? 'asc' : 'desc';
    this.persistTopAssetsSort();
  }
  clampPct(pct: number | null | undefined): number {
    const n = Number(pct);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  }

  // Para que porcentajes pequeños no “desaparezcan” visualmente
  barPct(pct: number | null | undefined): number {
    const v = this.clampPct(pct);
    if (v === 0) return 0;
    return Math.max(2, v); // mínimo 2% visible
  }

  private readonly TOP_ASSETS_SORT_KEY = 'investhub.dashboard.topAssetsSort.v1';

  private persistTopAssetsSort() {
    try {
      localStorage.setItem(
        this.TOP_ASSETS_SORT_KEY,
        JSON.stringify({ sortBy: this.sortBy, sortDir: this.sortDir })
      );
    } catch {
      // sin drama si el navegador bloquea storage
    }
  }

  private restoreTopAssetsSort() {
    try {
      const raw = localStorage.getItem(this.TOP_ASSETS_SORT_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);

      const sortBy = parsed?.sortBy;
      const sortDir = parsed?.sortDir;

      const validBy: SortBy[] = ['pct', 'qty', 'value', 'price'];
      const validDir: SortDir[] = ['asc', 'desc'];

      if (validBy.includes(sortBy)) this.sortBy = sortBy;
      if (validDir.includes(sortDir)) this.sortDir = sortDir;
    } catch {
      // si está corrupto, lo ignoramos
    }
  }



  loading = false;
  error = '';
  data: DashboardSummary | null = null;
  currencyOptions: { label: string; value: string }[] = [];
  currencySymbol = "€"; // fallback
  fxTooltip = "";
  private symbolMap: Record<string, string> = {
    EUR: "€",
    USD: "$",
    GBP: "£",
    JPY: "¥",
    CHF: "CHF",
  };
  selectedCurrency!: string;
  isRootScope = true; // por defecto
  currentScopePortfolioId?: string;

  // Sprint 3.5: precios crypto cacheados en memoria del componente


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
    private msg: MessageService,
    private http: HttpClient,
    private cryptoCatalogService: CryptoCatalogService
  ) {}

  ngOnInit(): void {
    this.restoreTopAssetsSort();
    this.loading = true;

    // 0) Cargar catálogo (logos) una vez antes del summary
    this.loadCryptoCatalogLogos$()
      .pipe(
        switchMap(() => this.route.queryParamMap),
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
          this.loadCurrencies();
          this.loadUserCurrency();
          this.reloadSummary();
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


  private loadCryptoCatalogLogos$() {
    // Evita recargar en cada cambio de portfolio / navegación interna
    if (this.catalogLogosLoaded) return of(true);

    return this.cryptoCatalogService.list().pipe(
      tap((res: any) => {
        const map: Record<string, string | null> = {};
        const items: any[] = res?.cryptos ?? [];

        for (const c of items) {
          const ref = String(c?.providerRef ?? '').trim().toLowerCase();
          if (!ref) continue;
          map[ref] = (typeof c?.logoUrl === 'string' && c.logoUrl.length > 0) ? c.logoUrl : null;
        }

        this.catalogLogoMap = map;
        this.catalogLogosLoaded = true;
      }),
      map(() => true),
      catchError((err) => {
        // No rompemos el dashboard si el catálogo falla; simplemente no habrá logos.
        console.error('Error loading crypto catalog', err);
        this.catalogLogoMap = {};
        this.catalogLogosLoaded = true;
        return of(true);
      })
    );
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

      const grandTotal = res?.totals?.total ?? 0;

      // ✅ ViewModel para Top assets
      this.topAssets = (res.byAsset || []).map((a: any) => {
        const valueAmount = Number(a.total ?? 0);
        const weightPct = grandTotal > 0 ? (valueAmount / grandTotal) * 100 : 0;

        return {
          assetId: a.assetId,
          name: a.name,
          symbol: a.symbol,
          type: a.type,
          providerRef: a.providerRef,
          valueAmount,
          weightPct,
          unitPrice: null,
          quantity: null,
          logoUrl: this.catalogLogoMap[String(a.providerRef || '').trim().toLowerCase()] ?? null,
        } as TopAssetRow;
      });

      this.currencySymbol = this.getSymbol(this.data?.currency);
      this.fxTooltip = this.formatFxTooltip(this.data);
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

      // 4) ✅ Reset mapas al cambiar scope (evita valores viejos)
      this.cryptoPriceMap = {};
      this.cryptoLogoMap = {};
    }),

    // 5) Cargar precios+logos crypto (si hay providerRef)
    switchMap((res) => {
      const cryptoRefs = (res.byAsset || [])
        .filter((a: any) => a.type === 'CRYPTO' && !!a.providerRef)
        .map((a: any) => String(a.providerRef).trim().toLowerCase());

      const uniqueRefs = Array.from(new Set(cryptoRefs)).filter(Boolean);

      if (!uniqueRefs.length) {
        return of(null);
      }

      const vs = String(res.currency || 'EUR').toLowerCase();
      

      // ✅ OJO: aquí usamos el endpoint NUEVO que devuelve price+image
      return this.prices.getCryptoPrices(uniqueRefs, vs).pipe(
        tap((p: any) => {
          // p viene normalizado por tu backend como:
          // { ok:true, provider, vs, data: { [id]: { price, currency } } }
          const data: any = p?.data ?? {};

          const priceMap: Record<string, number | null> = {};

          for (const ref of uniqueRefs) {
            const node = data?.[ref];
            const rawPrice = node?.price ?? null;
            priceMap[ref] = (typeof rawPrice === 'number' && isFinite(rawPrice)) ? rawPrice : null;
          }

          this.cryptoPriceMap = priceMap;

          // ✅ Aplicar precio + cantidad. Logo NO viene de aquí: viene del catálogo.
          this.topAssets = this.topAssets.map(row => {
            if (row.type !== 'CRYPTO') return row;

            const ref = String(row.providerRef || '').trim().toLowerCase();
            const unitPrice = this.cryptoPriceMap[ref] ?? null;

            return {
              ...row,
              unitPrice,
              quantity: unitPrice && unitPrice > 0 ? (row.valueAmount / unitPrice) : null,
              // logoUrl se queda como estaba (catalog)
            };
          });
        }),
        catchError((err) => {
          console.error('Error loading crypto prices', err);
          this.cryptoPriceMap = {};
          // NO toques logoMap aquí; logos vienen de catálogo
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

  loadCurrencies() {
    this.http.get<any>("/api/v1/fx/currencies").subscribe({
      next: (res) => {
        this.currencyOptions = res.currencies.map((c: string) => ({
          label: c,
          value: c,
        }));
      },
    });
  }

  loadUserCurrency() {
    this.http.get<any>("/api/v1/users/me/display-currency").subscribe({
      next: (res) => {
        this.selectedCurrency = res.currency;
      },
    });
  }

  onCurrencyChange(currency: string) {
    this.http
      .put("/api/v1/users/me/display-currency", { currency })
      .subscribe({
        next: () => {
          this.reloadSummary(); // 🔥 clave
        },
      });
  }

  getSymbol(code?: string): string {
  const c = String(code || "EUR").toUpperCase();
  return this.symbolMap[c] ?? c;
  }


  private formatFxTooltip(data: any) {
  if (!data?.fx) return "";


  const fetched = data.fx.fetchedAt ? new Date(data.fx.fetchedAt) : null;
  const fetchedStr = fetched
  ? fetched.toLocaleString() // se verá en local del navegador
  : "N/A";


  // Ej: "FX: cache · Updated: 28/01/2026, 12:00:00 · Rate: 1 EUR = 1.08 USD"
  const base = data.baseCurrency || "EUR";
  const cur = data.currency || "EUR";
  const rate = data.fx.rate;


  return `FX: ${data.fx.source} · Updated: ${fetchedStr} · Rate: 1 ${base} = ${rate} ${cur}`;
  }

  onSortByChange(value: SortBy) {
    this.sortBy = value;
    this.persistTopAssetsSort();
  }

}
