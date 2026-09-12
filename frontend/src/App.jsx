import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import { DatosProvider } from './context/DatosContext';
import { API_BASE_URL } from './config';
import MenuLateral from './components/MenuLateral';
import BarraSuperior from './components/BarraSuperior';
import Inicio from './pages/Inicio';
import Ajustes from './pages/Ajustes';
import DetalleCuenta from './pages/DetalleCuenta';
import GastoRapido from './pages/GastoRapido';
import AjustesCuenta from './pages/AjustesCuenta';
import AuthScreen from './components/AuthScreen';

const STORAGE_KEY = 'finanzas-auth-token';

function App() {
  const [menuOculto, setMenuOculto] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [usuario, setUsuario] = useState(null);
  const [cargandoAuth, setCargandoAuth] = useState(Boolean(localStorage.getItem(STORAGE_KEY)));

  useEffect(() => {
    if (!token) {
      setUsuario(null);
      setCargandoAuth(false);
      return;
    }

    setCargandoAuth(true);

    fetch(`${API_BASE_URL}/usuarios/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Sesión inválida');
        }
        return response.json();
      })
      .then((usuarioActual) => {
        setUsuario(usuarioActual);
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        setToken('');
        setUsuario(null);
      })
      .finally(() => {
        setCargandoAuth(false);
      });
  }, [token]);

  const guardarToken = (nuevoToken) => {
    localStorage.setItem(STORAGE_KEY, nuevoToken);
    setToken(nuevoToken);
  };

  const login = async ({ email, password }) => {
    const response = await fetch(`${API_BASE_URL}/usuarios/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'No se pudo iniciar sesión');
    }

    guardarToken(data.token);
    setUsuario({ id: data.id, nombre: data.nombre, email: data.email });
  };

  const registro = async ({ nombre, email, password }) => {
    const response = await fetch(`${API_BASE_URL}/usuarios/registro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'No se pudo crear la cuenta');
    }

    guardarToken(data.token);
    setUsuario({ id: data.id, nombre: data.nombre, email: data.email });
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken('');
    setUsuario(null);
  };

  if (!token || !usuario) {
    return (
      <AuthScreen
        onLogin={login}
        onRegister={registro}
        cargando={cargandoAuth}
      />
    );
  }

  return (
    <DatosProvider token={token}>
      <div className="layout">
        {!menuOculto && <MenuLateral usuario={usuario} onLogout={logout} />}

        <main className={`contenido ${menuOculto ? 'contenido--sin-menu' : ''}`}>
          <div className="contenido-header">
            <button
              type="button"
              className="boton-menu-toggle"
              onClick={() => setMenuOculto((valor) => !valor)}
              aria-label={menuOculto ? 'Mostrar menú' : 'Ocultar menú'}
            >
              {menuOculto ? '☰' : '✕'}
            </button>
            <BarraSuperior usuario={usuario} onLogout={logout} />
          </div>

          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/gasto" element={<GastoRapido />} />
            <Route path="/cuentas/:id" element={<DetalleCuenta />} />
            <Route path="/ajustes" element={<Ajustes />} />
            <Route path="/ajustes/cuentas/:id" element={<AjustesCuenta />} />
          </Routes>
        </main>
      </div>
    </DatosProvider>
  );
}

export default App;