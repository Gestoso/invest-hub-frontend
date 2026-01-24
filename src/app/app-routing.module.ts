import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LoginComponent } from './features/auth/pages/login/login.component';
import { RegisterComponent } from './features/auth/pages/register/register.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { AuthGuard } from './core/auth/auth.guard';
import { PortfoliosComponent } from './features/portfolios/portfolios.component';
import { AssetsComponent } from './features/assets/assets.component';
import { ShellComponent } from './layout/shell/shell.component';

const routes: Routes = [
  // públicas
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },

  // privadas: todo dentro del shell
  {
    path: '',
    component: ShellComponent,
    canActivate: [AuthGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'portfolios', component: PortfoliosComponent },
      { path: 'assets', component: AssetsComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ]
  },

  { path: '**', redirectTo: 'dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
