import { useState } from 'react';

function AuthScreen({ onLogin, onRegister, cargando }) {
  const [modo, setModo] = useState('login');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const enviar = async (event) => {
    event.preventDefault();
    setError('');

    try {
      if (modo === 'login') {
        await onLogin({ email, password });
      } else {
        await onRegister({ nombre, email, password });
      }
    } catch (err) {
      setError(err.message || 'No se pudo completar la operación');
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-header">
          <p className="auth-kicker">Finanzas</p>
          <h1>{modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
        </div>

        <form className="auth-form" onSubmit={enviar}>
          {modo === 'registro' && (
            <label className="auth-field">
              <span>Nombre</span>
              <input
                type="text"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Tu nombre"
                required
              />
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@email.com"
              required
            />
          </label>

          <label className="auth-field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-button" disabled={cargando}>
            {cargando ? 'Cargando...' : modo === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <button
          type="button"
          className="auth-toggle"
          onClick={() => {
            setModo((actual) => (actual === 'login' ? 'registro' : 'login'));
            setError('');
          }}
        >
          {modo === 'login' ? '¿No tienes cuenta? Regístrate' : 'Ya tengo cuenta'}
        </button>
      </div>
    </div>
  );
}

export default AuthScreen;
