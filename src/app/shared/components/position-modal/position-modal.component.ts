import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AssetsService, Asset } from '../../../core/api/assets.service';
import { PortfoliosService, PortfolioNode } from '../../../core/api/portfolios.service';
import { PositionsService } from '../../../core/api/positions.service';
import { CryptoCatalogService, CryptoCatalogItem } from '../../../core/api/crypto-catalog.service';

@Component({
  selector: 'app-position-modal',
  templateUrl: './position-modal.component.html',
  styleUrls: ['./position-modal.component.scss']
})
export class PositionModalComponent implements OnChanges {
  @Input() open = false;

  // opcional: precargar portfolio actual si estás en un scope
  @Input() defaultPortfolioId?: string;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  loading = false;
  error = '';
  isCryptoPortfolioSelected = false;

  cryptos: CryptoCatalogItem[] = [];
  cryptoSearch = '';
  filteredCryptos: CryptoCatalogItem[] = [];

  selectedCryptoSymbol: string | null = null; // lo que elegirá el usuario

  roots: PortfolioNode[] = [];
  assets: Asset[] = [];

  form = this.fb.group({
    portfolioId: ['', Validators.required],
    assetId: ['', Validators.required],
    valueAmount: [null as any, [Validators.required, Validators.min(0.01)]],
    notes: ['']
  });

  showCreateAsset = false;

  assetForm = this.fb.group({
    type: ['METAL', Validators.required],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    symbol: [''],
  });

  constructor(
    private fb: FormBuilder,
    private assetsService: AssetsService,
    private portfoliosService: PortfoliosService,
    private positionsService: PositionsService,
    private cryptoCatalog: CryptoCatalogService
  ) {}


  private portfolioNameById: Record<string, string> = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.error = '';
      this.loadData();
      this.cryptoCatalog.list().subscribe({
        next: (res) => {
          this.cryptos = res.cryptos || [];
          this.filteredCryptos = this.cryptos;
        },
        error: () => {
          // no rompemos el modal si falla el catálogo
          this.cryptos = [];
          this.filteredCryptos = [];
        }
      });
      // set default portfolio si viene
      if (this.defaultPortfolioId) {
        this.form.patchValue({ portfolioId: this.defaultPortfolioId });
      }
    }
  }

  private loadData(): void {
    this.loading = true;

    // Cargar ambos en paralelo (simple con 2 subs; si quieres, lo pasamos a forkJoin)
    this.portfoliosService.tree().subscribe({
      next: (res) => {
        this.roots = res.roots || [];
        this.portfolioNameById = {};
        for (const p of this.subportfolios) {
          this.portfolioNameById[p.id] = p.name;
        }
        this.subportfolios = this.flattenNonRoot(this.roots);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Error cargando portfolios';
      }
    });

    this.assetsService.list().subscribe({
      next: (res) => (this.assets = res.assets || []),
      error: (err) => (this.error = err?.error?.message || 'Error cargando assets')
    });
  }

  close(): void {
    if (this.loading) return;
    this.open = false;
    this.closed.emit();
  }

  save(): void {
    this.error = '';
    if (this.form.invalid) return;

    const { portfolioId, assetId, valueAmount, notes } = this.form.getRawValue();

    this.loading = true;
    this.positionsService.upsertPosition(portfolioId as string, {
      assetId: assetId as string,
      valueAmount: Number(valueAmount),
      valueCurrency: 'EUR',
      notes: (notes || undefined) as any
    }).subscribe({
      next: () => {
        this.loading = false;
        this.close();
        this.saved.emit(); // para refrescar dashboard
        this.form.reset();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Error guardando posición';
      }
    });
  }

  private flattenNonRoot(nodes: any[]): any[] {
    const out: any[] = [];
    const stack = [...nodes];

    while (stack.length) {
      const n = stack.shift();
      if (n.parentId) out.push(n); // ✅ solo no-root
      if (n.children?.length) stack.push(...n.children);
    }

    return out;
  }

  subportfolios: any[] = [];

  toggleCreateAsset(): void {
    this.showCreateAsset = !this.showCreateAsset;
    this.error = '';
  }

  createAsset(): void {
    this.error = '';
    if (this.assetForm.invalid) return;

    const { type, name, symbol } = this.assetForm.getRawValue();

    this.loading = true;
    this.assetsService.create({
      type: type as string,
      name: name as string,
      symbol: (symbol || undefined) as any,
      currency: 'EUR',
    }).subscribe({
      next: (res) => {
        // recargar lista de assets y seleccionar el nuevo
        this.assetsService.list().subscribe({
          next: (list) => {
            this.assets = list.assets || [];
            const createdId = res?.asset?.id;
            if (createdId) this.form.patchValue({ assetId: createdId });
            this.loading = false;
            this.showCreateAsset = false;
            this.assetForm.reset({ type: 'METAL', name: '', symbol: '' });
          },
          error: () => {
            this.loading = false;
          }
        });
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Error creando asset';
      }
    });
  }


}
