import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UiStateService {
  private sidebarOpenSubject = new BehaviorSubject<boolean>(false);
  sidebarOpen$ = this.sidebarOpenSubject.asObservable();

  openSidebar(): void { this.sidebarOpenSubject.next(true); }
  closeSidebar(): void { this.sidebarOpenSubject.next(false); }
  toggleSidebar(): void { this.sidebarOpenSubject.next(!this.sidebarOpenSubject.value); }

  get isSidebarOpen(): boolean { return this.sidebarOpenSubject.value; }
}