// src/app/core/api/positions.service.ts

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  UpsertPositionRequest,
  UpsertPositionResponse,
} from '../../shared/models/positions.models';

@Injectable({ providedIn: 'root' })
export class PositionsService {
  private readonly baseUrl = 'http://localhost:3000/api/v1';

  constructor(private http: HttpClient) {}

  upsertPosition(
    portfolioId: string,
    payload: UpsertPositionRequest
  ): Observable<UpsertPositionResponse> {
    return this.http.post<UpsertPositionResponse>(
      `${this.baseUrl}/portfolios/${portfolioId}/positions`,
      payload
    );
  }

  listPositions(portfolioId: string) {
    return this.http.get<{ ok: boolean; positions: any[] }>(
      `${this.baseUrl}/portfolios/${portfolioId}/positions`
    );
  }
}