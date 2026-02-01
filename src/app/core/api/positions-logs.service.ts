import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type PositionLogAction = 'ADD' | 'SET';

export interface PositionLogDto {
  id: string;
  userId: string;
  portfolioId: string;
  assetId: string;

  action: PositionLogAction;
  valueMode: 'MARKET';

  oldQuantity: string | null;
  deltaQuantity: string;
  newQuantity: string;

  createdAt: string;

  // si tu backend hace include:
  asset?: { id: string; symbol?: string; name?: string };
  portfolio?: { id: string; name?: string };
}

export interface PositionLogsResponse {
  items: PositionLogDto[];
  count: number;
}

@Injectable({ providedIn: 'root' })
export class PositionLogsService {
  private readonly API = 'http://localhost:3000/api/v1';

  constructor(private http: HttpClient) {}

  getLogs(opts?: {
    portfolioId?: string;
    assetId?: string;
    limit?: number;
    offset?: number;
  }): Observable<PositionLogsResponse> {
    let params = new HttpParams();
    if (opts?.portfolioId) params = params.set('portfolioId', opts.portfolioId);
    if (opts?.assetId) params = params.set('assetId', opts.assetId);
    if (opts?.limit != null) params = params.set('limit', String(opts.limit));
    if (opts?.offset != null) params = params.set('offset', String(opts.offset));

    return this.http.get<PositionLogsResponse>(`${this.API}/logs`, { params });
  }
}
