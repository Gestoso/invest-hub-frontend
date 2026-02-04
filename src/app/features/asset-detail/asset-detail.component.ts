import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DashboardService } from 'src/app/core/api/dashboard.service';
import { AssetsService } from 'src/app/core/api/assets.service';
import { PricesService } from 'src/app/core/api/prices.service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

type AssetVM = {
  id: string;
  name: string;
  symbol?: string | null;
  type?: string;
  providerRef?: string | null;

  weightPct: number;
  totalValue: number;

  unitPrice: number | null;
  quantity: number | null;

  portfoliosCount: number;
};

type RowByPortfolio = {
  portfolioId: string;
  portfolioName: string;
  quantity: number | null;
  value: number;
  pct: number;
};

@Component({
  selector: 'app-asset-detail',
  templateUrl: './asset-detail.component.html',
  styleUrls: ['./asset-detail.component.scss'],
})
export class AssetDetailComponent implements OnInit {
  loading = false;
  error = '';

  assetId = '';
  vm: AssetVM | null = null;
  rows: RowByPortfolio[] = [];

  currency = 'EUR';
  currencySymbol = '€';

  private base = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dash: DashboardService,
    private assets: AssetsService,
    private prices: PricesService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loading = true;

    this.route.paramMap.pipe(
      map(p => String(p.get('assetId') || '').trim()),
      switchMap((assetId) => {
        if (!assetId) return of({ ok: false, assetId: '' } as any);
        this.assetId = assetId;

        // 1) Summary global (root) => total del asset + % + currency
        return this.dash.summary().pipe(
          switchMap((sum: any) => {
            const totalsTotal = Number(sum?.totals?.total ?? 0);
            this.currency = String(sum?.currency || 'EUR');
            this.currencySymbol = this.symbol(this.currency);

            const a = (sum?.byAsset || []).find((x: any) => String(x.assetId) === assetId);
            if (!a) {
              return of({ ok: false, msg: 'Asset no encontrado en el resumen', sum } as any);
            }

            const totalValue = Number(a.total ?? 0);
            const weightPct = totalsTotal > 0 ? (totalValue / totalsTotal) * 100 : 0;

            const type = a.type;
            const providerRef = a.providerRef ?? null;

            // 2) Precio unitario (solo CRYPTO con providerRef)
            const price$ =
              type === 'CRYPTO' && providerRef
                ? this.prices.getCryptoPrices([String(providerRef).toLowerCase()], this.currency.toLowerCase()).pipe(
                    map((p: any) => {
                      const node = p?.data?.[String(providerRef).toLowerCase()];
                      const pr = node?.price;
                      return (typeof pr === 'number' && isFinite(pr)) ? pr : null;
                    }),
                    catchError(() => of(null))
                  )
                : of(null);

            // 3) Distribución por portfolio (usando positions)
            const dist$ = this.loadDistributionByPortfolio(assetId).pipe(
              catchError(() => of([] as RowByPortfolio[]))
            );

            return forkJoin({ price: price$, dist: dist$ }).pipe(
              map(({ price, dist }) => {
                const quantity = price && price > 0 ? (totalValue / price) : null;

                const portfoliosCount = dist.length;

                const vm: AssetVM = {
                  id: assetId,
                  name: a.name,
                  symbol: a.symbol,
                  type,
                  providerRef,
                  weightPct,
                  totalValue,
                  unitPrice: price,
                  quantity,
                  portfoliosCount,
                };

                return { ok: true, vm, dist };
              })
            );
          })
        );
      }),
      catchError((err) => of({ ok: false, msg: err?.message || 'Error cargando detalle' } as any))
    ).subscribe((res: any) => {
      this.loading = false;

      if (!res?.ok) {
        this.error = res?.msg || 'No se pudo cargar el activo';
        return;
      }

      this.vm = res.vm;
      this.rows = res.dist;
    });
  }

  back() {
    this.router.navigate(['/dashboard']);
  }

  private symbol(code: string): string {
    const c = String(code || 'EUR').toUpperCase();
    const map: any = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'CHF' };
    return map[c] ?? c;
  }

  private loadDistributionByPortfolio(assetId: string) {
    // Intento 1: endpoint filtrado
    const url1 = `${this.base}/positions?assetId=${encodeURIComponent(assetId)}`;

    return this.http.get<any>(url1).pipe(
      catchError(() => {
        // Intento 2: endpoint sin filtro
        const url2 = `${this.base}/positions`;
        return this.http.get<any>(url2);
      }),
      map((res: any) => {
        const positions: any[] = res?.positions ?? res ?? [];
        const filtered = positions.filter(p => String(p.assetId) === assetId);

        // esperamos shape mínimo: { portfolioId, portfolioName?, quantity?, value? }
        const by: Record<string, { name: string; value: number; qty: number | null }> = {};

        for (const p of filtered) {
          const portfolioId = String(p.portfolioId || '');
          if (!portfolioId) continue;

          const name = String(p.portfolioName || p.portfolio?.name || 'Portfolio');
          const value = Number(p.value ?? p.valueAmount ?? p.total ?? 0);
          const qty = (p.quantity === null || p.quantity === undefined) ? null : Number(p.quantity);

          if (!by[portfolioId]) by[portfolioId] = { name, value: 0, qty: null };

          by[portfolioId].value += value;

          // qty: si hay qty en alguna, sumamos, si no, queda null
          if (qty !== null && isFinite(qty)) {
            by[portfolioId].qty = (by[portfolioId].qty ?? 0) + qty;
          }
        }

        const total = Object.values(by).reduce((acc, x) => acc + x.value, 0);

        return Object.entries(by).map(([portfolioId, v]) => ({
          portfolioId,
          portfolioName: v.name,
          quantity: v.qty,
          value: v.value,
          pct: total > 0 ? (v.value / total) * 100 : 0,
        }));
      })
    );
  }
}
