import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export type DashboardSummary = {
  ok: boolean;
  currency: string;
  scope: { portfolioId: string; name: string };
  totals: { total: number; positionsCount: number };
  byPortfolio: Array<{ id: string; name: string; parentId: string | null; currency: string; total: number }>;
  byType: Array<{ type: string; total: number }>;
  byAsset: Array<{ assetId: string; name: string; symbol?: string | null; type: string; total: number }>;
};

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  summary(portfolioId?: string): Observable<DashboardSummary> {
    const url = portfolioId
      ? `${this.base}/dashboard/summary?portfolioId=${encodeURIComponent(portfolioId)}`
      : `${this.base}/dashboard/summary`;
    return this.http.get<DashboardSummary>(url);
  }
}
