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

  sortBy: SortBy = 'pct';
  sortDir: SortDir = 'desc';

sortOptions = [
  { label: '% del portfolio', value: 'pct' },
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

  toggleSortDir() {
    this.sortDir = this.sortDir === 'desc' ? 'asc' : 'desc';
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
    private msg: MessageService,
    private http: HttpClient
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

        // 4) Reset precios al cambiar scope (para que no se queden precios “viejos”)
        this.cryptoPriceMap = {};
        // Actualizamos quantity para cryptos (si price disponible)
this.topAssets = this.topAssets.map(row => {
  if (row.type !== 'CRYPTO') return { ...row, unitPrice: null, quantity: null };

  const ref = String(row.providerRef || '').trim().toLowerCase();
  const price = this.cryptoPriceMap[ref];

  if (!price || price <= 0) {
    return { ...row, unitPrice: null, quantity: null };
  }

  return {
    ...row,
    unitPrice: price,
    quantity: row.valueAmount / price,
  };
});


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

          const vs = String(res.currency || 'EUR').toLowerCase();
          return this.prices.getCryptoPrices(uniqueRefs, vs).pipe(
          tap((p) => {
            const map: any = (p as any)?.data ?? (p as any);
            for (const ref of uniqueRefs) {
              const node = map?.[ref];

              // soporta 2 formatos:
              // 1) { id: { eur: 123 } }   (CoinGecko raw)
              // 2) { id: { price: 123 } } (tu wrapper)
              const rawPrice =
                node?.price ??
                node?.[vs] ??
                null;

              map[ref] = (typeof rawPrice === 'number' && isFinite(rawPrice)) ? rawPrice : null;
            }
            this.cryptoPriceMap = map; 
            // ✅ Aplicar precio + calcular cantidad al ViewModel
            this.topAssets = this.topAssets.map(row => {
              if (row.type !== 'CRYPTO') return row;

              const ref = String(row.providerRef || '').trim().toLowerCase();
              const price = this.cryptoPriceMap[ref];

              if (!price || price <= 0) {
                return { ...row, unitPrice: null, quantity: null };
              }

              return {
                ...row,
                unitPrice: price,
                quantity: row.valueAmount / price,
              };
            });
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

}
