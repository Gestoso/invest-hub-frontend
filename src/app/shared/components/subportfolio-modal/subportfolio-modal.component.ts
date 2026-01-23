import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { PortfoliosService } from '../../../core/api/portfolios.service';
import { PortfolioNode } from '../../../core/api/portfolios.service';

@Component({
  selector: 'app-subportfolio-modal',
  templateUrl: './subportfolio-modal.component.html',
  styleUrls: ['./subportfolio-modal.component.scss']
})
export class SubportfolioModalComponent implements OnChanges {
  @Input() open = false;
  @Input() roots: PortfolioNode[] = [];
  @Input() defaultParentId?: string;
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<{ id: string; name: string }>();

  loading = false;
  error = '';
  parentOptions: Array<{ id: string; label: string }> = [];

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    category: ['GENERAL', Validators.required],
    parentId: ['', Validators.required]
  });


  constructor(private fb: FormBuilder, private portfolios: PortfoliosService) {}

  ngOnChanges(): void {
    if (this.open) {
      this.error = '';
      this.parentOptions = this.buildParentOptions();

      // parent por defecto: el root si existe, o defaultParentId si viene
      const rootId = this.roots?.[0]?.id;
      this.form.patchValue({
        parentId: this.defaultParentId || rootId || ''
      });
    }
  }

  close(): void {
    if (this.loading) return;
    this.open = false;
    this.error = '';
    this.closed.emit();
    this.form.reset({ name: '' });
  }

  save(): void {
    this.error = '';
    if (this.form.invalid) return;

    const { name, parentId, category } = this.form.getRawValue();

    this.loading = true;
    this.portfolios.create({ name: name as string, parentId: parentId as string, category: category as string }).subscribe({
      next: (res) => {
        this.loading = false;
        const p = res.portfolio;
        this.close();
        this.created.emit({ id: p.id, name: p.name });
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Error creando subportfolio';
      }
    });
  }

  private buildParentOptions(): Array<{ id: string; label: string }> {
    const options: Array<{ id: string; label: string }> = [];

    const walk = (node: PortfolioNode, depth: number) => {
      const prefix = depth === 0 ? '' : '— '.repeat(depth);
      options.push({ id: node.id, label: `${prefix}${node.name}` });
      for (const c of node.children || []) walk(c, depth + 1);
    };

    for (const r of this.roots || []) walk(r, 0);
    return options;
  }

}
