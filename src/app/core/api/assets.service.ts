import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export type Asset = {
  id: string;
  type: string;
  name: string;
  symbol?: string | null;
  currency: string;
};

@Injectable({ providedIn: 'root' })
export class AssetsService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  list(): Observable<{ ok: boolean; assets: Asset[] }> {
    return this.http.get<{ ok: boolean; assets: Asset[] }>(`${this.base}/assets`);
  }

  create(payload: { type: string; name: string; symbol?: string; currency?: string }) {
    return this.http.post<any>(`${this.base}/assets`, payload);
  }

  getOrCreateCrypto(symbol: string) {
    return this.http.post<{ ok: boolean; mode: 'created' | 'existing'; asset: any }>(
      `${this.base}/assets/crypto`,
      { symbol }
    );
  }


}
