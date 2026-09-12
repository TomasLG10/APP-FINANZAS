import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { useDatos } from '../context/DatosContext';

function AjustesCuenta() {
  const { id } = useParams();
  const { cuentas, categorias, tramos, reglasAutomaticas, recargarDatos } = useDatos();
  const cuentaId = parseInt(id);
  const cuenta = cuentas.find((c) => c.id === cuentaId);
  const categoriasDeCuenta = categorias.filter((c) => c.cuenta_id === cuentaId);
  const tramosDeCuenta = tramos
    .filter((t) => t.cuenta_id === cuentaId)
    .sort((a, b) => a.orden - b.orden);
  const reglasDeCuenta = reglasAutomaticas.filter((regla) => regla.cuenta_id === cuentaId);

  const [form, setForm] = useState({ nombre: '', meta: '', saldo_maximo: '', saldo_minimo: '' });
  const [nuevaCategoria, setNuevaCategoria] = useState({ nombre: '', presupuesto_mensual: '' });
  const [nuevoTramo, setNuevoTramo] = useState({ limite_superior: '', cuota_mensual: '' });
  const [nuevaRegla, setNuevaRegla] = useState({
    nombre: '',
    tipo: 'movimiento',
    dia: '1',
    cantidad: '',
    saldo_objetivo: '',
    descripcion: '',
    requiere_validacion: false,
  });

  useEffect(() => {
    if (cuenta) {
      setForm({
        nombre: cuenta.nombre || '',
        meta: cuenta.meta ?? '',
        saldo_maximo: cuenta.saldo_maximo ?? '',
        saldo_minimo: cuenta.saldo_minimo ?? '',
      });
    }
  }, [cuenta]);

  const guardarCambios = (e) => {
    e.preventDefault();
    fetch(`${API_BASE_URL}/cuentas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: form.nombre,
        meta: form.meta === '' ? null : parseFloat(form.meta),
        saldo_maximo: form.saldo_maximo === '' ? null : parseFloat(form.saldo_maximo),
        saldo_minimo: form.saldo_minimo === '' ? null : parseFloat(form.saldo_minimo),
      }),
    })
      .then((res) => res.json())
      .then(() => recargarDatos())
      .catch((err) => console.error('Error al guardar cambios:', err));
  };

  const crearCategoria = (e) => {
    e.preventDefault();
    if (!nuevaCategoria.nombre || !nuevaCategoria.presupuesto_mensual) return;

    fetch(`${API_BASE_URL}/categorias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cuenta_id: parseInt(id),
        nombre: nuevaCategoria.nombre,
        presupuesto_mensual: parseFloat(nuevaCategoria.presupuesto_mensual),
      }),
    })
      .then((res) => res.json())
      .then(() => {
        setNuevaCategoria({ nombre: '', presupuesto_mensual: '' });
        recargarDatos();
      })
      .catch((err) => console.error('Error al crear categoría:', err));
  };

  const crearTramo = (e) => {
    e.preventDefault();
    if (!nuevoTramo.limite_superior || !nuevoTramo.cuota_mensual) return;

    // El siguiente orden es "uno más que el último tramo que ya existe"
    const siguienteOrden = tramosDeCuenta.length > 0
        ? Math.max(...tramosDeCuenta.map((t) => t.orden)) + 1
        : 1;

    fetch(`${API_BASE_URL}/tramos_retorno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        cuenta_id: parseInt(id),
        orden: siguienteOrden,
        limite_superior: parseFloat(nuevoTramo.limite_superior),
        cuota_mensual: parseFloat(nuevoTramo.cuota_mensual),
        }),
    })
        .then((res) => res.json())
        .then(() => {
        setNuevoTramo({ limite_superior: '', cuota_mensual: '' });
        recargarDatos();
        })
        .catch((err) => console.error('Error al crear tramo:', err));
    };

    const actualizarTramo = (tramoId, campo, valor) => {
    fetch(`${API_BASE_URL}/tramos_retorno/${tramoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [campo]: parseFloat(valor) }),
    })
        .then((res) => res.json())
        .then(() => recargarDatos())
        .catch((err) => console.error('Error al actualizar tramo:', err));
    };

    const borrarTramo = (tramoId) => {
    fetch(`${API_BASE_URL}/tramos_retorno/${tramoId}`, { method: 'DELETE' })
        .then(() => recargarDatos())
        .catch((err) => console.error('Error al borrar tramo:', err));
    };

  const actualizarPresupuesto = (catId, valor) => {
    fetch(`${API_BASE_URL}/categorias/${catId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presupuesto_mensual: parseFloat(valor) }),
    })
      .then((res) => res.json())
      .then(() => recargarDatos())
      .catch((err) => console.error('Error al actualizar categoría:', err));
  };

  const borrarCategoria = (catId) => {
    fetch(`${API_BASE_URL}/categorias/${catId}`, { method: 'DELETE' })
      .then(() => recargarDatos())
      .catch((err) => console.error('Error al borrar categoría:', err));
  };

  const crearRegla = (e) => {
    e.preventDefault();

    if (!nuevaRegla.tipo || !nuevaRegla.dia) return;

    const body = {
      cuenta_id: cuentaId,
      nombre: nuevaRegla.nombre,
      tipo: nuevaRegla.tipo,
      dia: parseInt(nuevaRegla.dia, 10),
      descripcion: nuevaRegla.descripcion,
      activo: true,
      requiere_validacion: nuevaRegla.requiere_validacion,
    };

    if (nuevaRegla.tipo === 'movimiento') {
      if (nuevaRegla.cantidad === '') return;
      body.cantidad = parseFloat(nuevaRegla.cantidad);
    } else {
      if (nuevaRegla.saldo_objetivo === '') return;
      body.saldo_objetivo = parseFloat(nuevaRegla.saldo_objetivo);
    }

    fetch(`${API_BASE_URL}/reglas_automaticas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .then(() => {
        setNuevaRegla({
          nombre: '',
          tipo: 'movimiento',
          dia: '1',
          cantidad: '',
          saldo_objetivo: '',
          descripcion: '',
          requiere_validacion: false,
        });
        recargarDatos();
      })
      .catch((err) => console.error('Error al crear la regla automática:', err));
  };

  const borrarRegla = (reglaId) => {
    fetch(`${API_BASE_URL}/reglas_automaticas/${reglaId}`, { method: 'DELETE' })
      .then(() => recargarDatos())
      .catch((err) => console.error('Error al borrar la regla automática:', err));
  };

  const validarRegla = (reglaId) => {
    fetch(`${API_BASE_URL}/reglas_automaticas/${reglaId}/validar`, { method: 'POST' })
      .then((res) => res.json())
      .then(() => recargarDatos())
      .catch((err) => console.error('Error al validar la regla automática:', err));
  };

  if (!cuenta) return <div className="panel">Cuenta no encontrada</div>;

  return (
    <div className="panel panel--ajustes">
      <section className="ajuste-seccion">
        <form className="form-cuenta ajuste-form" onSubmit={guardarCambios}>
          <h3>Datos generales</h3>

          <input
            type="text"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />

          <input
            type="number"
            step="0.01"
            placeholder="Meta (vacío = sin meta)"
            value={form.meta}
            onChange={(e) => setForm({ ...form, meta: e.target.value })}
          />

          <input
            type="number"
            step="0.01"
            placeholder="Saldo máximo (vacío = sin límite)"
            value={form.saldo_maximo}
            onChange={(e) => setForm({ ...form, saldo_maximo: e.target.value })}
          />

          <input
            type="number"
            step="0.01"
            placeholder="Saldo mínimo (vacío = sin alerta)"
            value={form.saldo_minimo}
            onChange={(e) => setForm({ ...form, saldo_minimo: e.target.value })}
          />

          <button type="submit">Guardar cambios</button>
        </form>
      </section>

      <section className="ajuste-seccion">
        <h3>Categorías de gasto</h3>

        <ul className="ajuste-lista">
          {categoriasDeCuenta.map((cat) => (
            <li key={cat.id} className="ajuste-item ajuste-item--categoria">
              <span className="ajuste-item__titulo">{cat.nombre}</span>
              <div className="ajuste-item__campo">
                <input
                  type="number"
                  step="0.01"
                  defaultValue={cat.presupuesto_mensual}
                  onBlur={(e) => actualizarPresupuesto(cat.id, e.target.value)}
                />
              </div>
              <button className="boton-borrar" type="button" onClick={() => borrarCategoria(cat.id)}>Borrar</button>
            </li>
          ))}
        </ul>

        <form className="form-cuenta ajuste-form" onSubmit={crearCategoria}>
          <input
            type="text"
            placeholder="Nombre de la categoría"
            value={nuevaCategoria.nombre}
            onChange={(e) => setNuevaCategoria({ ...nuevaCategoria, nombre: e.target.value })}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Presupuesto mensual"
            value={nuevaCategoria.presupuesto_mensual}
            onChange={(e) => setNuevaCategoria({ ...nuevaCategoria, presupuesto_mensual: e.target.value })}
          />
          <button type="submit">Añadir categoría</button>
        </form>
      </section>

      <section className="ajuste-seccion">
        <h3>Tramos de retorno</h3>

        <ul className="ajuste-lista">
          {tramosDeCuenta.map((tramo) => (
            <li key={tramo.id} className="ajuste-item ajuste-item--tramo">
              <span className="ajuste-item__etiqueta">Hasta</span>
              <div className="ajuste-item__campo">
                <input
                  type="number"
                  step="0.01"
                  defaultValue={tramo.limite_superior}
                  onBlur={(e) => actualizarTramo(tramo.id, 'limite_superior', e.target.value)}
                />
              </div>
              <span className="ajuste-item__etiqueta">Cuota</span>
              <div className="ajuste-item__campo">
                <input
                  type="number"
                  step="0.01"
                  defaultValue={tramo.cuota_mensual}
                  onBlur={(e) => actualizarTramo(tramo.id, 'cuota_mensual', e.target.value)}
                />
              </div>
              <button className="boton-borrar" type="button" onClick={() => borrarTramo(tramo.id)}>Borrar</button>
            </li>
          ))}
        </ul>

        <form className="form-cuenta ajuste-form" onSubmit={crearTramo}>
          <input
            type="number"
            step="0.01"
            placeholder="Hasta (límite superior)"
            value={nuevoTramo.limite_superior}
            onChange={(e) => setNuevoTramo({ ...nuevoTramo, limite_superior: e.target.value })}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Cuota mensual"
            value={nuevoTramo.cuota_mensual}
            onChange={(e) => setNuevoTramo({ ...nuevoTramo, cuota_mensual: e.target.value })}
          />
          <button type="submit">Añadir tramo</button>
        </form>
      </section>

      <section className="ajuste-seccion">
        <h3>Movimientos automáticos</h3>

        <ul className="ajuste-lista">
          {reglasDeCuenta.length === 0 ? (
            <li className="texto-vacio">Sin reglas automáticas definidas.</li>
          ) : (
            reglasDeCuenta.map((regla) => (
              <li key={regla.id} className="ajuste-item ajuste-item--regla">
                <div className="item-regla__resumen">
                  <strong>{regla.nombre || 'Regla automática'}</strong>
                  <span>
                    Día {regla.dia} · {regla.tipo === 'movimiento' ? 'Movimiento' : 'Saldo objetivo'}
                  </span>
                  <span>
                    {regla.tipo === 'movimiento'
                      ? `Importe: ${regla.cantidad ?? '—'}€`
                      : `Saldo objetivo: ${regla.saldo_objetivo ?? '—'}€`}
                  </span>
                  <span>
                    {regla.requiere_validacion ? 'Validación manual' : 'Automático'}
                    {regla.estado === 'pendiente' ? ' · Pendiente de validación' : ''}
                  </span>
                  {regla.descripcion && <small>{regla.descripcion}</small>}
                </div>
                {regla.estado === 'pendiente' ? (
                  <button className="boton-accion" type="button" onClick={() => validarRegla(regla.id)}>Validar</button>
                ) : (
                  <button className="boton-borrar" type="button" onClick={() => borrarRegla(regla.id)}>Borrar</button>
                )}
              </li>
            ))
          )}
        </ul>

        <form className="form-cuenta ajuste-form form-regla" onSubmit={crearRegla}>
          <input
            type="text"
            placeholder="Nombre (opcional)"
            value={nuevaRegla.nombre}
            onChange={(e) => setNuevaRegla({ ...nuevaRegla, nombre: e.target.value })}
          />

          <select
            value={nuevaRegla.tipo}
            onChange={(e) => setNuevaRegla({ ...nuevaRegla, tipo: e.target.value })}
          >
            <option value="movimiento">Movimiento automático</option>
            <option value="saldo">Poner saldo a X</option>
          </select>

          <input
            type="number"
            min="1"
            placeholder="Día del mes (1-31)"
            value={nuevaRegla.dia}
            onChange={(e) => setNuevaRegla({ ...nuevaRegla, dia: e.target.value })}
          />

          {nuevaRegla.tipo === 'movimiento' ? (
            <input
              type="number"
              step="0.01"
              placeholder="Importe del movimiento"
              value={nuevaRegla.cantidad}
              onChange={(e) => setNuevaRegla({ ...nuevaRegla, cantidad: e.target.value })}
            />
          ) : (
            <input
              type="number"
              step="0.01"
              placeholder="Saldo objetivo"
              value={nuevaRegla.saldo_objetivo}
              onChange={(e) => setNuevaRegla({ ...nuevaRegla, saldo_objetivo: e.target.value })}
            />
          )}

          <input
            type="text"
            placeholder="Descripción (opcional)"
            value={nuevaRegla.descripcion}
            onChange={(e) => setNuevaRegla({ ...nuevaRegla, descripcion: e.target.value })}
          />

          <label className="form-checkbox">
            <input
              type="checkbox"
              checked={nuevaRegla.requiere_validacion}
              onChange={(e) => setNuevaRegla({ ...nuevaRegla, requiere_validacion: e.target.checked })}
            />
            Semi-automático: esperar a mi validación
          </label>

          <button type="submit">Añadir regla automática</button>
        </form>
      </section>
    </div>
  );
}

export default AjustesCuenta;