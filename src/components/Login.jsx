import { useState } from 'react';

import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { authError, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError('');
    setIsSubmitting(true);

    try {
      await signIn({ email, password });
    } catch (error) {
      setLocalError(error.message || 'No fue posible iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="login-panel">
        <div className="login-brand">
          <img src="/ferrovias-f.png" alt="" />
          <div>
            <span>MR Control</span>
            <strong>Material Rodante</strong>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Acceso interno</p>
            <h1>Iniciar sesión</h1>
          </div>

          <label>
            Correo electronico
            <input
              autoComplete="email"
              disabled={isSubmitting}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label>
            Contraseña
            <span className="password-field">
              <input
                autoComplete="current-password"
                disabled={isSubmitting}
                onChange={(event) => setPassword(event.target.value)}
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                disabled={isSubmitting}
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? 'Ocultar' : 'Ver'}
              </button>
            </span>
          </label>

          <button className="primary-action" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
          </button>

          {(localError || authError) && (
            <div className="auth-error" role="alert">
              {localError || authError}
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
