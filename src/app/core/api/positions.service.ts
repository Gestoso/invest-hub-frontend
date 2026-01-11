import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

type UpsertPositionResponse = {
  ok: boolean;
  mode: 'created' | 'updated';
  position: {
    id: string;
    portfolioId: string;
    assetId: string;
    valueAmount: number;
    valueCurrency: string;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

@Injectable({ providedIn: 'root' })
export class PositionsService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  upsertPosition(portfolioId: string, payload: {
    assetId: string;
    valueAmount: number;
    valueCurrency?: string;
    notes?: string;
  }): Observable<UpsertPositionResponse> {
    return this.http.post<UpsertPositionResponse>(
      `${this.base}/portfolios/${portfolioId}/positions`,
      payload
    );
  }
}
