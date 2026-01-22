import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export type CryptoPricesResponse = {
  ok: boolean;
  provider: string;
  vs: string;
  data: Record<string, { price: number | null; currency: string }>;
};

@Injectable({ providedIn: 'root' })
export class PricesService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  getCryptoPrices(ids: string[], vs = 'eur'): Observable<CryptoPricesResponse> {
    const clean = Array.from(new Set(ids.map(x => (x || '').trim().toLowerCase()).filter(Boolean)));
    const idsParam = clean.join(',');
    return this.http.get<CryptoPricesResponse>(`${this.base}/prices/crypto?ids=${encodeURIComponent(idsParam)}&vs=${encodeURIComponent(vs)}`);
  }
}
