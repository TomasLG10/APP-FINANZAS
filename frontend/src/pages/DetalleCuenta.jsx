import { useParams } from 'react-router-dom';
import { useDatos } from '../context/DatosContext';
import BloqueCuenta from '../components/BloqueCuenta';
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

function DetalleCuenta() {
  const { id } = useParams();
  const { cuentas, categorias, movimientos } = useDatos();

  const cuenta = cuentas.find((c) => c.id === parseInt(id));
  const categoriasDeCuenta = categorias.filter((c) => c.cuenta_id === parseInt(id));
  const movimientosDeCuenta = movimientos
    .filter((m) => m.cuenta_id === parseInt(id))
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // más recientes primero

  if (!cuenta) return <div className="panel">Cuenta no encontrada</div>;

  return (
    <div className="panel">
      <BloqueCuenta cuenta={cuenta} categoriasDeCuenta={categoriasDeCuenta} />

      <div className="historial-amplio">
        <h3 className="audit-titulo">Historial</h3>

        <table className="audit-trail">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Detalle</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            {movimientosDeCuenta.map((mov) => (
              <tr key={mov.id}>
                <td>{formatFechaSolo(mov.fecha)}</td>
                <td>{mov.nota || '—'}</td>
                <td className={mov.cantidad < 0 ? 'audit-negativo' : 'audit-positivo'}>
                  {mov.cantidad > 0 ? '+' : ''}{formatearImporte(mov.cantidad)}€
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DetalleCuenta;
