import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ShellComponent } from './layout/shell/shell.component';
 
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthInterceptor } from './core/auth/auth.interceptor';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { LoginComponent } from './features/auth/pages/login/login.component';
import { RegisterComponent } from './features/auth/pages/register/register.component';
import { NavbarComponent } from './layout/navbar/navbar.component';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { NgChartsModule } from 'ng2-charts';
import { PositionModalComponent } from './shared/components/position-modal/position-modal.component';
import { SubportfolioModalComponent } from './shared/components/subportfolio-modal/subportfolio-modal.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { PanelMenuModule } from 'primeng/panelmenu';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password'; 
import { TableModule } from 'primeng/table'; 
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown'; 
import { InputNumberModule } from 'primeng/inputnumber';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    LoginComponent,
    RegisterComponent,
    NavbarComponent,
    SidebarComponent,
    PositionModalComponent,
    SubportfolioModalComponent,
    ShellComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NgChartsModule,
    BrowserAnimationsModule,
    ToolbarModule,
    ButtonModule,
    PanelMenuModule,
    ProgressSpinnerModule,
    MessageModule,
    CardModule,
    InputTextModule,
    PasswordModule, 
    TableModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    DividerModule,
    ToastModule,
    
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
    MessageService
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
