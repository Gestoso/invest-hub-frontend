import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { PortfoliosService, PortfolioNode } from '../../../core/api/portfolios.service';
import { MessageService } from 'primeng/api';

type ParentOption = { id: string; label: string };
type CategoryOption = { label: string; value: string };

@Component({
  selector: 'app-subportfolio-modal',
  templateUrl: './subportfolio-modal.component.html',
  styleUrls: ['./subportfolio-modal.component.scss']
})
export class SubportfolioModalComponent implements OnChanges {
  @Input() open = false;
  @Input() roots: PortfolioNode[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<{ id: string; name: string }>();

  loading = false;
  error = '';

  parentOptions: ParentOption[] = [];
  categoryOptions: CategoryOption[] = [
    { label: 'GENERAL', value: 'GENERAL' },
    { label: 'CRYPTO', value: 'CRYPTO' },
    { label: 'METALS', value: 'METALS' },
    { label: 'ETF', value: 'ETF' },
    { label: 'STOCKS', value: 'STOCKS' },
    { label: 'CASH', value: 'CASH' },
    { label: 'OTHER', value: 'OTHER' },
  ];

  form = this.fb.group({
    parentId: ['', Validators.required],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    category: ['GENERAL', Validators.required],
  });

  constructor(private fb: FormBuilder, private portfolios: PortfoliosService, private msg: MessageService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.error = '';
      this.loading = false;

      this.parentOptions = this.buildParentOptions(this.roots);
      const rootId = this.roots?.[0]?.id || '';

      // defaults
      this.form.reset({
        parentId: rootId,
        name: '',
        category: 'GENERAL',
      });
    }
  }

  private buildParentOptions(nodes: PortfolioNode[]): ParentOption[] {
    const options: ParentOption[] = [];
    const walk = (n: PortfolioNode, depth: number) => {
      const prefix = depth === 0 ? '' : '— '.repeat(depth);
      options.push({ id: n.id, label: `${prefix}${n.name}` });
      (n.children || []).forEach(c => walk(c, depth + 1));
    };

    (nodes || []).forEach(r => walk(r, 0));
    return options;
  }

  close(): void {
    if (this.loading) return;
    this.open = false;
    this.closed.emit();
  }

  save(): void {
    this.error = '';
    if (this.form.invalid) return;

    const { parentId, name, category } = this.form.getRawValue();

    this.loading = true;
    this.portfolios.create({
      name: name as string,
      parentId: parentId as string,
      category: category as string,
    }).subscribe({
        next: (res) => {
          this.loading = false;
          const p = res.portfolio;

          this.msg.add({
            severity: 'success',
            summary: 'Subportfolio creado',
            detail: p.name
          });

          this.open = false;
          this.created.emit({ id: p.id, name: p.name });
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.message || 'Error creando subportfolio';

          this.msg.add({
            severity: 'error',
            summary: 'Error',
            detail: this.error
          });
        }
    });
  }
}