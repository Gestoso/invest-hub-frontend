import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export type CryptoCatalogItem = {
  symbol: string;
  name: string;
  providerRef: string;
};

@Injectable({ providedIn: 'root' })
export class CryptoCatalogService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  list(): Observable<{ ok: boolean; provider: string; cryptos: CryptoCatalogItem[] }> {
    return this.http.get<{ ok: boolean; provider: string; cryptos: CryptoCatalogItem[] }>(
      `${this.base}/crypto/catalog`
    );
  }
}
