// src/app/shared/models/positions.models.ts

export type PositionValueMode = 'MANUAL' | 'MARKET';
export type UpsertMode = 'ADD' | 'SET';

export interface UpsertPositionRequest {
  assetId: string;

  // Cómo se valora
  valueMode?: PositionValueMode; // default MANUAL

  // Cómo se aplica
  mode?: UpsertMode; // default ADD

  // MANUAL
  valueAmount?: number;
  valueCurrency?: string;

  // MARKET (crypto)
  quantity?: number;
  costAmount?: number;
  costCurrency?: string;

  notes?: string;
}

export interface PositionDto {
  id: string;
  portfolioId: string;
  assetId: string;

  valueMode: PositionValueMode;

  // MANUAL
  valueAmount: number | null;
  valueCurrency: string | null;

  // MARKET
  quantity: number | null;
  costAmount: number | null;
  costCurrency: string | null;

  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertPositionResponse {
  ok: boolean;
  mode: 'created' | 'updated';
  position: PositionDto;
}