const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./mess.db');

db.serialize(() => {
    // Tabla de Productos/Cookies
    db.run(`
        CREATE TABLE IF NOT EXISTS cookies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            precio REAL NOT NULL,
            disponible INTEGER DEFAULT 1
        )
    `);

    // Tabla de Pedidos
    db.run(`
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_nombre TEXT NOT NULL,
            curso TEXT NOT NULL,
            metodo_entrega TEXT NOT NULL, -- 'colegio' o 'afuera'
            total REAL NOT NULL,
            metodo_pago TEXT NOT NULL,   -- 'efectivo' o 'mercadopago'
            comprobante_url TEXT,
            verificado_ia INTEGER DEFAULT 0, -- 0: Pendiente/No aplica, 1: Valido, -1: Invalido
            ia_analisis_detalle TEXT,
            estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'confirmado', 'entregado', 'cancelado'
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabla intermedia para las cookies de cada pedido
    db.run(`
        CREATE TABLE IF NOT EXISTS pedido_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL,
            cookie_id INTEGER NOT NULL,
            cantidad INTEGER NOT NULL,
            precio_unitario REAL NOT NULL,
            FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
            FOREIGN KEY (cookie_id) REFERENCES cookies(id)
        )
    `);

    // Insertar datos iniciales de prueba si la tabla de cookies está vacía
    db.get("SELECT COUNT(*) AS count FROM cookies", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO cookies (nombre, precio) VALUES (?, ?)");
            stmt.run("Cookie Nutella", 1500);
            stmt.run("Cookie Red Velvet", 1600);
            stmt.run("Cookie Chips Choco", 1300);
            stmt.finalize();
        }
    });
});

module.exports = db;
