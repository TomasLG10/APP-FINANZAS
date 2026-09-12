// database.js
// Este archivo se encarga de conectar con la base de datos SQLite
// y de crear las tablas si no existen todavía.

const sqlite3 = require('sqlite3').verbose();
// ".verbose()" hace que, si algo falla, los mensajes de error sean más detallados.
// Muy útil mientras estamos aprendiendo.

// Esto crea (o abre, si ya existe) un archivo llamado finanzas.db
// Ese archivo ES tu base de datos entera, en un solo fichero.
const db = new sqlite3.Database('./finanzas.db', (err) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err.message);
  } else {
    console.log('Conectado a la base de datos SQLite (finanzas.db)');
  }
});

// db.serialize() asegura que los siguientes comandos se ejecuten
// en orden, uno detrás de otro (por defecto, SQLite podría intentar
// ejecutarlos en paralelo, lo cual aquí no nos interesa).
db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      token TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de cuentas
  db.run(`
    CREATE TABLE IF NOT EXISTS cuentas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      nombre TEXT NOT NULL,
      tipo TEXT,
      meta REAL,
      saldo_maximo REAL,
      saldo_minimo REAL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    )
  `);

  db.run('ALTER TABLE cuentas ADD COLUMN usuario_id INTEGER', (err) => {
    if (err && !/duplicate column/i.test(err.message)) {
      console.error('Error al migrar usuario_id en cuentas:', err.message);
    }
  });

  // Tabla de movimientos
  db.run(`
    CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      fecha TEXT NOT NULL,
      cantidad REAL NOT NULL,
      cuenta_id INTEGER NOT NULL,
      categoria_id INTEGER,
      nota TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
      FOREIGN KEY (cuenta_id) REFERENCES cuentas (id),
      FOREIGN KEY (categoria_id) REFERENCES categorias (id)
    )
    `);

  db.run('ALTER TABLE movimientos ADD COLUMN usuario_id INTEGER', (err) => {
    if (err && !/duplicate column/i.test(err.message)) {
      console.error('Error al migrar usuario_id en movimientos:', err.message);
    }
  });

  // Tabla de reglas automáticas por cuenta
  db.run(`
    CREATE TABLE IF NOT EXISTS reglas_automaticas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      cuenta_id INTEGER NOT NULL,
      nombre TEXT NOT NULL DEFAULT '',
      tipo TEXT NOT NULL CHECK(tipo IN ('movimiento', 'saldo')),
      dia INTEGER NOT NULL CHECK(dia BETWEEN 1 AND 31),
      cantidad REAL,
      saldo_objetivo REAL,
      descripcion TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      requiere_validacion INTEGER NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'activa',
      ultimo_ejecutado TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
      FOREIGN KEY (cuenta_id) REFERENCES cuentas (id)
    )
  `);

  db.run('ALTER TABLE reglas_automaticas ADD COLUMN usuario_id INTEGER', (err) => {
    if (err && !/duplicate column/i.test(err.message)) {
      console.error('Error al migrar usuario_id en reglas_automaticas:', err.message);
    }
  });

  db.run('ALTER TABLE reglas_automaticas ADD COLUMN requiere_validacion INTEGER NOT NULL DEFAULT 0', (err) => {
    if (err && !/duplicate column/i.test(err.message)) {
      console.error('Error al migrar requiere_validacion:', err.message);
    }
  });

  db.run('ALTER TABLE reglas_automaticas ADD COLUMN estado TEXT NOT NULL DEFAULT \'activa\'', (err) => {
    if (err && !/duplicate column/i.test(err.message)) {
      console.error('Error al migrar estado:', err.message);
    }
  });

  // Tabla de tramos de retorno
  db.run(`
    CREATE TABLE IF NOT EXISTS tramos_retorno (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      cuenta_id INTEGER NOT NULL,
      orden INTEGER NOT NULL,
      limite_superior REAL NOT NULL,
      cuota_mensual REAL NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
      FOREIGN KEY (cuenta_id) REFERENCES cuentas (id)
    )
  `);

  db.run('ALTER TABLE tramos_retorno ADD COLUMN usuario_id INTEGER', (err) => {
    if (err && !/duplicate column/i.test(err.message)) {
      console.error('Error al migrar usuario_id en tramos_retorno:', err.message);
    }
  });

  // Tabla de categorías
  db.run(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      cuenta_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      presupuesto_mensual REAL NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
      FOREIGN KEY (cuenta_id) REFERENCES cuentas (id)
    )
  `);

  db.run('ALTER TABLE categorias ADD COLUMN usuario_id INTEGER', (err) => {
    if (err && !/duplicate column/i.test(err.message)) {
      console.error('Error al migrar usuario_id en categorias:', err.message);
    }
  });
  console.log('Tablas verificadas/creadas correctamente');
});

// Exportamos la conexión "db" para poder usarla desde otros archivos
// (por ejemplo, desde server.js, para guardar o leer datos)
module.exports = db;