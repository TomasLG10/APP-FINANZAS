import BloqueCuenta from '../components/BloqueCuenta';
import { useDatos } from '../context/DatosContext';

function Inicio() {
  const { cuentas, categorias } = useDatos();

  return (
    <div className="panel panel--inicio">

      {cuentas.map((cuenta) => {
        const categoriasDeCuenta = categorias.filter((c) => c.cuenta_id === cuenta.id);

        return (
          <BloqueCuenta
            key={cuenta.id}
            cuenta={cuenta}
            categoriasDeCuenta={categoriasDeCuenta}
          />
        );
      })}
    </div>
  );
}

export default Inicio;
