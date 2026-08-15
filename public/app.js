let cookiesDisponibles = [];
const carrito = {};

document.addEventListener('DOMContentLoaded', async () => {
    const res = await fetch('/api/cookies');
    cookiesDisponibles = await res.json();
    
    const container = document.getElementById('menu-cookies');
    container.innerHTML = cookiesDisponibles.map(c => `
        <div>
            <strong>${c.nombre}</strong> - $${c.precio}
            <input type="number" min="0" value="0" id="cookie-${c.id}" onchange="actualizarCarrito(${c.id}, this.value)">
        </div>
    `).join('');
});

function actualizarCarrito(id, cantidad) {
    const qty = parseInt(cantidad) || 0;
    if (qty > 0) {
        carrito[id] = qty;
    } else {
        delete carrito[id];
    }
    calcularTotal();
}

function calcularTotal() {
    let total = 0;
    for (const id in carrito) {
        const item = cookiesDisponibles.find(c => c.id == id);
        if (item) total += item.precio * carrito[id];
    }
    document.getElementById('totalText').textContent = total;
    return total;
}

function toggleComprobante(metodo) {
    document.getElementById('comprobanteContainer').style.display = metodo === 'mercadopago' ? 'block' : 'none';
}

document.getElementById('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const total = calcularTotal();
    if (total <= 0) {
        alert("Por favor selecciona al menos una cookie.");
        return;
    }

    const items = [];
    for (const id in carrito) {
        const item = cookiesDisponibles.find(c => c.id == id);
        items.push({
            cookie_id: parseInt(id),
            cookie: item.nombre,
            cantidad: carrito[id],
            precio_unitario: item.precio
        });
    }

    const formData = new FormData();
    formData.append('nombre', document.getElementById('nombreApellido').value);
    formData.append('curso', document.getElementById('curso').value);
    formData.append('metodo_entrega', document.getElementById('metodoEntrega').value);
    formData.append('metodo_pago', document.getElementById('metodoPago').value);
    formData.append('total', total);
    formData.append('items', JSON.stringify(items));

    if (document.getElementById('metodoPago').value === 'mercadopago') {
        const fileInput = document.getElementById('comprobante');
        if (fileInput.files.length === 0) {
            alert("Debes adjuntar el comprobante para pagos por Mercado Pago.");
            return;
        }
        formData.append('comprobante', fileInput.files[0]);
    }

    const res = await fetch('/api/pedidos', {
        method: 'POST',
        body: formData
    });

    const data = await res.json();
    if (res.ok) {
        alert(`¡Pedido realizado con éxito! ID: ${data.pedido_id}\nDetalle IA: ${data.ia_detalle}`);
        window.location.reload();
    } else {
        alert(`Error: ${data.error}`);
    }
});