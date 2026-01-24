import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { AssetsService, Asset } from '../../../core/api/assets.service';
import { PortfoliosService, PortfolioNode } from '../../../core/api/portfolios.service';
import { PositionsService } from '../../../core/api/positions.service';
import { CryptoCatalogService, CryptoCatalogItem } from '../../../core/api/crypto-catalog.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-position-modal',
  templateUrl: './position-modal.component.html',
  styleUrls: ['./position-modal.component.scss']
})
export class PositionModalComponent implements OnChanges {
  @Input() open = false;
  @Input() defaultPortfolioId?: string;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  loading = false;
  error = '';

  isCryptoPortfolioSelected = false;

  // Crypto catalog
  cryptos: CryptoCatalogItem[] = [];
  filteredCryptos: CryptoCatalogItem[] = [];

  // Portfolios
  roots: PortfolioNode[] = [];
  subportfolios: any[] = [];
  private portfolioCategoryById: Record<string, string> = {};

  // Assets (manual, non-crypto)
  assetsAll: Asset[] = [];
  assetsFiltered: Asset[] = [];

  // Main form
  form = this.fb.group({
    portfolioId: ['', Validators.required],
    assetId: ['', Validators.required],
    valueAmount: [null as any, [Validators.required, Validators.min(0.01)]],
    notes: [''],

    // crypto UI (reactive)
    cryptoSearch: [''],
    cryptoSymbol: [''], // required solo en CRYPTO
  });

  // Create asset (manual)
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
    private cryptoCatalog: CryptoCatalogService,
    private msg: MessageService
  ) {
    // ✅ Suscripción única al cambio de portfolio
    this.form.get('portfolioId')?.valueChanges.subscribe((id) => {
      this.applyModeByPortfolioId(id as string);
    });

    // ✅ Filtrado crypto al escribir
    this.form.get('cryptoSearch')?.valueChanges.subscribe(() => {
      this.filterCryptos();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.error = '';
      this.loading = true;

      // Reset UI/form state al abrir
      this.showCreateAsset = false;
      this.isCryptoPortfolioSelected = false;
      this.filteredCryptos = this.cryptos;

      // Limpieza campos crypto
      this.form.patchValue({ cryptoSearch: '', cryptoSymbol: '' }, { emitEvent: false });

      // Importante: al abrir, dejamos validadores en modo NO-CRYPTO por defecto.
      // Luego se reajustan cuando sepamos category real.
      this.setValidatorsForMode(false);

      // Si viene defaultPortfolioId lo seteo ya (disparará valueChanges)
      if (this.defaultPortfolioId) {
        this.form.patchValue({ portfolioId: this.defaultPortfolioId });
      }

      // Cargar datos (tree + assets + catálogo)
      this.loadData();
      this.loadCryptoCatalog();
    }
  }

  // -----------------------------
  // Data load
  // -----------------------------
  private loadCryptoCatalog(): void {
    this.cryptoCatalog.list().subscribe({
      next: (res) => {
        this.cryptos = res.cryptos || [];
        this.filteredCryptos = this.cryptos;
      },
      error: () => {
        this.cryptos = [];
        this.filteredCryptos = [];
      }
    });
  }

  private loadData(): void {
    // Portfolios tree
    this.portfoliosService.tree().subscribe({
      next: (res) => {
        this.roots = res.roots || [];
        this.subportfolios = this.flattenNonRoot(this.roots);

        // Mapa id -> category
        this.portfolioCategoryById = {};
        for (const p of this.subportfolios) {
          this.portfolioCategoryById[p.id] = p.category;
        }

        // ✅ Re-aplicar modo una vez ya tenemos category map (clave del bug)
        const currentId = this.form.get('portfolioId')?.value as string;
        if (currentId) {
          this.applyModeByPortfolioId(currentId, { reapplyValidators: true });
        }

        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Error cargando portfolios';
      }
    });

    // Assets list
    this.assetsService.list().subscribe({
      next: (res) => {
        this.assetsAll = res.assets || [];
        this.applyAssetsFilter();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Error cargando assets';
      }
    });
  }

  // -----------------------------
  // Mode + Validators
  // -----------------------------
  private applyModeByPortfolioId(portfolioId: string, opts?: { reapplyValidators?: boolean }): void {
    const category = this.portfolioCategoryById[portfolioId];

    // Si aún no tenemos category (tree no cargó), no cambiamos el modo.
    // Cuando llegue el tree, loadData() lo reaplica.
    if (!category) {
      if (opts?.reapplyValidators) {
        // Si nos piden reaplicar y no hay category, dejamos modo NO-CRYPTO
        this.setValidatorsForMode(false);
      }
      return;
    }

    const isCrypto = category === 'CRYPTO';
    this.isCryptoPortfolioSelected = isCrypto;

    // Apaga creación manual si es crypto
    if (isCrypto) this.showCreateAsset = false;

    // Ajusta validadores según modo
    this.setValidatorsForMode(isCrypto);

    // Reset de campos crypto cada vez que cambia portfolio (evita estados colgados)
    this.form.patchValue({ cryptoSearch: '', cryptoSymbol: '' }, { emitEvent: false });
    this.filteredCryptos = this.cryptos;

    // Filtra assets (oculta CRYPTO en no-crypto)
    this.applyAssetsFilter();
  }

  private setValidatorsForMode(isCrypto: boolean): void {
    const assetIdCtrl = this.form.get('assetId');
    const cryptoSymbolCtrl = this.form.get('cryptoSymbol');

    if (!assetIdCtrl || !cryptoSymbolCtrl) return;

    if (isCrypto) {
      // CRYPTO: cryptoSymbol requerido, assetId NO requerido
      assetIdCtrl.clearValidators();
      assetIdCtrl.setValue('', { emitEvent: false });

      cryptoSymbolCtrl.setValidators([Validators.required]);
    } else {
      // NO-CRYPTO: assetId requerido, cryptoSymbol NO requerido
      cryptoSymbolCtrl.clearValidators();
      cryptoSymbolCtrl.setValue('', { emitEvent: false });

      assetIdCtrl.setValidators([Validators.required]);
    }

    assetIdCtrl.updateValueAndValidity({ emitEvent: false });
    cryptoSymbolCtrl.updateValueAndValidity({ emitEvent: false });
  }

  // -----------------------------
  // Crypto filter
  // -----------------------------
  filterCryptos(): void {
    const q = (this.form.get('cryptoSearch')?.value || '').toString().trim().toLowerCase();

    if (!q) {
      this.filteredCryptos = this.cryptos;
      return;
    }

    this.filteredCryptos = (this.cryptos || []).filter(c =>
      c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }

  // -----------------------------
  // Assets filter (hide CRYPTO on non-crypto portfolios)
  // -----------------------------
  private applyAssetsFilter(): void {
    if (this.isCryptoPortfolioSelected) {
      this.assetsFiltered = [];
      return;
    }
    this.assetsFiltered = (this.assetsAll || []).filter(a => a.type !== 'CRYPTO');
  }

  // -----------------------------
  // Helpers
  // -----------------------------
  private flattenNonRoot(nodes: any[]): any[] {
    const out: any[] = [];
    const stack = [...nodes];

    while (stack.length) {
      const n = stack.shift();
      if (n.parentId) out.push(n);
      if (n.children?.length) stack.push(...n.children);
    }
    return out;
  }

  // -----------------------------
  // Manual asset creation (non-crypto)
  // -----------------------------
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
      type: (type as string),
      name: (name as string),
      symbol: (symbol || undefined) as any,
      currency: 'EUR',
    }).subscribe({
      next: (res) => {
        this.assetsService.list().subscribe({
          next: (list) => {
            this.assetsAll = list.assets || [];
            this.applyAssetsFilter();

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

  // -----------------------------
  // Modal actions
  // -----------------------------
  close(): void {
    if (this.loading) return;
    this.open = false;
    this.closed.emit();
  }

  save(): void {
    this.error = '';

    // ⚠️ Importante: en CRYPTO el form puede estar "invalid" si assetId sigue required.
    // Ya lo manejamos con setValidatorsForMode(), así que esto debería funcionar.
    if (this.form.invalid) return;

    const { portfolioId, assetId, valueAmount, notes } = this.form.getRawValue();
    const cryptoSymbol = (this.form.get('cryptoSymbol')?.value || '').toString().trim();

    // CRYPTO portfolio: catálogo
    if (this.isCryptoPortfolioSelected) {
      if (!cryptoSymbol) {
        this.error = 'Selecciona una criptomoneda del catálogo.';
        return;
      }

      this.loading = true;

      this.assetsService.getOrCreateCrypto(cryptoSymbol).subscribe({
        next: (res) => {
          const createdAssetId = res?.asset?.id;
          if (!createdAssetId) {
            this.loading = false;
            this.error = 'No se pudo crear/obtener el asset CRYPTO.';
            return;
          }

          this.positionsService.upsertPosition(portfolioId as string, {
            assetId: createdAssetId,
            valueAmount: Number(valueAmount),
            valueCurrency: 'EUR',
            notes: (notes || undefined) as any
          }).subscribe({
            next: () => {
            this.loading = false; 
            this.msg.add({
              severity: 'success',
              summary: 'Posición guardada',
              detail: 'Se ha actualizado correctamente'
            });
            this.close();
            this.saved.emit();
            this.form.reset();
            },
            error: (err) => {
              this.loading = false;
              this.msg.add({
                severity: 'error',
                summary: 'Error',
                detail: this.error
              });
              this.error = err?.error?.message || 'Error guardando posición';
            }
          });
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.message || 'Error creando/obteniendo el asset CRYPTO';
        }
      });

      return;
    }

    // NO-CRYPTO portfolio: assetId manual
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
        this.saved.emit();
        this.form.reset();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Error guardando posición';
      }
    });
  }
}
