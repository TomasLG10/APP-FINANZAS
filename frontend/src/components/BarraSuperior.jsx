import { useLocation, useMatch } from 'react-router-dom';
import { useDatos } from '../context/DatosContext';
import { formatearImporte } from '../utils/formatearImporte';

const titulos = {
  '/': 'Inicio',
  '/gasto': 'Movimientos',
  '/ajustes': 'Ajustes',
};

function BarraSuperior({ usuario, onLogout }) {
  const location = useLocation();
  const matchCuenta = useMatch('/cuentas/:id');
  const id = matchCuenta?.params.id;
  const { cuentas } = useDatos();

  const cuentaActual = id ? cuentas.find((c) => c.id === parseInt(id)) : null;
  const titulo = cuentaActual ? cuentaActual.nombre : (titulos[location.pathname] || '');

  const saldoTotal = cuentas.reduce((total, c) => total + c.saldo, 0);
  const numAlertas = cuentas.filter((c) => c.alerta).length;

  const fechaFormateada = new Date().toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <header className="barra-superior">
      <h1 className="barra-titulo">{titulo}</h1>

      <div className="barra-info">
        {usuario && (
          <button type="button" className="barra-logout" onClick={onLogout}>
            {usuario.nombre}
          </button>
        )}
        <span className="barra-fecha">{fechaFormateada}</span>
        <span className="barra-saldo">{formatearImporte(saldoTotal)}€</span>
        {numAlertas > 0 && (
          <span className="barra-alerta">
            {numAlertas} {numAlertas === 1 ? 'alerta' : 'alertas'}
          </span>
        )}
      </div>
    </header>
  );
}

export default BarraSuperior;
