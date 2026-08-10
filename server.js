require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const JWT_SECRET = process.env.JWT_SECRET || "mess_secret_key";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de almacenamiento para comprobantes
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads';
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `comp_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

// Middleware de verificación para Admin
function autenticarAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Acceso denegado" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Token inválido" });
        req.user = user;
        next();
    });
}

// Función de verificación de comprobante por IA (GPT-4 Vision)
async function verificarComprobanteIA(filePath, montoEsperado) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return { verificado: 0, detalle: "API Key de OpenAI no configurada." };
        }

        const imageBuffer = fs.readFileSync(filePath);
        const base64Image = imageBuffer.toString('base64');

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analiza este comprobante de transferencia de Mercado Pago.
                            El monto a cobrar esperado es: $${montoEsperado}.
                            Verifica:
                            1. ¿Es un comprobante de Mercado Pago legítimo?
                            2. ¿El monto pagado coincide con el esperado?
                            3. ¿La fecha es del día de hoy?
                            Responde estrictamente en formato JSON con la siguiente estructura:
                            {"valido": true/false, "motivo": "explicacion corta"}`
                        },
                        {
                            type: "image_url",
                            image_url: { url: `data:image/jpeg;base64,${base64Image}` }
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" }
        });

        const resultado = JSON.parse(response.choices[0].message.content);
        return {
            verificado: resultado.valido ? 1 : -1,
            detalle: resultado.motivo
        };
    } catch (error) {
        console.error("Error en verificación por IA:", error);
        return { verificado: 0, detalle: "Error al procesar la imagen con IA." };
    }
}

// --- RUTAS PÚBLICAS ---

// Obtener menú de cookies
app.get('/api/cookies', (req, res) => {
    db.all("SELECT * FROM cookies WHERE disponible = 1", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Crear un nuevo pedido
app.post('/api/pedidos', upload.single('comprobante'), async (req, res) => {
    try {
        const { cliente_nombre, curso, metodo_entrega, metodo_pago, total, items } = req.body;
        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
        const comprobanteUrl = req.file ? `/uploads/${req.file.filename}` : null;

        let verificadoIa = 0;
        let iaDetalle = "Efectivo - No requiere verificación de comprobante";

        if (metodo_pago === 'mercadopago' && req.file) {
            const analisis = await verificarComprobanteIA(req.file.path, total);
            verificadoIa = analisis.verificado;
            iaDetalle = analisis.detalle;
        }

        db.run(
            `INSERT INTO pedidos (cliente_nombre, curso, metodo_entrega, total, metodo_pago, comprobante_url, verificado_ia, ia_analisis_detalle) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [cliente_nombre, curso, metodo_entrega, total, metodo_pago, comprobanteUrl, verificadoIa, iaDetalle],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });

                const pedidoId = this.lastID;
                const stmt = db.prepare("INSERT INTO pedido_items (pedido_id, cookie_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)");

                parsedItems.forEach(item => {
                    stmt.run(pedidoId, item.cookie_id, item.cantidad, item.precio_unitario);
                });
                stmt.finalize();

                res.status(201).json({
                    mensaje: "Pedido registrado correctamente",
                    pedido_id: pedidoId,
                    verificado_ia: verificadoIa,
                    ia_detalle: iaDetalle
                });
            }
        );
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- RUTAS DE ADMINISTRACIÓN ---

// Login Admin
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
        return res.json({ token });
    }
    res.status(401).json({ error: "Contraseña incorrecta" });
});

// Obtener todos los pedidos
app.get('/api/admin/pedidos', autenticarAdmin, (req, res) => {
    const query = `
        SELECT p.*, 
               json_group_array(
                   json_object('cookie', c.nombre, 'cantidad', pi.cantidad, 'precio_unitario', pi.precio_unitario)
               ) as items
        FROM pedidos p
        LEFT JOIN pedido_items pi ON p.id = pi.pedido_id
        LEFT JOIN cookies c ON pi.cookie_id = c.id
        GROUP BY p.id
        ORDER BY p.fecha DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const result = rows.map(r => ({ ...r, items: JSON.parse(r.items) }));
        res.json(result);
    });
});

// Cambiar estado de un pedido
app.patch('/api/admin/pedidos/:id/estado', autenticarAdmin, (req, res) => {
    const { estado } = req.body;
    db.run("UPDATE pedidos SET estado = ? WHERE id = ?", [estado, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: "Estado actualizado exitosamente" });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor MESS ejecutándose en http://localhost:${PORT}`);
});