import { useState } from 'react';
import { API_BASE_URL } from '../config';

function FormularioCuenta({ onCuentaCreada }) {
  const [form, setForm] = useState({
    nombre: '',
    meta: '',
    saldo_maximo: '',
    saldo_minimo: '',
  });

  const crearCuenta = (e) => {
    e.preventDefault();
    if (!form.nombre) return;

    fetch(`${API_BASE_URL}/cuentas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: form.nombre,
        meta: form.meta ? parseFloat(form.meta) : null,
        saldo_maximo: form.saldo_maximo ? parseFloat(form.saldo_maximo) : null,
        saldo_minimo: form.saldo_minimo ? parseFloat(form.saldo_minimo) : null,
      }),
    })
      .then((res) => res.json())
      .then(() => {
        setForm({ nombre: '', meta: '', saldo_maximo: '', saldo_minimo: '' });
        onCuentaCreada();
      })
      .catch((err) => console.error('Error al crear la cuenta:', err));
  };

  return (
    <form className="form-cuenta" onSubmit={crearCuenta}>
      <h3>Nueva cuenta</h3>

      <input
        type="text"
        placeholder="Nombre"
        value={form.nombre}
        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
      />

      <input
        type="number"
        step="0.01"
        placeholder="Meta (opcional)"
        value={form.meta}
        onChange={(e) => setForm({ ...form, meta: e.target.value })}
      />

      <input
        type="number"
        step="0.01"
        placeholder="Saldo máximo (opcional)"
        value={form.saldo_maximo}
        onChange={(e) => setForm({ ...form, saldo_maximo: e.target.value })}
      />

      <input
        type="number"
        step="0.01"
        placeholder="Saldo mínimo (opcional)"
        value={form.saldo_minimo}
        onChange={(e) => setForm({ ...form, saldo_minimo: e.target.value })}
      />

      <button type="submit">Crear cuenta</button>
    </form>
  );
}

export default FormularioCuenta;