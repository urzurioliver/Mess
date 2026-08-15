require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const JWT_SECRET = process.env.JWT_SECRET || "mess_secret_key";

// Inicializar OpenAI y Supabase
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Configurar Multer para guardar la imagen en MEMORIA RAM (ideal para Vercel y Supabase Storage)
const upload = multer({ storage: multer.memoryStorage() });

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Función auxiliar para subir la foto a Supabase Storage
async function subirComprobante(file) {
  if (!file) return null;
  const fileName = `${Date.now()}_${file.originalname}`;
  const { data, error } = await supabase.storage
    .from('comprobantes')
    .upload(fileName, file.buffer, { contentType: file.mimetype });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage
    .from('comprobantes')
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

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

// Función de verificación de comprobante por IA (GPT-4 Vision usando el buffer en memoria)
async function verificarComprobanteIA(fileBuffer, montoEsperado) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return { verificado: 0, detalle: "API Key de OpenAI no configurada." };
        }

        const base64Image = fileBuffer.toString('base64');

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
                            3. ¿La fecha es del día de hoy o reciente?
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

// Obtener menú de cookies desde Supabase
app.get('/api/cookies', async (req, res) => {
    try {
        const { data: cookies, error } = await supabase
            .from('cookies')
            .select('*')
            .eq('disponible', true);

        if (error) throw error;
        res.json(cookies);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Crear un nuevo pedido
app.post('/api/pedidos', upload.single('comprobante'), async (req, res) => {
  try {
    const { nombre, curso, metodoEntrega, items, total, metodoPago } = req.body;

    let comprobanteUrl = null;
    let verificacionIa = null;

    // 1. Si enviaron comprobante, subir a Supabase y analizar con IA
    if (req.file) {
      comprobanteUrl = await subirComprobante(req.file);
      verificacionIa = await verificarComprobanteIA(req.file.buffer, total);
    }

    // 2. Guardar el pedido en Supabase
    const { data, error } = await supabase
      .from('pedidos')
      .insert([{
        nombre,
        curso,
        metodo_entrega: metodoEntrega,
        items: typeof items === 'string' ? JSON.parse(items) : items,
        total: Number(total),
        metodo_pago: metodoPago,
        comprobante_url: comprobanteUrl,
        verificacion_ia: verificacionIa
      }]);

    if (error) throw error;

    res.json({ ok: true, mensaje: "Pedido recibido con éxito" });
  } catch (error) {
    console.error("Error al procesar pedido:", error);
    res.status(500).json({ error: "Error al guardar el pedido" });
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
app.get('/api/admin/pedidos', autenticarAdmin, async (req, res) => {
  try {
    const { data: pedidos, error } = await supabase
      .from('pedidos')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) throw error;

    res.json(pedidos);
  } catch (error) {
    console.error("Error al obtener pedidos:", error);
    res.status(500).json({ error: "Error al consultar la base de datos" });
  }
});

// Cambiar estado de un pedido en Supabase
app.patch('/api/admin/pedidos/:id/estado', autenticarAdmin, async (req, res) => {
    try {
        const { estado } = req.body;
        const { error } = await supabase
            .from('pedidos')
            .update({ estado })
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ mensaje: "Estado actualizado exitosamente" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor MESS ejecutándose en http://localhost:${PORT}`);
});