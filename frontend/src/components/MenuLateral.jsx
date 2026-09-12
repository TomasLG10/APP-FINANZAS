import { Link } from 'react-router-dom';
import { useDatos } from '../context/DatosContext';

function MenuLateral({ usuario, onLogout }) {
  const { cuentas } = useDatos();

  return (
    <nav className="menu-lateral">
      <h1 className="menu-titulo">FINANCES</h1>

      {usuario && (
        <div className="menu-usuario">
          <span>{usuario.nombre}</span>
          <button type="button" className="menu-logout" onClick={onLogout}>Cerrar sesión</button>
        </div>
      )}

      <Link to="/" className="menu-link">Inicio</Link>
      <Link to="/gasto" className="menu-link">Movimientos</Link>
      <Link to="/ajustes" className="menu-link">Ajustes</Link>

      <span className="menu-separador">Cuentas</span>

      {cuentas.map((cuenta) => (
        <Link key={cuenta.id} to={`/cuentas/${cuenta.id}`} className="menu-link menu-link--cuenta">
          {cuenta.nombre}
        </Link>
      ))}

      <span className="menu-creditos">by Tomás López Giralt</span>
    </nav>
  );
}

export default MenuLateral;
