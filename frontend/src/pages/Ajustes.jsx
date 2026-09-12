import { Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import { API_BASE_URL } from '../config';
import FormularioCuenta from '../components/FormularioCuenta';
import { useDatos } from '../context/DatosContext';

function Ajustes() {
  const { cuentas, recargarDatos } = useDatos();
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [textoConfirmacion, setTextoConfirmacion] = useState('');
  const [errorBorrado, setErrorBorrado] = useState('');
  const [mensajeBackup, setMensajeBackup] = useState('');
  const [archivoSeleccionado, setArchivoSeleccionado] = useState('');
  const [archivoPendiente, setArchivoPendiente] = useState(null);
  const [mostrarConfirmacionImportacion, setMostrarConfirmacionImportacion] = useState(false);
  const inputBackupRef = useRef(null);

  const abrirConfirmacion = () => {
    setTextoConfirmacion('');
    setErrorBorrado('');
    setMostrarConfirmacion(true);
  };

  const borrarTodo = async () => {
    if (textoConfirmacion !== 'ELIMINAR') return;

    try {
      const respuesta = await fetch(`${API_BASE_URL}/datos`, { method: 'DELETE' });
      if (!respuesta.ok) throw new Error('No se pudieron borrar los datos');
      recargarDatos();
      setMostrarConfirmacion(false);
    } catch (error) {
      setErrorBorrado(error.message);
    }
  };

  const exportarBackup = async () => {
    try {
      const respuesta = await fetch(`${API_BASE_URL}/backup/export`);
      if (!respuesta.ok) throw new Error('No se pudo exportar la copia de seguridad');

      const payload = await respuesta.json();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `finanzas-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(url);
      setMensajeBackup('Copia de seguridad exportada correctamente.');
    } catch (error) {
      setMensajeBackup(error.message || 'Error al exportar la copia de seguridad.');
    }
  };

  const abrirSelectorBackup = () => {
    inputBackupRef.current?.click();
  };

  const manejarSeleccionArchivo = (event) => {
    const archivo = event.target.files?.[0];
    if (!archivo) return;

    setArchivoPendiente(archivo);
    setArchivoSeleccionado(archivo.name);
    setMostrarConfirmacionImportacion(true);
    event.target.value = '';
  };

  const confirmarImportacion = async () => {
    if (!archivoPendiente) return;

    try {
      const texto = await archivoPendiente.text();
      const payload = JSON.parse(texto);
      const respuesta = await fetch(`${API_BASE_URL}/backup/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!respuesta.ok) {
        const errorPayload = await respuesta.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'No se pudo importar la copia de seguridad');
      }

      await recargarDatos();
      setMensajeBackup('Copia de seguridad importada correctamente.');
    } catch (error) {
      setMensajeBackup(error.message || 'Error al importar la copia de seguridad.');
    } finally {
      setArchivoPendiente(null);
      setMostrarConfirmacionImportacion(false);
    }
  };

  return (
    <div className="panel">
      <FormularioCuenta onCuentaCreada={recargarDatos} />

      <h3>Cuentas existentes</h3>
      <ul className="lista-ajustes">
        {cuentas.map((c) => (
          <li key={c.id}>
            <Link to={`/ajustes/cuentas/${c.id}`}>{c.nombre}</Link>
          </li>
        ))}
      </ul>

      <section className="zona-peligro">
        <h3>Borrar datos</h3>
        <p>Elimina permanentemente todas las cuentas, movimientos, categorías y tramos.</p>
        <button type="button" className="boton-peligro" onClick={abrirConfirmacion}>
          Borrar todo
        </button>
        {errorBorrado && <p className="mensaje-error">{errorBorrado}</p>}
      </section>

      <section className="zona-backup">
        <h3>Copias de seguridad</h3>
        <div className="backup-actions">
          <button type="button" className="boton-backup boton-backup--primario" onClick={exportarBackup}>
            Exportar copia
          </button>

          <div className="backup-selector">
            <button type="button" className="boton-backup boton-backup--secundario" onClick={abrirSelectorBackup}>
              Importar copia
            </button>
            <input
              ref={inputBackupRef}
              type="file"
              accept=".json,application/json"
              className="input-archivo-oculto"
              onChange={manejarSeleccionArchivo}
            />
            {archivoSeleccionado && (
              <span className="backup-archivo-seleccionado">{archivoSeleccionado}</span>
            )}
          </div>
        </div>
        {mensajeBackup && <p className="mensaje-backup">{mensajeBackup}</p>}
      </section>

      {mostrarConfirmacion && (
        <div className="modal-fondo" role="presentation">
          <section className="modal-confirmacion" role="dialog" aria-modal="true" aria-labelledby="modal-borrar-titulo">
            <h2 id="modal-borrar-titulo">¿Borrar todos los datos?</h2>
            <p>Esta acción eliminará cuentas, movimientos, categorías y tramos de forma permanente.</p>
            <label htmlFor="confirmacion-borrado">
              Escribe <strong>ELIMINAR</strong> para confirmar
            </label>
            <input
              id="confirmacion-borrado"
              type="text"
              value={textoConfirmacion}
              onChange={(event) => setTextoConfirmacion(event.target.value)}
              autoFocus
            />
            {errorBorrado && <p className="mensaje-error">{errorBorrado}</p>}
            <div className="modal-acciones">
              <button type="button" className="boton-secundario" onClick={() => setMostrarConfirmacion(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="boton-peligro"
                onClick={borrarTodo}
                disabled={textoConfirmacion !== 'ELIMINAR'}
              >
                Borrar todo
              </button>
            </div>
          </section>
        </div>
      )}

      {mostrarConfirmacionImportacion && archivoPendiente && (
        <div className="modal-fondo" role="presentation">
          <section className="modal-confirmacion modal-confirmacion--backup" role="dialog" aria-modal="true" aria-labelledby="modal-importar-titulo">
            <h2 id="modal-importar-titulo">Importar copia de seguridad</h2>
            <p>Va a restaurar los datos desde este archivo:</p>
            <div className="backup-archivo-modal">{archivoSeleccionado}</div>
            <p className="modal-backup-aviso">Esta acción reemplazará los datos actuales de la aplicación.</p>
            <div className="modal-acciones">
              <button type="button" className="boton-secundario" onClick={() => setMostrarConfirmacionImportacion(false)}>
                Cancelar
              </button>
              <button type="button" className="boton-backup boton-backup--primario" onClick={confirmarImportacion}>
                Confirmar importación
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Ajustes;
