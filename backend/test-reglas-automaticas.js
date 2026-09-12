const db = require('./database.js');

db.get(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='reglas_automaticas'",
  (err, row) => {
    if (err) {
      console.error('Error consultando esquema:', err.message);
      db.close(() => process.exit(1));
      return;
    }

    if (!row) {
      console.error('FALTA: la tabla reglas_automaticas no existe');
      db.close(() => process.exit(1));
      return;
    }

    console.log('OK: la tabla reglas_automaticas existe');
    db.close(() => process.exit(0));
  }
);
