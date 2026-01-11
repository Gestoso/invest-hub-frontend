import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export type PortfolioNode = {
  id: string;
  userId: string;
  parentId: string | null;
  name: string;
  currency: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  children: PortfolioNode[];
};

@Injectable({ providedIn: 'root' })
export class PortfoliosService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  tree(): Observable<{ ok: boolean; roots: PortfolioNode[] }> {
    return this.http.get<{ ok: boolean; roots: PortfolioNode[] }>(
      `${this.base}/portfolios/tree`
    );
  }
  
  create(payload: { name: string; parentId?: string; currency?: string; sortOrder?: number }) {
    return this.http.post<{ ok: boolean; portfolio: any }>(`${this.base}/portfolios`, payload);
  }

}
