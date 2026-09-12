import FormularioMovimiento from '../components/FormularioMovimiento';
import { useDatos } from '../context/DatosContext';
import { formatearImporte } from '../utils/formatearImporte';

const formatFechaSolo = (valor) => {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

function GastoRapido() {
  const { cuentas, categorias, movimientos, recargarDatos } = useDatos();
  const movimientosOrdenados = [...movimientos].sort(
    (a, b) => new Date(b.fecha) - new Date(a.fecha)
  );

  const nombreCuenta = (cuentaId) =>
    cuentas.find((cuenta) => cuenta.id === cuentaId)?.nombre || 'Cuenta eliminada';

  const nombreCategoria = (categoriaId) =>
    categorias.find((categoria) => categoria.id === categoriaId)?.nombre;

  return (
    <div className="panel panel--movimientos">
      <FormularioMovimiento
        cuentas={cuentas}
        categorias={categorias}
        onMovimientoCreado={recargarDatos}
      />

      <h3 className="audit-titulo">Historial</h3>

      {movimientosOrdenados.length === 0 ? (
        <p className="audit-vacio">Aún no hay movimientos registrados.</p>
      ) : (
        <table className="audit-trail">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cuenta</th>
              <th>Detalle</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            {movimientosOrdenados.map((movimiento) => (
              <tr key={movimiento.id}>
                <td>{formatFechaSolo(movimiento.fecha)}</td>
                <td>{nombreCuenta(movimiento.cuenta_id)}</td>
                <td>{nombreCategoria(movimiento.categoria_id) || movimiento.nota || '—'}</td>
                <td className={movimiento.cantidad < 0 ? 'audit-negativo' : 'audit-positivo'}>
                  {movimiento.cantidad > 0 ? '+' : ''}{formatearImporte(movimiento.cantidad)}€
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default GastoRapido;
