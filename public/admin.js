let token = localStorage.getItem('mess_admin_token');

document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        mostrarPanel();
    }
});

async function loginAdmin() {
    const pass = document.getElementById('adminPass').value;
    const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass })
    });

    const data = await res.json();
    if (res.ok) {
        token = data.token;
        localStorage.setItem('mess_admin_token', token);
        mostrarPanel();
    } else {
        alert(data.error);
    }
}

function mostrarPanel() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    cargarPedidos();
}

function logout() {
    localStorage.removeItem('mess_admin_token');
    window.location.reload();
}

async function cargarPedidos() {
    const res = await fetch('/api/admin/pedidos', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
        alert("Sesión expirada");
        logout();
        return;
    }

    const pedidos = await res.json();
    const container = document.getElementById('pedidosList');

    if (pedidos.length === 0) {
        container.innerHTML = "<p>No hay pedidos registrados.</p>";
        return;
    }

    container.innerHTML = pedidos.map(p => `
        <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;">
            <p><strong>Pedido #${p.id}</strong> - ${p.fecha}</p>
            <p><strong>Cliente:</strong> ${p.nombre} | <strong>Curso:</strong> ${p.curso}</p>
            <p><strong>Entrega:</strong> ${p.metodo_entrega} | <strong>Pago:</strong> ${p.metodo_pago} ($${p.total})</p>
            <p><strong>Estado Actual:</strong> ${p.estado}</p>
            
            <p><strong>Items:</strong></p>
            <ul>
                ${p.items.map(i => `<li>${i.cantidad}x ${i.cookie} ($${i.precio_unitario} c/u)</li>`).join('')}
            </ul>

            ${p.metodo_pago === 'mercadopago' ? `
                <p><strong>Comprobante:</strong> <a href="${p.comprobante_url}" target="_blank">Ver Imagen</a></p>
                <p><strong>Verificación IA:</strong> ${p.verificado_ia === 1 ? '✅ VÁLIDO' : p.verificado_ia === -1 ? '❌ INVÁLIDO' : '⚠️ PENDIENTE'}</p>
                <p><em>Detalle IA: ${p.ia_analisis_detalle}</em></p>
            ` : ''}

            <label>Cambiar Estado: </label>
            <select onchange="cambiarEstado(${p.id}, this.value)">
                <option value="pendiente" ${p.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                <option value="confirmado" ${p.estado === 'confirmado' ? 'selected' : ''}>Confirmado</option>
                <option value="entregado" ${p.estado === 'entregado' ? 'selected' : ''}>Entregado</option>
                <option value="cancelado" ${p.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
            </select>
        </div>
    `).join('');
}

async function cambiarEstado(id, nuevoEstado) {
    await fetch(`/api/admin/pedidos/${id}/estado`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ estado: nuevoEstado })
    });
    alert("Estado actualizado");
}