import { useState } from 'react';
import { API_BASE_URL } from '../config';

const formatearFechaHoraLocal = (date = new Date()) => {
  const pad = (valor) => String(valor).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function FormularioMovimiento({ cuentas, categorias, onMovimientoCreado }) {
  
  const [form, setForm] = useState({
    cuenta_id: '',
    esGasto: true,
    categoria_id: '',
    cantidad: '',
    fecha: formatearFechaHoraLocal(),
    nota: '',
    esTransferencia: false,
    cuenta_relacionada_id: '',
  });

  const categoriasDeCuentaSeleccionada = categorias.filter(
    (c) => c.cuenta_id === parseInt(form.cuenta_id)
  );

  const categoriaDeshabilitada = !form.esGasto || categoriasDeCuentaSeleccionada.length === 0;

  const registrarMovimiento = (e) => {
    e.preventDefault();
    const importe = Number(form.cantidad.replace(',', '.'));
    if (!form.cuenta_id || !form.cantidad || !Number.isFinite(importe)) return;

    const cantidadFinal = form.esGasto
      ? -Math.abs(importe)
      : Math.abs(importe);

    const movimientoPrincipal = {
      fecha: form.fecha,
      cantidad: cantidadFinal,
      cuenta_id: parseInt(form.cuenta_id),
      categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
      nota: form.nota || null,
    };

    fetch(`${API_BASE_URL}/movimientos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(movimientoPrincipal),
    })
      .then((res) => res.json())
      .then(() => {
        // Si es transferencia, creamos el movimiento espejo en la otra cuenta
        if (form.esTransferencia && form.cuenta_relacionada_id) {
          const movimientoEspejo = {
            ...movimientoPrincipal,
            cantidad: -cantidadFinal, // signo contrario
            cuenta_id: parseInt(form.cuenta_relacionada_id),
            categoria_id: null, // el espejo nunca lleva categoría
          };

          return fetch(`${API_BASE_URL}/movimientos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(movimientoEspejo),
          });
        }
      })
      .then(() => {
        setForm({ ...form, categoria_id: '', cantidad: '', nota: '', esTransferencia: false, cuenta_relacionada_id: '' });
        onMovimientoCreado();
      })
      .catch((err) => console.error('Error al registrar movimiento:', err));
  };

  return (
    <form className="form-movimiento" onSubmit={registrarMovimiento}>

      {/* 1. Dónde */}
      <select
        value={form.cuenta_id}
        onChange={(e) => setForm({ ...form, cuenta_id: e.target.value, categoria_id: '' })}
      >
        <option value="">Cuenta</option>
        {cuentas.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>

      {/* 2. Tipo */}
      <select
        value={form.esGasto ? 'gasto' : 'ingreso'}
        onChange={(e) => setForm({
          ...form,
          esGasto: e.target.value === 'gasto',
          categoria_id: ''
        })}
      >
        <option value="gasto">Gasto</option>
        <option value="ingreso">Ingreso</option>
      </select>

      {/* 3. Categoría */}
      <select
        value={form.categoria_id}
        onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
        disabled={categoriaDeshabilitada}
      >
        <option value="">{form.esGasto ? 'Categoría' : 'Categoría (no aplica)'}</option>
        {categoriasDeCuentaSeleccionada.map((cat) => (
          <option key={cat.id} value={cat.id}>{cat.nombre}</option>
        ))}
      </select>

      {/* 4. Importe */}
      <input
        type="text"
        inputMode="decimal"
        placeholder="Importe (0,00)"
        value={form.cantidad}
        onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
      />

      {/* 5. Fecha y hora */}
      <input
        type="datetime-local"
        value={form.fecha}
        onChange={(e) => setForm({ ...form, fecha: e.target.value })}
      />

      {/* 6. Nota */}
      <input
        type="text"
        placeholder="Nota (opcional)"
        value={form.nota}
        onChange={(e) => setForm({ ...form, nota: e.target.value })}
      />

      {/* 7. Transferencia */}
      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={form.esTransferencia}
          onChange={(e) => setForm({
            ...form,
            esTransferencia: e.target.checked
          })}
        />
        Viene de / va a otra cuenta
      </label>

      <select
        value={form.cuenta_relacionada_id}
        onChange={(e) => setForm({
          ...form,
          cuenta_relacionada_id: e.target.value
        })}
        disabled={!form.esTransferencia}
      >
        <option value="">{form.esTransferencia ? 'Otra cuenta' : 'Otra cuenta (no aplica)'}</option>
        {cuentas
          .filter((c) => c.id !== parseInt(form.cuenta_id))
          .map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
      </select>

      <button type="submit">Añadir</button>

    </form>
  );
}

export default FormularioMovimiento;
