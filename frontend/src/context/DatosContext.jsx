import { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const DatosContext = createContext();

export function DatosProvider({ children, token }) {
  const [cuentas, setCuentas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [tramos, setTramos] = useState([]);
  const [reglasAutomaticas, setReglasAutomaticas] = useState([]);

  const obtenerCabeceras = () => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const recargarDatos = async () => {
    try {
      const [cuentasRes, categoriasRes, movimientosRes, tramosRes, reglasRes] = await Promise.all([
        fetch(`${API_BASE_URL}/cuentas`, { headers: obtenerCabeceras() }),
        fetch(`${API_BASE_URL}/categorias`, { headers: obtenerCabeceras() }),
        fetch(`${API_BASE_URL}/movimientos`, { headers: obtenerCabeceras() }),
        fetch(`${API_BASE_URL}/tramos_retorno`, { headers: obtenerCabeceras() }),
        fetch(`${API_BASE_URL}/reglas_automaticas`, { headers: obtenerCabeceras() }),
      ]);

      const [cuentasData, categoriasData, movimientosData, tramosData, reglasData] = await Promise.all([
        cuentasRes.json(),
        categoriasRes.json(),
        movimientosRes.json(),
        tramosRes.json(),
        reglasRes.json(),
      ]);

      setCuentas(cuentasData || []);
      setCategorias(categoriasData || []);
      setMovimientos(movimientosData || []);
      setTramos(tramosData || []);
      setReglasAutomaticas(reglasData || []);
    } catch (error) {
      console.error('Error al recargar datos:', error);
      setCuentas([]);
      setCategorias([]);
      setMovimientos([]);
      setTramos([]);
      setReglasAutomaticas([]);
    }
  };

  const sincronizarDatos = async () => {
    if (!token) return;

    const payload = {
      cuentas,
      categorias,
      movimientos,
      tramos_retorno: tramos,
      reglas_automaticas: reglasAutomaticas,
    };

    const respuesta = await fetch(`${API_BASE_URL}/sincronizar`, {
      method: 'POST',
      headers: obtenerCabeceras(),
      body: JSON.stringify(payload),
    });

    if (!respuesta.ok) {
      const errorPayload = await respuesta.json().catch(() => ({}));
      throw new Error(errorPayload.error || 'Error al sincronizar');
    }

    const data = await respuesta.json();
    return data;
  };

  useEffect(() => {
    if (token) {
      recargarDatos();
    }
  }, [token]);

  return (
    <DatosContext.Provider value={{ cuentas, categorias, movimientos, tramos, reglasAutomaticas, recargarDatos, sincronizarDatos }}>
      {children}
    </DatosContext.Provider>
  );
}

export function useDatos() {
  return useContext(DatosContext);
}