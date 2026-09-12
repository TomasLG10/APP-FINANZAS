// server.js
// Este es el punto de entrada de nuestro backend.

require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const db = require('./database.js'); // Traemos la conexión a la base de datos
const app = express();
const PORT = Number(process.env.PORT) || 3001;
const cors = require('cors');

const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const formatearFechaHoraLocal = (date = new Date()) => {
  const pad = (valor) => String(valor).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const hashPassword = (password) => crypto.createHash('sha256').update(password).digest('hex');
const generarToken = () => crypto.randomBytes(24).toString('hex');

const autenticarUsuario = (req, res, next) => {
  const cabecera = req.headers.authorization || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.replace('Bearer ', '').trim() : null;

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  db.get('SELECT * FROM usuarios WHERE token = ?', [token], (err, usuario) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al autenticar usuario' });
    }

    if (!usuario) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    req.user = usuario;
    next();
  });
};

// Middleware: le dice a Express que interprete el "body" de las peticiones
// como JSON. Sin esto, no podríamos leer los datos que nos manden en un POST.
app.use(express.json());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
}));

// Ruta de prueba (la que ya teníamos)
app.get('/', (req, res) => {
  res.send('Servidor backend funcionando correctamente');
});

// ---------------------------------------------
// RUTA: Registro de usuario para sincronización móvil
// POST /usuarios/registro
// ---------------------------------------------
app.post('/usuarios/registro', (req, res) => {
  const { nombre, email, password } = req.body || {};

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Faltan nombre, email o password' });
  }

  const passwordHash = hashPassword(password);
  const token = generarToken();

  db.run(
    'INSERT INTO usuarios (nombre, email, password_hash, token) VALUES (?, ?, ?, ?)',
    [nombre, email, passwordHash, token],
    function (err) {
      if (err) {
        if (String(err.message).includes('UNIQUE')) {
          return res.status(409).json({ error: 'El email ya existe' });
        }
        console.error(err.message);
        return res.status(500).json({ error: 'Error al crear el usuario' });
      }

      res.status(201).json({
        id: this.lastID,
        nombre,
        email,
        token,
      });
    }
  );
});

// ---------------------------------------------
// RUTA: Login de usuario para sincronización móvil
// POST /usuarios/login
// ---------------------------------------------
app.post('/usuarios/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan email o password' });
  }

  const passwordHash = hashPassword(password);

  db.get('SELECT * FROM usuarios WHERE email = ? AND password_hash = ?', [email, passwordHash], (err, usuario) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al iniciar sesión' });
    }

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = generarToken();
    db.run('UPDATE usuarios SET token = ? WHERE id = ?', [token, usuario.id], (updateErr) => {
      if (updateErr) {
        console.error(updateErr.message);
        return res.status(500).json({ error: 'Error al generar sesión' });
      }

      res.json({
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        token,
      });
    });
  });
});

// ---------------------------------------------
// RUTA: Devuelve el usuario autenticado
// GET /usuarios/me
// ---------------------------------------------
app.get('/usuarios/me', autenticarUsuario, (req, res) => {
  res.json({
    id: req.user.id,
    nombre: req.user.nombre,
    email: req.user.email,
  });
});

// ---------------------------------------------
// RUTA: Sincronización de la app móvil/web
// GET /sincronizar
// ---------------------------------------------
app.get('/sincronizar', autenticarUsuario, (req, res) => {
  const usuarioId = req.user.id;

  db.all('SELECT * FROM cuentas WHERE usuario_id IS NULL OR usuario_id = ?', [usuarioId], (errCuentas, cuentas) => {
    if (errCuentas) {
      console.error(errCuentas.message);
      return res.status(500).json({ error: 'Error al obtener cuentas' });
    }

    db.all('SELECT * FROM categorias WHERE usuario_id IS NULL OR usuario_id = ?', [usuarioId], (errCategorias, categorias) => {
      if (errCategorias) {
        console.error(errCategorias.message);
        return res.status(500).json({ error: 'Error al obtener categorías' });
      }

      db.all('SELECT * FROM movimientos WHERE usuario_id IS NULL OR usuario_id = ?', [usuarioId], (errMovs, movimientos) => {
        if (errMovs) {
          console.error(errMovs.message);
          return res.status(500).json({ error: 'Error al obtener movimientos' });
        }

        db.all('SELECT * FROM tramos_retorno WHERE usuario_id IS NULL OR usuario_id = ?', [usuarioId], (errTramos, tramos) => {
          if (errTramos) {
            console.error(errTramos.message);
            return res.status(500).json({ error: 'Error al obtener tramos' });
          }

          db.all('SELECT * FROM reglas_automaticas WHERE usuario_id IS NULL OR usuario_id = ?', [usuarioId], (errReglas, reglas) => {
            if (errReglas) {
              console.error(errReglas.message);
              return res.status(500).json({ error: 'Error al obtener reglas' });
            }

            res.json({
              usuario: {
                id: req.user.id,
                nombre: req.user.nombre,
                email: req.user.email,
              },
              cuentas: cuentas || [],
              categorias: categorias || [],
              movimientos: movimientos || [],
              tramos_retorno: tramos || [],
              reglas_automaticas: reglas || [],
            });
          });
        });
      });
    });
  });
});

// ---------------------------------------------
// RUTA: Sincronización de subida de datos del dispositivo
// POST /sincronizar
// ---------------------------------------------
app.post('/sincronizar', autenticarUsuario, (req, res) => {
  const usuarioId = req.user.id;
  const payload = req.body || {};

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Payload inválido para sincronización' });
  }

  const sincronizarTabla = async (tabla, columnas, filas, transform = (x) => x) => {
    if (!Array.isArray(filas)) return;

    for (const fila of filas) {
      const datos = transform(fila);
      const columnasBase = columnas.map((columna) => `${columna} = ?`).join(', ');
      const valores = columnas.map((columna) => datos[columna]);
      valores.push(usuarioId, datos.id ?? null);

      await new Promise((resolve, reject) => {
        db.run(`UPDATE ${tabla} SET ${columnasBase} WHERE usuario_id = ? AND id = ?`, valores, function (err) {
          if (err) {
            return reject(err);
          }

          if (this.changes === 0) {
            const insertColumns = columnas.filter((columna) => columna !== 'id');
            const sql = `INSERT INTO ${tabla} (${insertColumns.join(', ')}, usuario_id) VALUES (${insertColumns.map(() => '?').join(', ')}, ?)`;
            const params = insertColumns.map((columna) => datos[columna]).concat(usuarioId);

            db.run(sql, params, function (errInsert) {
              if (errInsert) {
                return reject(errInsert);
              }
              resolve();
            });
            return;
          }

          resolve();
        });
      });
    }
  };

  Promise.all([
    sincronizarTabla('cuentas', ['nombre', 'tipo', 'meta', 'saldo_maximo', 'saldo_minimo'], payload.cuentas || []),
    sincronizarTabla('categorias', ['cuenta_id', 'nombre', 'presupuesto_mensual'], payload.categorias || []),
    sincronizarTabla('movimientos', ['fecha', 'cantidad', 'cuenta_id', 'categoria_id', 'nota'], payload.movimientos || []),
    sincronizarTabla('tramos_retorno', ['cuenta_id', 'orden', 'limite_superior', 'cuota_mensual'], payload.tramos_retorno || []),
    sincronizarTabla('reglas_automaticas', ['cuenta_id', 'nombre', 'tipo', 'dia', 'cantidad', 'saldo_objetivo', 'descripcion', 'activo', 'requiere_validacion', 'estado', 'ultimo_ejecutado'], payload.reglas_automaticas || []),
  ])
    .then(() => {
      res.json({ ok: true, sincronizado: true });
    })
    .catch((error) => {
      console.error('Error al sincronizar:', error.message);
      res.status(500).json({ error: 'Error al sincronizar datos' });
    });
});

// ---------------------------------------------
// RUTA: Eliminar todos los datos de la aplicaciÃ³n
// DELETE /datos
// ---------------------------------------------
app.delete('/datos', (req, res) => {
  const sql = `
    BEGIN TRANSACTION;
    DELETE FROM movimientos;
    DELETE FROM tramos_retorno;
    DELETE FROM categorias;
    DELETE FROM reglas_automaticas;
    DELETE FROM cuentas;
    DELETE FROM sqlite_sequence
      WHERE name IN ('movimientos', 'tramos_retorno', 'categorias', 'reglas_automaticas', 'cuentas');
    COMMIT;
  `;

  db.exec(sql, (err) => {
    if (err) {
      console.error(err.message);
      db.exec('ROLLBACK;', () => {});
      return res.status(500).json({ error: 'Error al borrar los datos' });
    }

    res.status(204).send();
  });
});

// ---------------------------------------------
// RUTA: Exportar copia de seguridad en JSON
// GET /backup/export
// ---------------------------------------------
app.get('/backup/export', (req, res) => {
  const fetchTable = (tableName) => new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${tableName} ORDER BY id ASC`, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

  Promise.all([
    fetchTable('cuentas'),
    fetchTable('categorias'),
    fetchTable('movimientos'),
    fetchTable('tramos_retorno'),
    fetchTable('reglas_automaticas'),
  ])
    .then(([cuentas, categorias, movimientos, tramos, reglas]) => {
      res.json({
        version: 1,
        exportado_en: new Date().toISOString(),
        data: {
          cuentas,
          categorias,
          movimientos,
          tramos_retorno: tramos,
          reglas_automaticas: reglas,
        },
      });
    })
    .catch((error) => {
      console.error('Error al exportar backup:', error.message);
      res.status(500).json({ error: 'Error al exportar la copia de seguridad' });
    });
});

// ---------------------------------------------
// RUTA: Importar copia de seguridad desde JSON
// POST /backup/import
// ---------------------------------------------
app.post('/backup/import', (req, res) => {
  const body = req.body || {};
  const data = body.data || body;

  if (!data || !Array.isArray(data.cuentas)) {
    return res.status(400).json({ error: 'El archivo de copia de seguridad no es válido' });
  }

  const runSql = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

  (async () => {
    try {
      await runSql('BEGIN TRANSACTION');
      await runSql('DELETE FROM movimientos');
      await runSql('DELETE FROM tramos_retorno');
      await runSql('DELETE FROM categorias');
      await runSql('DELETE FROM reglas_automaticas');
      await runSql('DELETE FROM cuentas');
      await runSql("DELETE FROM sqlite_sequence WHERE name IN ('movimientos', 'tramos_retorno', 'categorias', 'reglas_automaticas', 'cuentas')");

      for (const cuenta of data.cuentas || []) {
        await runSql(
          'INSERT INTO cuentas (id, nombre, tipo, meta, saldo_maximo, saldo_minimo) VALUES (?, ?, ?, ?, ?, ?)',
          [
            cuenta.id ?? null,
            cuenta.nombre ?? '',
            cuenta.tipo ?? null,
            cuenta.meta ?? null,
            cuenta.saldo_maximo ?? null,
            cuenta.saldo_minimo ?? null,
          ]
        );
      }

      for (const categoria of data.categorias || []) {
        await runSql(
          'INSERT INTO categorias (id, cuenta_id, nombre, presupuesto_mensual) VALUES (?, ?, ?, ?)',
          [categoria.id ?? null, categoria.cuenta_id ?? null, categoria.nombre ?? '', categoria.presupuesto_mensual ?? 0]
        );
      }

      for (const movimiento of data.movimientos || []) {
        await runSql(
          'INSERT INTO movimientos (id, fecha, cantidad, cuenta_id, categoria_id, nota) VALUES (?, ?, ?, ?, ?, ?)',
          [
            movimiento.id ?? null,
            movimiento.fecha ?? new Date().toISOString(),
            movimiento.cantidad ?? 0,
            movimiento.cuenta_id ?? null,
            movimiento.categoria_id ?? null,
            movimiento.nota ?? null,
          ]
        );
      }

      for (const tramo of data.tramos_retorno || []) {
        await runSql(
          'INSERT INTO tramos_retorno (id, cuenta_id, orden, limite_superior, cuota_mensual) VALUES (?, ?, ?, ?, ?)',
          [tramo.id ?? null, tramo.cuenta_id ?? null, tramo.orden ?? 0, tramo.limite_superior ?? 0, tramo.cuota_mensual ?? 0]
        );
      }

      for (const regla of data.reglas_automaticas || []) {
        await runSql(
          'INSERT INTO reglas_automaticas (id, cuenta_id, nombre, tipo, dia, cantidad, saldo_objetivo, descripcion, activo, requiere_validacion, estado, ultimo_ejecutado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            regla.id ?? null,
            regla.cuenta_id ?? null,
            regla.nombre ?? '',
            regla.tipo ?? 'movimiento',
            regla.dia ?? 1,
            regla.cantidad ?? null,
            regla.saldo_objetivo ?? null,
            regla.descripcion ?? '',
            regla.activo ?? 1,
            regla.requiere_validacion ?? 0,
            regla.estado ?? 'activa',
            regla.ultimo_ejecutado ?? null,
          ]
        );
      }

      await runSql('COMMIT');
      res.json({ ok: true, importado: true, resumen: {
        cuentas: (data.cuentas || []).length,
        categorias: (data.categorias || []).length,
        movimientos: (data.movimientos || []).length,
        tramos: (data.tramos_retorno || []).length,
        reglas: (data.reglas_automaticas || []).length,
      }});
    } catch (error) {
      await runSql('ROLLBACK');
      console.error('Error al importar backup:', error.message);
      res.status(500).json({ error: 'Error al importar la copia de seguridad' });
    }
  })();
});

// ---------------------------------------------
// RUTA: Crear una cuenta nueva
// POST /cuentas
// ---------------------------------------------
app.post('/cuentas', (req, res) => {
  // req.body contiene los datos que nos mandan, por ejemplo:
  // { "nombre": "Fondo de emergencia", "tipo": "ahorro", "meta": 1000 }
  const { nombre, tipo, meta, saldo_maximo, saldo_minimo } = req.body;

  if (!nombre) {
    // Validación mínima: sin nombre, no aceptamos la petición
    return res.status(400).json({ error: 'El nombre de la cuenta es obligatorio' });
  }

  const sql = `
    INSERT INTO cuentas (nombre, tipo, meta, saldo_maximo, saldo_minimo)
    VALUES (?, ?, ?, ?, ?)
  `;
  // Usamos "?" en vez de meter las variables directamente en el texto del SQL.
  // Esto se llama "consulta parametrizada" y evita un problema de seguridad
  // muy conocido llamado "inyección SQL". Es una buena costumbre desde el día 1.

  db.run(sql, [nombre, tipo, meta, saldo_maximo, saldo_minimo], function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al crear la cuenta' });
    }
    // "this.lastID" nos da el id que se acaba de generar automáticamente
    res.status(201).json({ id: this.lastID, nombre, tipo, meta, saldo_maximo, saldo_minimo });
  });
});

// ---------------------------------------------
// RUTA: Listar todas las cuentas
// GET /cuentas
// ---------------------------------------------
app.get('/cuentas', (req, res) => {
  db.all('SELECT * FROM cuentas', [], (err, cuentas) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al obtener las cuentas' });
    }

    db.all('SELECT * FROM movimientos', [], (err, movimientos) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Error al obtener los movimientos' });
      }

      db.all('SELECT * FROM tramos_retorno', [], (err, tramos) => {
        if (err) {
          console.error(err.message);
          return res.status(500).json({ error: 'Error al obtener los tramos' });
        }

        const cuentasConDatos = cuentas.map((cuenta) => {
          let saldo = 0;

          movimientos.forEach((mov) => {
            if (mov.cuenta_id === cuenta.id) {
              saldo += mov.cantidad;
            }
          });

          saldo = Math.round(saldo * 100) / 100;
          const tramosDeCuenta = tramos
            .filter((t) => t.cuenta_id === cuenta.id)
            .sort((a, b) => a.orden - b.orden);

          const tramoActual = tramosDeCuenta.find((t) => t.limite_superior > saldo);
          const importePendiente = cuenta.saldo_maximo != null
            ? Math.max(0, cuenta.saldo_maximo - saldo)
            : Infinity;
          const cuota_actual = tramoActual
            ? Math.round(Math.min(tramoActual.cuota_mensual, importePendiente) * 100) / 100
            : 0;
          const alerta = (cuenta.saldo_minimo !== null && saldo < cuenta.saldo_minimo)
            ? `Saldo por debajo del mínimo (${cuenta.saldo_minimo}€)`
            : null;
          return { ...cuenta, saldo, cuota_actual, alerta };
        });

        db.all('SELECT * FROM reglas_automaticas WHERE activo = 1', [], (err, reglas) => {
          if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Error al obtener las reglas automáticas' });
          }

          const hoy = new Date();
          const anioActual = hoy.getFullYear();
          const mesActual = hoy.getMonth();
          const ultimoDiaMes = new Date(anioActual, mesActual + 1, 0).getDate();

          const ejecutarRegla = (regla, callback) => {
            const ultimoEjecutado = regla.ultimo_ejecutado ? new Date(regla.ultimo_ejecutado) : null;
            const yaSeEjecutoEsteMes = ultimoEjecutado
              && ultimoEjecutado.getFullYear() === anioActual
              && ultimoEjecutado.getMonth() === mesActual;

            if (!regla.activo || yaSeEjecutoEsteMes || regla.dia > hoy.getDate()) {
              return callback();
            }

            const diaEjecucion = Math.min(regla.dia, ultimoDiaMes);
            const fechaEjecucion = new Date(anioActual, mesActual, diaEjecucion, 9, 0, 0);
            const fechaEjecucionLocal = formatearFechaHoraLocal(fechaEjecucion);
            const cuentaActual = cuentasConDatos.find((cuenta) => cuenta.id === regla.cuenta_id);
            const saldoActual = cuentaActual ? cuentaActual.saldo : 0;

            let cantidad = regla.cantidad ?? 0;
            let nota = regla.descripcion || regla.nombre || 'Regla automática';

            if (regla.tipo === 'saldo') {
              const saldoObjetivo = regla.saldo_objetivo ?? saldoActual;
              cantidad = saldoObjetivo - saldoActual;
              nota = `Ajuste automático de saldo: ${saldoObjetivo}€`;
            }

            if (regla.requiere_validacion) {
              return db.run(
                'UPDATE reglas_automaticas SET estado = ?, ultimo_ejecutado = ? WHERE id = ?',
                ['pendiente', fechaEjecucionLocal, regla.id],
                (err) => {
                  if (err) {
                    console.error('Error al dejar pendiente la regla automática:', err.message);
                  }
                  callback();
                }
              );
            }

            db.run(
              'INSERT INTO movimientos (fecha, cantidad, cuenta_id, nota) VALUES (?, ?, ?, ?)',
              [fechaEjecucionLocal, cantidad, regla.cuenta_id, nota],
              (err) => {
                if (err) {
                  console.error('Error al ejecutar regla automática:', err.message);
                  return callback();
                }

                db.run(
                  'UPDATE reglas_automaticas SET estado = ?, ultimo_ejecutado = ? WHERE id = ?',
                  ['ejecutada', fechaEjecucionLocal, regla.id],
                  (err) => {
                    if (err) {
                      console.error('Error al guardar última ejecución:', err.message);
                    }
                    callback();
                  }
                );
              }
            );
          };

          const procesarSiguiente = (indice) => {
            if (indice >= reglas.length) {
              return res.json(cuentasConDatos);
            }

            ejecutarRegla(reglas[indice], () => {
              procesarSiguiente(indice + 1);
            });
          };

          procesarSiguiente(0);
        });
      });
    });
  });
});

// ---------------------------------------------
// RUTA: Eliminar una cuenta
// DELETE /cuentas/:id
// ---------------------------------------------
app.delete('/cuentas/:id', (req, res) => {
  const id = req.params.id;

  db.run('DELETE FROM cuentas WHERE id = ?', [id], function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al eliminar la cuenta' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    res.status(204).send();
  });
});
// Nota: esto NO borra en cascada sus movimientos/tramos/categorías asociadas.
// Si borras una cuenta con movimientos, esos quedarán "huérfanos" (con un
// cuenta_origen_id que ya no existe). Lo revisamos más adelante si hace falta.

// ---------------------------------------------
// RUTA: Modificar una cuenta
// PATCH /cuentas/:id
// ---------------------------------------------
app.patch('/cuentas/:id', (req, res) => {
  const id = req.params.id;
  const { nombre, tipo, meta, saldo_maximo, saldo_minimo } = req.body;

  const campos = [];
  const valores = [];

  if (nombre !== undefined) { campos.push('nombre = ?'); valores.push(nombre); }
  if (tipo !== undefined) { campos.push('tipo = ?'); valores.push(tipo); }
  if (meta !== undefined) { campos.push('meta = ?'); valores.push(meta); }
  if (saldo_maximo !== undefined) { campos.push('saldo_maximo = ?'); valores.push(saldo_maximo); }
  if (saldo_minimo !== undefined) { campos.push('saldo_minimo = ?'); valores.push(saldo_minimo); }

  if (campos.length === 0) {
    return res.status(400).json({ error: 'No se ha enviado ningún campo para modificar' });
  }

  valores.push(id);

  const sql = `UPDATE cuentas SET ${campos.join(', ')} WHERE id = ?`;

  db.run(sql, valores, function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al modificar la cuenta' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    db.get('SELECT * FROM cuentas WHERE id = ?', [id], (err, cuenta) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Error al obtener la cuenta modificada' });
      }
      res.json(cuenta);
    });
  });
});

// ---------------------------------------------
// RUTA: Crear movimiento nuevo
// POST /movimientos
// ---------------------------------------------
app.post('/movimientos', (req, res) => {
  const { fecha, cantidad, cuenta_id, nota, categoria_id } = req.body;

  if (!fecha || cantidad === undefined || !cuenta_id) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const fechaGuardada = typeof fecha === 'string' && fecha.includes('T')
    ? fecha
    : formatearFechaHoraLocal(new Date(fecha));

  const sql = `
    INSERT INTO movimientos (fecha, cantidad, cuenta_id, categoria_id, nota)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(sql, [fechaGuardada, cantidad, cuenta_id, categoria_id, nota], function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al crear el movimiento' });
    }
    res.status(201).json({ id: this.lastID, fecha: fechaGuardada, cantidad, cuenta_id, categoria_id, nota });
  });
});

// ---------------------------------------------
// RUTA: Listar todos los movimientos
// GET /movimientos
// ---------------------------------------------
app.get('/movimientos', (req, res) => {
  db.all('SELECT * FROM movimientos', [], (err, filas) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al obtener los movimientos' });
    }
    res.json(filas);
  });
});

// ---------------------------------------------
// RUTA: Modificar un movimiento
// PATCH /movimientos/:id
// ---------------------------------------------
app.patch('/movimientos/:id', (req, res) => {
  const id = req.params.id;
  const { fecha, tipo, cantidad, cuenta_origen_id, cuenta_destino_id, categoria_id, nota } = req.body;

  const campos = [];
  const valores = [];

  if (fecha !== undefined) { campos.push('fecha = ?'); valores.push(fecha); }
  if (tipo !== undefined) { campos.push('tipo = ?'); valores.push(tipo); }
  if (cantidad !== undefined) { campos.push('cantidad = ?'); valores.push(cantidad); }
  if (cuenta_origen_id !== undefined) { campos.push('cuenta_origen_id = ?'); valores.push(cuenta_origen_id); }
  if (cuenta_destino_id !== undefined) { campos.push('cuenta_destino_id = ?'); valores.push(cuenta_destino_id); }
  if (categoria_id !== undefined) { campos.push('categoria_id = ?'); valores.push(categoria_id); }
  if (nota !== undefined) { campos.push('nota = ?'); valores.push(nota); }

  if (campos.length === 0) {
    return res.status(400).json({ error: 'No se ha enviado ningún campo para modificar' });
  }

  valores.push(id);

  const sql = `UPDATE movimientos SET ${campos.join(', ')} WHERE id = ?`;

  db.run(sql, valores, function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al modificar el movimiento' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }
    db.get('SELECT * FROM movimientos WHERE id = ?', [id], (err, movimiento) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Error al obtener el movimiento modificado' });
      }
      res.json(movimiento);
    });
  });
});

// ---------------------------------------------
// RUTA: Eliminar un movimiento
// DELETE /movimientos/:id
// ---------------------------------------------
app.delete('/movimientos/:id', (req, res) => {
  const id = req.params.id;

  db.run('DELETE FROM movimientos WHERE id = ?', [id], function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al eliminar el movimiento' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }
    res.status(204).send();
  });
});

// ---------------------------------------------
// RUTA: Listar todas las reglas automáticas
// GET /reglas_automaticas
// ---------------------------------------------
app.get('/reglas_automaticas', (req, res) => {
  db.all('SELECT * FROM reglas_automaticas ORDER BY dia ASC, id ASC', [], (err, filas) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al obtener las reglas automáticas' });
    }
    res.json(filas);
  });
});

// ---------------------------------------------
// RUTA: Crear una regla automática
// POST /reglas_automaticas
// ---------------------------------------------
app.post('/reglas_automaticas', (req, res) => {
  const { cuenta_id, nombre, tipo, dia, cantidad, saldo_objetivo, descripcion, activo, requiere_validacion } = req.body;

  if (cuenta_id === undefined || !tipo || dia === undefined) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  if (!['movimiento', 'saldo'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo no válido' });
  }

  if (tipo === 'movimiento' && cantidad === undefined) {
    return res.status(400).json({ error: 'El importe del movimiento es obligatorio' });
  }

  if (tipo === 'saldo' && saldo_objetivo === undefined) {
    return res.status(400).json({ error: 'El saldo objetivo es obligatorio' });
  }

  const sql = `
    INSERT INTO reglas_automaticas (cuenta_id, nombre, tipo, dia, cantidad, saldo_objetivo, descripcion, activo, requiere_validacion, estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [
      cuenta_id,
      nombre || '',
      tipo,
      dia,
      cantidad ?? null,
      saldo_objetivo ?? null,
      descripcion || '',
      activo === undefined ? 1 : Boolean(activo) ? 1 : 0,
      requiere_validacion === undefined ? 0 : Boolean(requiere_validacion) ? 1 : 0,
      'activa',
    ],
    function (err) {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Error al crear la regla automática' });
      }
      res.status(201).json({
        id: this.lastID,
        cuenta_id,
        nombre: nombre || '',
        tipo,
        dia,
        cantidad: cantidad ?? null,
        saldo_objetivo: saldo_objetivo ?? null,
        descripcion: descripcion || '',
        activo: activo === undefined ? 1 : Boolean(activo) ? 1 : 0,
        requiere_validacion: requiere_validacion === undefined ? 0 : Boolean(requiere_validacion) ? 1 : 0,
        estado: 'activa',
      });
    }
  );
});

// ---------------------------------------------
// RUTA: Modificar una regla automática
// PATCH /reglas_automaticas/:id
// ---------------------------------------------
app.patch('/reglas_automaticas/:id', (req, res) => {
  const id = req.params.id;
  const { cuenta_id, nombre, tipo, dia, cantidad, saldo_objetivo, descripcion, activo, requiere_validacion, estado } = req.body;

  const campos = [];
  const valores = [];

  if (cuenta_id !== undefined) { campos.push('cuenta_id = ?'); valores.push(cuenta_id); }
  if (nombre !== undefined) { campos.push('nombre = ?'); valores.push(nombre); }
  if (tipo !== undefined) { campos.push('tipo = ?'); valores.push(tipo); }
  if (dia !== undefined) { campos.push('dia = ?'); valores.push(dia); }
  if (cantidad !== undefined) { campos.push('cantidad = ?'); valores.push(cantidad); }
  if (saldo_objetivo !== undefined) { campos.push('saldo_objetivo = ?'); valores.push(saldo_objetivo); }
  if (descripcion !== undefined) { campos.push('descripcion = ?'); valores.push(descripcion); }
  if (activo !== undefined) { campos.push('activo = ?'); valores.push(Boolean(activo) ? 1 : 0); }
  if (requiere_validacion !== undefined) { campos.push('requiere_validacion = ?'); valores.push(Boolean(requiere_validacion) ? 1 : 0); }
  if (estado !== undefined) { campos.push('estado = ?'); valores.push(estado); }

  if (campos.length === 0) {
    return res.status(400).json({ error: 'No se ha enviado ningún campo para modificar' });
  }

  valores.push(id);
  const sql = `UPDATE reglas_automaticas SET ${campos.join(', ')} WHERE id = ?`;

  db.run(sql, valores, function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al modificar la regla automática' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Regla automática no encontrada' });
    }

    db.get('SELECT * FROM reglas_automaticas WHERE id = ?', [id], (err, regla) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Error al obtener la regla modificada' });
      }
      res.json(regla);
    });
  });
});

// ---------------------------------------------
// RUTA: Eliminar una regla automática
// DELETE /reglas_automaticas/:id
// ---------------------------------------------
app.delete('/reglas_automaticas/:id', (req, res) => {
  const id = req.params.id;

  db.run('DELETE FROM reglas_automaticas WHERE id = ?', [id], function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al eliminar la regla automática' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Regla automática no encontrada' });
    }
    res.status(204).send();
  });
});

// ---------------------------------------------
// RUTA: Validar una regla automática pendiente
// POST /reglas_automaticas/:id/validar
// ---------------------------------------------
app.post('/reglas_automaticas/:id/validar', (req, res) => {
  const id = req.params.id;

  db.get('SELECT * FROM reglas_automaticas WHERE id = ?', [id], (err, regla) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al obtener la regla automática' });
    }

    if (!regla) {
      return res.status(404).json({ error: 'Regla automática no encontrada' });
    }

    if (regla.estado !== 'pendiente') {
      return res.status(400).json({ error: 'La regla no está pendiente de validación' });
    }

    db.get('SELECT * FROM cuentas WHERE id = ?', [regla.cuenta_id], (errCuenta, cuenta) => {
      if (errCuenta || !cuenta) {
        return res.status(400).json({ error: 'No se pudo obtener la cuenta de la regla' });
      }

      db.all('SELECT * FROM movimientos WHERE cuenta_id = ?', [cuenta.id], (errMovs, movimientos) => {
        if (errMovs) {
          return res.status(500).json({ error: 'Error al obtener el saldo de la cuenta' });
        }

        const saldoActual = (movimientos || []).reduce((total, mov) => total + Number(mov.cantidad || 0), 0);
        const fecha = regla.ultimo_ejecutado || formatearFechaHoraLocal(new Date());
        let cantidad = regla.cantidad ?? 0;
        let nota = regla.descripcion || regla.nombre || 'Regla automática';

        if (regla.tipo === 'saldo') {
          const saldoObjetivo = regla.saldo_objetivo ?? 0;
          cantidad = saldoObjetivo - saldoActual;
          nota = `Ajuste automático de saldo: ${saldoObjetivo}€`;
        }

        db.run(
          'INSERT INTO movimientos (fecha, cantidad, cuenta_id, nota) VALUES (?, ?, ?, ?)',
          [fecha, cantidad, regla.cuenta_id, nota],
          (errInsert) => {
            if (errInsert) {
              console.error(errInsert.message);
              return res.status(500).json({ error: 'Error al ejecutar la regla validada' });
            }

            db.run(
              'UPDATE reglas_automaticas SET estado = ?, ultimo_ejecutado = ? WHERE id = ?',
              ['ejecutada', fecha, id],
              (errUpdate) => {
                if (errUpdate) {
                  console.error(errUpdate.message);
                  return res.status(500).json({ error: 'Error al actualizar la regla' });
                }

                db.get('SELECT * FROM reglas_automaticas WHERE id = ?', [id], (errRegla, reglaActualizada) => {
                  if (errRegla) {
                    console.error(errRegla.message);
                    return res.status(500).json({ error: 'Error al recuperar la regla' });
                  }
                  res.json(reglaActualizada);
                });
              }
            );
          }
        );
      });
    });
  });
});

// ---------------------------------------------
// RUTA: Crear movimiento nuevo
// POST /tramos_retorno
// ---------------------------------------------
app.post('/tramos_retorno', (req, res) => {
  const { cuenta_id, orden, limite_superior, cuota_mensual } = req.body;

  if (cuenta_id === undefined || orden === undefined || limite_superior === undefined || cuota_mensual === undefined) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const sql = `
    INSERT INTO tramos_retorno (cuenta_id, orden, limite_superior, cuota_mensual)
    VALUES (?, ?, ?, ?)
  `;

  db.run(sql, [cuenta_id, orden, limite_superior, cuota_mensual], function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al crear el tramo de retorno' });
    }
    res.status(201).json({ id: this.lastID, cuenta_id, orden, limite_superior, cuota_mensual });
  });
});

// ---------------------------------------------
// RUTA: Listar todos los tramos de retorno
// GET /tramos_retorno
// ---------------------------------------------
app.get('/tramos_retorno', (req, res) => {
  db.all('SELECT * FROM tramos_retorno', [], (err, filas) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al obtener los tramos' });
    }
    res.json(filas);
  });
});

// ---------------------------------------------
// RUTA: Modificar un tramo de retorno
// PATCH /tramos_retorno/:id
// ---------------------------------------------
app.patch('/tramos_retorno/:id', (req, res) => {
  const id = req.params.id;
  const { cuenta_id, orden, limite_superior, cuota_mensual } = req.body;

  const campos = [];
  const valores = [];

  if (cuenta_id !== undefined) { campos.push('cuenta_id = ?'); valores.push(cuenta_id); }
  if (orden !== undefined) { campos.push('orden = ?'); valores.push(orden); }
  if (limite_superior !== undefined) { campos.push('limite_superior = ?'); valores.push(limite_superior); }
  if (cuota_mensual !== undefined) { campos.push('cuota_mensual = ?'); valores.push(cuota_mensual); }

  if (campos.length === 0) {
    return res.status(400).json({ error: 'No se ha enviado ningún campo para modificar' });
  }

  valores.push(id);

  const sql = `UPDATE tramos_retorno SET ${campos.join(', ')} WHERE id = ?`;

  db.run(sql, valores, function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al modificar el tramo' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Tramo no encontrado' });
    }
    db.get('SELECT * FROM tramos_retorno WHERE id = ?', [id], (err, tramo) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Error al obtener el tramo modificado' });
      }
      res.json(tramo);
    });
  });
});

// ---------------------------------------------
// RUTA: Eliminar un tramo de retorno
// DELETE /tramos_retorno/:id
// ---------------------------------------------
app.delete('/tramos_retorno/:id', (req, res) => {
  const id = req.params.id;

  db.run('DELETE FROM tramos_retorno WHERE id = ?', [id], function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al eliminar el tramo' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Tramo no encontrado' });
    }
    res.status(204).send();
  });
});

// ---------------------------------------------
// RUTA: Crear categoría nueva
// POST /categorias
// ---------------------------------------------
app.post('/categorias', (req, res) => {
  const { cuenta_id, nombre, presupuesto_mensual } = req.body;

  if (cuenta_id === undefined || nombre === undefined || presupuesto_mensual === undefined) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const sql = `
    INSERT INTO categorias (cuenta_id, nombre, presupuesto_mensual)
    VALUES (?, ?, ?)
  `;

  db.run(sql, [cuenta_id, nombre, presupuesto_mensual], function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al crear la categoría' });
    }
    res.status(201).json({ id: this.lastID, cuenta_id, nombre, presupuesto_mensual });
  });
});

// ---------------------------------------------
// RUTA: Listar todas las categorías
// GET /categorias
// ---------------------------------------------
app.get('/categorias', (req, res) => {
  db.all('SELECT * FROM categorias', [], (err, categorias) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al obtener las categorías' });
    }

    db.all('SELECT * FROM movimientos', [], (err, movimientos) => {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ error: 'Error al obtener los movimientos' });
      }

      const ahora = new Date();
      const mesActual = ahora.getMonth(); // 0 = enero, 11 = diciembre
      const anioActual = ahora.getFullYear();

      const categoriasConGasto = categorias.map((categoria) => {
        const gastado = movimientos
          .filter((mov) => {
            const fechaMov = new Date(mov.fecha);
            return (
              mov.cantidad < 0 &&
              mov.categoria_id === categoria.id &&
              fechaMov.getMonth() === mesActual &&
              fechaMov.getFullYear() === anioActual
            );
          })
          .reduce((total, mov) => total + mov.cantidad, 0);

        const gastadoPositivo = Math.abs(gastado); // Convertimos a positivo para mostrar el gasto

        const progreso = categoria.presupuesto_mensual > 0
          ? Math.round((gastadoPositivo / categoria.presupuesto_mensual) * 100)
          : 0;

        return { ...categoria, gastadoPositivo, progreso };
      });

      res.json(categoriasConGasto);
    });
  });
});

// ---------------------------------------------
// RUTA: Modificar una categoría
// PATCH /categorias/:id
// ---------------------------------------------
app.patch('/categorias/:id', (req, res) => {
  const id = req.params.id;

  // Campos que podemos modificar
  const { cuenta_id, nombre, presupuesto_mensual } = req.body;

  // Construimos dinámicamente qué campos vamos a modificar
  const campos = [];
  const valores = [];

  if (cuenta_id !== undefined) {
    campos.push('cuenta_id = ?');
    valores.push(cuenta_id);
  }

  if (nombre !== undefined) {
    campos.push('nombre = ?');
    valores.push(nombre);
  }

  if (presupuesto_mensual !== undefined) {
    campos.push('presupuesto_mensual = ?');
    valores.push(presupuesto_mensual);
  }

  // Si no se ha enviado ningún campo
  if (campos.length === 0) {
    return res.status(400).json({
      error: 'No se ha enviado ningún campo para modificar'
    });
  }

  // Añadimos el ID al final para el WHERE
  valores.push(id);

  const sql = `
    UPDATE categorias
    SET ${campos.join(', ')}
    WHERE id = ?
  `;

  db.run(sql, valores, function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({
        error: 'Error al modificar la categoría'
      });
    }

    // Si no se modificó ninguna fila, probablemente el ID no existe
    if (this.changes === 0) {
      return res.status(404).json({
        error: 'Categoría no encontrada'
      });
    }

    // Devolvemos la categoría actualizada
    db.get(
      'SELECT * FROM categorias WHERE id = ?',
      [id],
      (err, categoria) => {
        if (err) {
          console.error(err.message);
          return res.status(500).json({
            error: 'Error al obtener la categoría modificada'
          });
        }

        res.json(categoria);
      }
    );
  });
});

// ---------------------------------------------
// RUTA: Eliminar una categoría
// DELETE /categorias/:id
// ---------------------------------------------
app.delete('/categorias/:id', (req, res) => {
  const id = req.params.id;

  db.run('DELETE FROM categorias WHERE id = ?', [id], function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al eliminar la categoría' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.status(204).send(); // 204 = éxito, sin contenido que devolver
  });
});




// Arrancamos el servidor
app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en http://localhost:${PORT}`);
});
