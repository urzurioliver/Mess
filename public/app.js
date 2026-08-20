let productos = [];
let carrito = {};

// Cargar menú al iniciar
document.addEventListener('DOMContentLoaded', async () => {
  await cargarCookies();
  document.getElementById('form-pedido').addEventListener('submit', procesarPedido);
});

async function cargarCookies() {
  try {
    const res = await fetch('/api/cookies');
    productos = await res.json();
    renderizarMenu();
    renderizarCarrito();
  } catch (err) {
    console.error("Error al cargar menú:", err);
  }
}

function renderizarMenu() {
  const container = document.getElementById('menu-section');
  container.innerHTML = '';

  productos.forEach(prod => {
    const card = document.createElement('div');
    card.className = 'cookie-card';
    card.innerHTML = `
      <div class="cookie-card-body">
        <img class="cookie-img-circle" src="${prod.imagen || 'https://via.placeholder.com/80'}" alt="${prod.nombre}">
        <div class="cookie-info">
          <h3>${prod.nombre}</h3>
          <p>${prod.descripcion || ''}</p>
          <div class="cookie-price">$${prod.precio}</div>
        </div>
      </div>
      <button class="btn-add-cart" onclick="agregarAlCarrito(${prod.id})">Agregar al carrito</button>
    `;
    container.appendChild(card);
  });
}

function agregarAlCarrito(id) {
  if (carrito[id]) {
    carrito[id].cantidad++;
  } else {
    const prod = productos.find(p => p.id === id);
    carrito[id] = { ...prod, cantidad: 1 };
  }
  renderizarCarrito();
}

function cambiarCantidad(id, delta) {
  if (carrito[id]) {
    carrito[id].cantidad += delta;
    if (carrito[id].cantidad <= 0) delete carrito[id];
  }
  renderizarCarrito();
}

function renderizarCarrito() {
  const container = document.getElementById('ticket-items');
  container.innerHTML = '';
  let total = 0;

  Object.values(carrito).forEach(item => {
    total += item.precio * item.cantidad;
    const row = document.createElement('div');
    row.className = 'ticket-item';
    row.innerHTML = `
      <div>
        <strong>${item.nombre}</strong><br>
        <small>${item.cantidad}X $${item.precio}</small>
      </div>
      <div class="qty-controls">
        <button type="button" class="btn-qty" onclick="cambiarCantidad(${item.id}, -1)">-</button>
        <button type="button" class="btn-qty plus" onclick="cambiarCantidad(${item.id}, 1)">+</button>
      </div>
    `;
    container.appendChild(row);
  });

  document.getElementById('total-monto').innerText = `$${total}`;
}

function toggleComprobante(val) {
  const box = document.getElementById('box-comprobante');
  box.style.display = val === 'Transferencia' ? 'block' : 'none';
}

async function procesarPedido(e) {
  e.preventDefault();

  const itemsKeys = Object.keys(carrito);
  if (itemsKeys.length === 0) {
    document.getElementById('popup-vacio').style.display = 'block';
    return;
  }

  const formData = new FormData();
  formData.append('nombre', document.getElementById('nombre').value);
  formData.append('curso', document.getElementById('curso').value);
  formData.append('metodoEntrega', document.getElementById('metodoEntrega').value);
  formData.append('metodoPago', document.getElementById('metodoPago').value);
  
  const items = Object.values(carrito).map(i => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio }));
  formData.append('items', JSON.stringify(items));
  
  const total = items.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);
  formData.append('total', total);

  const compInput = document.getElementById('comprobante');
  if (compInput.files[0]) {
    formData.append('comprobante', compInput.files[0]);
  }

  try {
    const res = await fetch('/api/pedidos', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.ok) {
      carrito = {};
      renderizarCarrito();
      document.getElementById('form-pedido').reset();
      document.getElementById('popup-exito').style.display = 'block';
    }
  } catch (err) {
    alert("Ocurrió un error al enviar el pedido");
  }
}

function cerrarPopup(id) {
  document.getElementById(id).style.display = 'none';
}