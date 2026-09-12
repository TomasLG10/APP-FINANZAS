import { useDatos } from '../context/DatosContext';
import { API_BASE_URL } from '../config';
import { formatearImporte } from '../utils/formatearImporte';

function BarraProgreso({ progreso, exceso = false }) {
  const progresoVisible = Math.max(0, Math.min(Number(progreso) || 0, 100));

  return (
    <div className="progreso-fila">
      <div className="progreso-pista">
        <div
          className={`progreso-relleno ${exceso ? 'progreso-relleno--exceso' : ''}`}
          style={{ width: `${progresoVisible}%` }}
        />
      </div>
      <span className="progreso-porcentaje">{progreso}%</span>
    </div>
  );
}

function BloqueCuenta({ cuenta, categoriasDeCuenta }) {
  const { tramos, reglasAutomaticas, recargarDatos } = useDatos();
  const tramosDeCuenta = tramos.filter((tramo) => tramo.cuenta_id === cuenta.id);
  const reglasCuenta = (reglasAutomaticas || []).filter((regla) => regla.cuenta_id === cuenta.id && regla.activo !== 0);
  const diasProgramados = [...new Set(reglasCuenta.map((regla) => regla.dia))].sort((a, b) => a - b);
  const pendientesDeValidacion = reglasCuenta.filter((regla) => regla.estado === 'pendiente').length;
  const objetivo = cuenta.meta || cuenta.saldo_maximo;
  const progreso = objetivo
    ? Math.round((cuenta.saldo / objetivo) * 100)
    : null;
  const tieneTramosDeRetorno = tramosDeCuenta.length > 0;
  const tieneInformacion = (tieneTramosDeRetorno && cuenta.cuota_actual != null) || cuenta.alerta || reglasCuenta.length > 0;

  const validarRegla = async (reglaId) => {
    try {
      const respuesta = await fetch(`${API_BASE_URL}/reglas_automaticas/${reglaId}/validar`, {
        method: 'POST',
      });

      if (!respuesta.ok) {
        throw new Error('No se pudo validar la regla automática');
      }

      await recargarDatos();
    } catch (error) {
      console.error('Error al validar la regla automática:', error);
    }
  };

  return (
    <section className="cuenta">
      <div className="cuenta-encabezado">
        <h2 className="cuenta-nombre">{cuenta.nombre}</h2>
        <p className="cuenta-saldo">{formatearImporte(cuenta.saldo)}€</p>
      </div>

      {progreso !== null && (
        <div className="cuenta-seccion">
          <BarraProgreso progreso={progreso} />
        </div>
      )}

      {categoriasDeCuenta.length > 0 && (
        <div className="cuenta-seccion cuenta-seccion--gastos">
          {categoriasDeCuenta.map((categoria) => (
            <div className="categoria" key={categoria.id}>
              <div className="categoria-cabecera">
                <span>{categoria.nombre}</span>
                <span>{formatearImporte(categoria.gastadoPositivo)}€ / {formatearImporte(categoria.presupuesto_mensual)}€</span>
              </div>
              <BarraProgreso
                progreso={categoria.progreso}
                exceso={categoria.progreso > 100}
              />
            </div>
          ))}
        </div>
      )}

      {tieneInformacion && (
        <div className="cuenta-seccion cuenta-seccion--info">
          {tieneTramosDeRetorno && cuenta.cuota_actual != null && (
            <p className="cuenta-detalle">Cuota este mes: {formatearImporte(cuenta.cuota_actual)}€</p>
          )}

          {reglasCuenta.length > 0 && (
            <div className="cuenta-reglas">
              {reglasCuenta.map((regla) => {
                const esPendiente = regla.estado === 'pendiente';
                const descripcion = regla.tipo === 'movimiento'
                  ? `Importe: ${formatearImporte(regla.cantidad)}€`
                  : `Saldo objetivo: ${formatearImporte(regla.saldo_objetivo)}€`;

                return (
                  <div
                    key={regla.id}
                    className={`cuenta-regla ${esPendiente ? 'cuenta-regla--pendiente' : ''}`}
                  >
                    <div className="cuenta-regla__info">
                      <span className="cuenta-regla__dia">Día {regla.dia}</span>
                      <strong>{regla.nombre || (regla.tipo === 'movimiento' ? 'Transferencia automática' : 'Ajuste de saldo')}</strong>
                      <span>{descripcion}</span>
                      {esPendiente && <small>Pendiente de validación</small>}
                    </div>

                    {esPendiente && (
                      <button
                        type="button"
                        className="boton-accion cuenta-regla__boton"
                        onClick={() => validarRegla(regla.id)}
                      >
                        Validar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {cuenta.alerta && <p className="cuenta-alerta">{cuenta.alerta}</p>}
        </div>
      )}
    </section>
  );
}

export default BloqueCuenta;
