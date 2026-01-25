import { Component } from '@angular/core';
import { UiStateService } from '../../core/ui/ui-state.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss']
})
export class ShellComponent {
  sidebarOpen$: Observable<boolean>;

  constructor(private ui: UiStateService) {
    this.sidebarOpen$ = this.ui.sidebarOpen$;
  }

  closeSidebar(): void {
    this.ui.closeSidebar();
  }
}