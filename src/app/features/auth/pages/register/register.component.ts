import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'] // si no tienes scss, cambia a .css o elimina esta línea
})
export class RegisterComponent {
  loading = false;
  error = '';

  form = this.fb.group({
    name: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router, private msg: MessageService) {}

  submit(): void {
    this.error = '';
    if (this.form.invalid) return;

    this.loading = true;
    this.auth.register(this.form.getRawValue() as any).subscribe({
      next: () => {
        this.loading = false;
        this.msg.add({
          severity: 'success',
          summary: 'Registro',
          detail: 'Usuario registrado correctamente',
          life: 1500
        });
        this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        this.loading = false;
        const message = err?.error?.message || 'Error al registrarse';
        this.msg.add({
          severity: 'error',
          summary: 'Login',
          detail: message,
          life: 3500
        });
        this.error = err?.error?.message || 'Error al registrarse';
      }
    });
  }
}
