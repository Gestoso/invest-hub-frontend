import { Component, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { PositionLogsService, PositionLogDto } from '../../core/api/positions-logs.service';

@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
})
export class LogsComponent implements OnInit {
  loading = false;

  items: PositionLogDto[] = [];
  total = 0;

  // paginación
  limit = 50;
  offset = 0;

  form = this.fb.group({
    portfolioId: [''],
    assetId: [''],
  });

  constructor(
    private fb: FormBuilder,
    private logsService: PositionLogsService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;

    const { portfolioId, assetId } = this.form.value;

    this.logsService.getLogs({
      portfolioId: portfolioId || undefined,
      assetId: assetId || undefined,
      limit: this.limit,
      offset: this.offset,
    }).subscribe({
      next: (res) => {
        this.items = res.items || [];
        this.total = res.count ?? this.items.length;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  onSearch(): void {
    this.offset = 0;
    this.load();
  }

  onReset(): void {
    this.form.reset({ portfolioId: '', assetId: '' });
    this.offset = 0;
    this.load();
  }

  onPageChange(event: any): void {
    // PrimeNG paginator: event.first es offset, event.rows es limit
    this.offset = event.first ?? 0;
    this.limit = event.rows ?? 50;
    this.load();
  }

  formatQty(v: string | null): string {
    if (v === null || v === undefined) return '-';
    return v;
  }

  actionLabel(a: string): string {
    return a === 'ADD' ? 'Añadido' : 'Set';
  }

  actionSeverity(a: string): 'success' | 'info' | 'warn' | 'danger' {
    return a === 'ADD' ? 'success' : 'info';
  }
}
