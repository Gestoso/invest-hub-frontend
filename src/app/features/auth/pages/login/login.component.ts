import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'] // si no tienes scss, cambia a .css o elimina esta línea
})
export class LoginComponent {
  loading = false;
  error = '';

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router, private msg: MessageService) {}

  submit(): void {
    this.error = '';
    if (this.form.invalid) return;

    this.loading = true;
    this.auth.login(this.form.getRawValue() as any).subscribe({
      next: () => {
        this.loading = false;
        this.msg.add({
          severity: 'success',
          summary: 'Bienvenido',
          detail: 'Sesión iniciada',
          life: 1500
        });
        this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        this.loading = false;
        const message = err?.error?.message || 'Error al iniciar sesión';
        this.msg.add({
          severity: 'error',
          summary: 'Login',
          detail: message,
          life: 3500
        });
      }
    });
  }
}
