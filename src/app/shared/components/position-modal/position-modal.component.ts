import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AssetsService, Asset } from '../../../core/api/assets.service';
import { PortfoliosService, PortfolioNode } from '../../../core/api/portfolios.service';
import { PositionsService } from '../../../core/api/positions.service';
import { CryptoCatalogService, CryptoCatalogItem } from '../../../core/api/crypto-catalog.service';
import { MessageService } from 'primeng/api'; 
import { PositionValueMode, UpsertMode } from '../../../shared/models/positions.models';

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

  // UI options
  valueModeOptions = [
    { label: 'Manual (€)', value: 'MANUAL' as PositionValueMode },
    { label: 'Market (cantidad)', value: 'MARKET' as PositionValueMode },
  ];

  upsertModeOptions = [
    { label: 'Sumar (ADD)', value: 'ADD' as UpsertMode },
    { label: 'Reemplazar (SET)', value: 'SET' as UpsertMode },
  ];

  // Main form
  form = this.fb.group({
    portfolioId: ['', Validators.required],

    // Non-crypto UI
    assetId: ['', Validators.required],

    // General
    notes: [''],
    mode: ['ADD' as UpsertMode, Validators.required],

    // ✅ NEW: valuation mode
    valueMode: ['MANUAL' as PositionValueMode, Validators.required],

    // MANUAL
    valueAmount: [null as any],

    // MARKET (crypto)
    quantity: [null as any],
    costAmount: [null as any],
    costCurrency: ['EUR'],

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
    // ✅ Portfolio change => crypto/non-crypto mode
    this.form.get('portfolioId')?.valueChanges.subscribe((id) => {
      this.applyModeByPortfolioId(id as string);
    });

    // ✅ Crypto search filter
    this.form.get('cryptoSearch')?.valueChanges.subscribe(() => {
      this.filterCryptos();
    });

    // ✅ valueMode change => validators for valueAmount vs quantity
    this.form.get('valueMode')?.valueChanges.subscribe(() => {
      this.applyValueValidators();
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
      this.form.patchValue(
        {
          cryptoSearch: '',
          cryptoSymbol: '',
          valueMode: 'MANUAL',
          mode: 'ADD',
          quantity: null,
          costAmount: null,
          costCurrency: 'EUR',
          valueAmount: null,
          notes: '',
        },
        { emitEvent: false }
      );

      // Validadores base (NO-CRYPTO por defecto)
      this.setValidatorsForPortfolioMode(false);

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

        // ✅ Re-aplicar modo una vez ya tenemos category map
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
  // Portfolio mode + validators
  // -----------------------------
  private applyModeByPortfolioId(portfolioId: string, opts?: { reapplyValidators?: boolean }): void {
    const category = this.portfolioCategoryById[portfolioId];

    // Si aún no tenemos category (tree no cargó), no cambiamos el modo.
    if (!category) {
      if (opts?.reapplyValidators) this.setValidatorsForPortfolioMode(false);
      return;
    }

    const isCrypto = category === 'CRYPTO';
    this.isCryptoPortfolioSelected = isCrypto;

    // Apaga creación manual si es crypto
    if (isCrypto) this.showCreateAsset = false;

    // Ajusta validadores según portfolio mode (assetId vs cryptoSymbol)
    this.setValidatorsForPortfolioMode(isCrypto);

    // Si NO es crypto, forzamos valueMode MANUAL
    if (!isCrypto) {
      this.form.patchValue({ valueMode: 'MANUAL' }, { emitEvent: false });
    }

    // Ajusta validadores valueAmount/quantity según valueMode actual
    this.applyValueValidators();

    // Reset campos crypto al cambiar portfolio
    this.form.patchValue({ cryptoSearch: '', cryptoSymbol: '' }, { emitEvent: false });
    this.filteredCryptos = this.cryptos;

    // Filtra assets (oculta CRYPTO en no-crypto)
    this.applyAssetsFilter();
  }

  private setValidatorsForPortfolioMode(isCrypto: boolean): void {
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

  private applyValueValidators(): void {
    const valueMode = (this.form.get('valueMode')?.value || 'MANUAL') as PositionValueMode;

    const valueAmountCtrl = this.form.get('valueAmount');
    const quantityCtrl = this.form.get('quantity');

    if (!valueAmountCtrl || !quantityCtrl) return;

    // Reset
    valueAmountCtrl.clearValidators();
    quantityCtrl.clearValidators();

    if (!this.isCryptoPortfolioSelected) {
      // NO-CRYPTO => siempre MANUAL por dinero
      valueAmountCtrl.setValidators([Validators.required, Validators.min(0.01)]);
    } else {
      // CRYPTO => depende de valueMode
      if (valueMode === 'MANUAL') {
        valueAmountCtrl.setValidators([Validators.required, Validators.min(0.01)]);
      } else {
        quantityCtrl.setValidators([Validators.required, Validators.min(0.00000001)]);
      }
    }

    valueAmountCtrl.updateValueAndValidity({ emitEvent: false });
    quantityCtrl.updateValueAndValidity({ emitEvent: false });
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

    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    const portfolioId = v.portfolioId as string;
    const notes = (v.notes || undefined) as any;
    const upsertMode = (v.mode || 'ADD') as UpsertMode;

    // -----------------------------
    // CRYPTO portfolio: catálogo + getOrCreateCrypto
    // -----------------------------
    if (this.isCryptoPortfolioSelected) {
      const cryptoSymbol = (this.form.get('cryptoSymbol')?.value || '').toString().trim();
      const valueMode = (v.valueMode || 'MANUAL') as PositionValueMode;

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

          // Payload a backend (soporta MANUAL/MARKET)
          const payload: any = {
            assetId: createdAssetId,
            mode: upsertMode,
            valueMode,
            notes,
          };

          if (valueMode === 'MANUAL') {
            payload.valueAmount = Number(v.valueAmount);
            payload.valueCurrency = 'EUR';
          } else {
            payload.quantity = Number(v.quantity);
            if (v.costAmount != null && v.costAmount !== '') {
              payload.costAmount = Number(v.costAmount);
              payload.costCurrency = (v.costCurrency || 'EUR');
            }
          }

          this.positionsService.upsertPosition(portfolioId, payload).subscribe({
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
              this.error = err?.error?.message || 'Error guardando posición';
              this.msg.add({
                severity: 'error',
                summary: 'Error',
                detail: this.error
              });
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

    // -----------------------------
    // NO-CRYPTO portfolio: assetId manual (solo MANUAL)
    // -----------------------------
    this.loading = true;

    this.positionsService.upsertPosition(portfolioId, {
      assetId: v.assetId as string,
      mode: upsertMode,
      valueMode: 'MANUAL',
      valueAmount: Number(v.valueAmount),
      valueCurrency: 'EUR',
      notes
    } as any).subscribe({
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