let carrito = [];

function agregarCookie(nombre, precio) {
  carrito.push({ nombre, precio });
  document.getElementById('cart-count').innerText = carrito.length;
}

function abrirCarrito() {
  const lista = document.getElementById('cart-items-list');
  lista.innerHTML = '';
  let total = 0;

  carrito.forEach(item => {
    total += item.precio;
    lista.innerHTML += `<div style="display:flex; justify-content:space-between;">
      <span>${item.nombre}</span>
      <span>$${item.precio}</span>
    </div>`;
  });

  document.getElementById('cart-total-amount').innerText = total;
  document.getElementById('cart-modal').style.display = 'flex';
}

function cerrarCarrito() {
  document.getElementById('cart-modal').style.display = 'none';
}

function confirmarPedido() {
  cerrarCarrito();
  if (carrito.length === 0) {
    document.getElementById('popup-rosa').style.display = 'flex';
  } else {
    document.getElementById('checkout-total').innerText = document.getElementById('cart-total-amount').innerText;
    document.getElementById('checkout-modal').style.display = 'flex';
  }
}

function evaluarEntrega() {
  const valor = document.getElementById('tipo-entrega').value;
  document.getElementById('campo-direccion').style.display = (valor === 'domicilio') ? 'block' : 'none';
}

function evaluarPago() {
  const valor = document.getElementById('medio-pago').value;
  document.getElementById('campo-comprobante').style.display = (valor === 'mercadopago') ? 'block' : 'none';
}

function finalizarCompra() {
  document.getElementById('checkout-modal').style.display = 'none';
  document.getElementById('popup-verde').style.display = 'flex';
}

function cerrarPopup(id) {
  document.getElementById(id).style.display = 'none';
}

function reiniciarTodo() {
  carrito = [];
  document.getElementById('cart-count').innerText = 0;
  cerrarPopup('popup-verde');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function irAAdmin() {
  document.getElementById('admin-screen').style.display = 'flex';
}

function cerrarAdmin() {
  document.getElementById('admin-screen').style.display = 'none';
}

function loginAdmin() {
  const pass = document.getElementById('admin-pass').value;
  if (pass === 'admin123') { // Cambia la clave según requieras
    document.getElementById('admin-login-box').style.display = 'none';
    document.getElementById('admin-panel-box').style.display = 'block';
  } else {
    alert('Contraseña incorrecta');
  }
}