import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PricesService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // 🔹 YA EXISTENTE (simple/price)
  getCryptoPrices(ids: string[], vs: string) {
    const params = {
      ids: (ids || []).join(','),
      vs: (vs || 'eur').toLowerCase(),
    };
    console.log("prices/crypto")

    return this.http.get<any>(`${this.baseUrl}/prices/crypto`, { params });
  }

  // 🔹 NUEVO: prices + logos (CoinGecko /coins/markets)
  getCryptoMarkets(ids: string[], vs: string) {
    const cleanIds = Array.from(
      new Set((ids || []).map(x => String(x).trim().toLowerCase()).filter(Boolean))
    );

    const params = {
      ids: cleanIds.join(','),
      vs: (vs || 'eur').toLowerCase(),
    };
    console.log("prices/crypto/markets")
    return this.http.get<any>(`${this.baseUrl}/prices/crypto/markets`, { params });
  }
}
