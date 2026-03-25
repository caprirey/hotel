let currentDate = new Date();
const API_BASE = '/api';

const getToken = () => localStorage.getItem('hotel_token');

async function authFetch(url, options = {}) {
    if (!options.headers) options.headers = {};
    const token = getToken();
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, options);
    if (res.status === 401) {
        localStorage.removeItem('hotel_token');
        window.location.href = '/login.html';
    }
    return res;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
        window.location.href = '/login.html';
        return;
    }
    initApp();
});

async function initApp() {
    renderSkeleton();
    updateDateDisplay();
    await Promise.all([fetchStats(), fetchRooms()]);
    setupModal();
}

function formatDateYMD(date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return (new Date(date - tzOffset)).toISOString().split('T')[0];
}

function updateDateDisplay() {
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    document.getElementById('current-date-display').textContent = currentDate.toLocaleDateString('es-ES', options);
}

function changeDate(days) {
    currentDate.setDate(currentDate.getDate() + days);
    updateDateDisplay();
    fetchStats();
    fetchRooms();
}

function renderSkeleton() {
    const main = document.getElementById('app-content');
    
    const dateNav = document.querySelector('.date-navigator');
    if (dateNav && !document.getElementById('btn-logout')) {
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'btn-logout';
        logoutBtn.className = 'btn-reset';
        logoutBtn.style.padding = '0.4rem 0.8rem';
        logoutBtn.style.margin = '0 0 0 1rem';
        logoutBtn.style.width = 'auto';
        logoutBtn.innerHTML = 'Salir 🚪';
        logoutBtn.onclick = () => {
            localStorage.removeItem('hotel_token');
            window.location.href = '/login.html';
        };
        dateNav.appendChild(logoutBtn);
    }
    
    main.innerHTML = `
        <div class="dashboard-stats" id="stats-container">
            <div class="stat-card">
                <h3>Ingresos Totales</h3>
                <div class="value income">...</div>
            </div>
            <div class="stat-card">
                <h3>Habitaciones en Uso</h3>
                <div class="value">...</div>
            </div>
        </div>
        <div class="rooms-section">
            <h2 class="section-title" style="margin-top: 2rem;">Habitaciones</h2>
            <div class="rooms-grid" id="rooms-container">
            </div>
        </div>

        <div class="modal-overlay" id="income-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="modal-title">Registrar Ingreso</h2>
                    <button class="close-btn" id="close-modal" aria-label="Cerrar">&times;</button>
                </div>
                <form id="income-form">
                    <input type="hidden" id="room-number-input">
                    <p style="margin-bottom: 1.5rem; color: var(--text-muted); font-size: 1.1rem;">
                        Habitación: <strong id="modal-room-display" style="color: #fff"></strong>
                    </p>
                    
                    <div id="modal-input-section">
                        <div class="form-group">
                            <label>Tipo de Estadía</label>
                            <select id="rent-type" class="custom-select" onchange="toggleHoursField()">
                                <option value="full_day">Día o Noche Completa</option>
                                <option value="hourly">Por Horas</option>
                            </select>
                        </div>
                        <div class="form-group" id="hours-group" style="display: none;">
                            <label for="hours">Cantidad de Horas</label>
                            <input type="number" id="hours" min="1" value="1">
                        </div>
                        <div class="form-group">
                            <label for="amount">Monto cobrado en $</label>
                            <input type="number" id="amount" step="0.01" min="0" placeholder="Ej. 150.00" required>
                        </div>
                        <div class="form-group">
                            <label for="guests">Número de Personas</label>
                            <input type="number" id="guests" min="1" value="1" required>
                        </div>
                        <button type="submit" class="btn-submit" id="btn-save">Registrar Ingreso</button>
                    </div>
                    
                    <div id="modal-actions-section" style="display: none;">
                        <p style="margin-bottom: 1rem; color: #fff;">La habitación se encuentra actualmente en uso.</p>
                        
                        <button type="button" class="btn-submit" style="background: var(--success);" id="btn-checkout" onclick="checkoutRoom()">Finalizar Estancia (Check-out)</button>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem; text-align: center; margin-bottom: 1rem;">La habitación quedará disponible y el dinero cobrado se mantendrá en las finanzas del día.</p>
                        
                        <hr style="border-color: var(--border-color); margin: 1.5rem 0;">
                        
                        <button type="button" class="btn-reset" id="btn-reset" onclick="resetRoom()">Borrar Todos los Ingresos Hoy (Vaciar Habitación)</button>
                    </div>

                    <div style="margin-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1.2rem;">
                        <button type="button" class="btn-submit" style="background: var(--primary); margin-bottom:0;" onclick="openSidebarFromModal()">🔎 Auditar / Editar este Historial</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

async function fetchStats() {
    try {
        const ymd = formatDateYMD(currentDate);
        const res = await authFetch(`${API_BASE}/stats?date=${ymd}`);
        if(!res.ok) return;
        const data = await res.json();
        
        const container = document.getElementById('stats-container');
        container.innerHTML = `
            <div class="stat-card">
                <h3>Ingresos Totales</h3>
                <div class="value income">$${data.total_income_today.toFixed(2)}</div>
            </div>
            <div class="stat-card">
                <h3>Habitaciones en Uso</h3>
                <div class="value">${data.occupied_rooms} / ${data.total_rooms}</div>
            </div>
        `;
    } catch (error) {
        console.error("Error fetching stats:", error);
    }
}

async function fetchRooms() {
    try {
        const ymd = formatDateYMD(currentDate);
        const res = await authFetch(`${API_BASE}/rooms?date=${ymd}`);
        if(!res.ok) return;
        const rooms = await res.json();
        
        const container = document.getElementById('rooms-container');
        container.innerHTML = '';
        
        rooms.forEach(room => {
            const card = document.createElement('div');
            card.className = `room-card ${room.status}`;
            card.onclick = () => openModal(room.number, room.status);
            
            let statusText = "Disponible";
            if (room.status === 'occupied') statusText = "Ocupada (Día)";
            if (room.status === 'occupied_hourly') statusText = "⏱ Ocupada (H)";
            
            card.innerHTML = `
                <div class="room-number">${room.number}</div>
                <div class="room-status" style="font-size:0.75rem;">${statusText}</div>
                <div class="room-income">$${room.total_income_today.toFixed(2)}</div>
            `;
            
            container.appendChild(card);
        });
    } catch (error) {
        console.error("Error fetching rooms:", error);
    }
}

function setupModal() {
    const modal = document.getElementById('income-modal');
    const closeBtn = document.getElementById('close-modal');
    const form = document.getElementById('income-form');

    closeBtn.onclick = closeModal;
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const inputSection = document.getElementById('modal-input-section');
        if (inputSection.style.display === 'none') return;

        const btn = document.getElementById('btn-save');
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        const roomNumber = document.getElementById('room-number-input').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const guests = parseInt(document.getElementById('guests').value);
        const rentType = document.getElementById('rent-type').value;
        const hours = parseInt(document.getElementById('hours').value);
        const dateStr = formatDateYMD(currentDate);

        try {
            const res = await authFetch(`${API_BASE}/income`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    room_number: roomNumber, 
                    amount, 
                    guests, 
                    rent_type: rentType,
                    hours: rentType === 'hourly' ? hours : 0,
                    date: dateStr 
                })
            });
            
            if(res.ok) {
                closeModal();
                await Promise.all([fetchStats(), fetchRooms()]);
            } else {
                alert("Hubo un error al guardar la ganancia.");
            }
        } catch(err) {
            console.error(err);
            alert("Error de conexión.")
        } finally {
            btn.disabled = false;
            btn.textContent = 'Registrar Ingreso';
        }
    };
}

function openModal(roomNumber, status) {
    document.getElementById('room-number-input').value = roomNumber;
    document.getElementById('modal-room-display').textContent = roomNumber;
    
    document.getElementById('amount').value = '';
    document.getElementById('guests').value = '1';
    document.getElementById('rent-type').value = 'full_day';
    document.getElementById('hours').value = '1';
    toggleHoursField();
    
    const isOccupied = status === 'occupied' || status === 'occupied_hourly';
    
    document.getElementById('modal-input-section').style.display = isOccupied ? 'none' : 'block';
    document.getElementById('modal-actions-section').style.display = isOccupied ? 'block' : 'none';
    document.getElementById('modal-title').textContent = isOccupied ? 'Gestionar Habitación' : 'Nueva Estancia';
    
    document.getElementById('income-modal').classList.add('active');
    if(!isOccupied) document.getElementById('amount').focus();
}

function toggleHoursField() {
    const val = document.getElementById('rent-type').value;
    document.getElementById('hours-group').style.display = val === 'hourly' ? 'block' : 'none';
}

async function checkoutRoom() {
    const roomNumber = document.getElementById('room-number-input').value;
    const dateStr = formatDateYMD(currentDate);
    const btn = document.getElementById('btn-checkout');
    
    if(!confirm(`¿Estás seguro de que el cliente de la ${roomNumber} salió? La habitación se mostrará disponible.`)) return;

    btn.disabled = true;
    btn.textContent = 'Procesando...';
    try {
        const res = await authFetch(`${API_BASE}/income/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_number: roomNumber, date: dateStr })
        });
        if(res.ok) {
            closeModal();
            await Promise.all([fetchStats(), fetchRooms()]);
        } else {
            alert('Error al procesar el checkout');
        }
    } catch(e) {
        console.error(e);
        alert('Error de conexión');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Finalizar Estancia (Check-out)';
    }
}

async function resetRoom() {
    const roomNumber = document.getElementById('room-number-input').value;
    const dateStr = formatDateYMD(currentDate);
    
    if(!confirm(`¿Estás completamente seguro de BORRAR DE LAS FINANZAS el dinero de la hab. ${roomNumber}? Usa esta opción solo si fue un error.`)) return;

    const btn = document.getElementById('btn-reset');
    btn.disabled = true;
    btn.textContent = 'Borrando...';
    try {
        const res = await authFetch(`${API_BASE}/income/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_number: roomNumber, date: dateStr })
        });
        if(res.ok) {
            closeModal();
            await Promise.all([fetchStats(), fetchRooms()]);
        } else {
            alert('Error al borrar registro');
        }
    } catch(e) {
        console.error(e);
        alert('Error de conexión');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Borrar Registro de Error';
    }
}

function closeModal() {
    document.getElementById('income-modal').classList.remove('active');
}

// -------------------- SIDEBAR LOGIC --------------------
let currentDetailedRoom = '';

function openSidebarFromModal() {
    const room = document.getElementById('room-number-input').value;
    closeModal();
    openSidebar(room);
}

function closeSidebar() {
    document.getElementById('history-sidebar').classList.remove('active');
    document.getElementById('sidebar-overlay').classList.remove('active');
}

async function openSidebar(roomNumber) {
    currentDetailedRoom = roomNumber;
    document.getElementById('sidebar-title').textContent = `Historial Hab. ${roomNumber}`;
    document.getElementById('history-sidebar').classList.add('active');
    document.getElementById('sidebar-overlay').classList.add('active');
    
    await loadSidebarHistory();
}

async function loadSidebarHistory() {
    const container = document.getElementById('sidebar-content');
    container.innerHTML = '<p>Cargando detalles...</p>';
    
    try {
        const ymd = formatDateYMD(currentDate);
        const res = await authFetch(`${API_BASE}/income/${currentDetailedRoom}?date=${ymd}`);
        if(!res.ok) return;
        const incomes = await res.json();
        
        if (incomes.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);">No hay registros monetarios hoy.</p>';
            return;
        }
        
        let html = '';
        let total = 0;
        
        incomes.forEach(inc => {
            total += inc.amount;
            let timeStr = "00:00";
            if (inc.date) {
                const dateObj = new Date(inc.date + (inc.date.includes('Z') ? '' : 'Z'));
                timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            }
            
            const isHourly = inc.rent_type === 'hourly';
            const typeText = isHourly ? 'Por Horas' : 'Noche Completa';
            
            html += `
                <div class="history-record" id="record-${inc.id}">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                        <strong>${timeStr}</strong>
                        <strong style="color:var(--success);">$${inc.amount.toFixed(2)}</strong>
                    </div>
                    <div style="color:var(--text-muted); font-size:0.9rem; margin-bottom: 0.5rem; line-height:1.5;">
                        <div>Tipo: ${typeText} ${isHourly ? `(${inc.hours}h)` : ''}</div>
                        <div>Personas: ${inc.guests}</div>
                        <div>Estado: ${inc.is_active ? '<span style="color:var(--primary); font-weight:bold;">En Curso</span>' : 'Finalizado'}</div>
                    </div>
                    <div class="actions-row">
                        <button class="edit-btn" onclick="startEdit(${inc.id}, ${inc.amount}, ${inc.guests}, '${inc.rent_type}', ${inc.hours})" title="Editar Registros">✏️ Editar</button>
                        <button class="delete-btn" onclick="deleteRecord(${inc.id}, ${inc.amount})" title="Borrar Registros">🗑️ Borrar</button>
                    </div>
                </div>
            `;
        });
        
        html = `<div style="margin-bottom:1.5rem; font-size:1.15rem; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem;">
                    <strong>Total Sumado Hoy:</strong> <span style="color:var(--success)">$${total.toFixed(2)}</span>
                </div>` + html;
                
        container.innerHTML = html;
        
    } catch(e) {
        console.error(e);
        container.innerHTML = '<p>Error al cargar información del backend.</p>';
    }
}

function startEdit(id, amount, guests, rent_type, hours) {
    const recordDiv = document.getElementById(`record-${id}`);
    
    recordDiv.innerHTML = `
        <div style="margin-bottom: 0.8rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;"><strong>Editando Registro #${id}</strong></div>
        
        <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:0.2rem;">Monto ($)</label>
        <input type="number" id="edit-amount-${id}" class="form-input-sm" value="${amount}" step="0.01">
        
        <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:0.2rem;">Personas</label>
        <input type="number" id="edit-guests-${id}" class="form-input-sm" value="${guests}">
        
        <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:0.2rem;">Tipo</label>
        <select id="edit-type-${id}" class="form-input-sm" onchange="document.getElementById('edit-hours-wrap-${id}').style.display = this.value==='hourly'?'block':'none'">
            <option value="full_day" ${rent_type === 'full_day' ? 'selected' : ''}>Noche Completa</option>
            <option value="hourly" ${rent_type === 'hourly' ? 'selected' : ''}>Por Horas</option>
        </select>
        
        <div id="edit-hours-wrap-${id}" style="display: ${rent_type === 'hourly' ? 'block' : 'none'};">
            <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:0.2rem;">Horas</label>
            <input type="number" id="edit-hours-${id}" class="form-input-sm" value="${hours}">
        </div>
        
        <div style="display:flex; justify-content:space-between; margin-top: 1.2rem;">
            <button class="btn-reset" style="margin:0; width:48%; padding:0.6rem;" onclick="loadSidebarHistory()">Cancelar</button>
            <button class="btn-submit" style="margin:0; width:48%; padding:0.6rem;" onclick="saveEdit(${id})">Guardar</button>
        </div>
    `;
}

async function saveEdit(id) {
    const amount = parseFloat(document.getElementById(`edit-amount-${id}`).value);
    const guests = parseInt(document.getElementById(`edit-guests-${id}`).value);
    const rent_type = document.getElementById(`edit-type-${id}`).value;
    const hours = parseInt(document.getElementById(`edit-hours-${id}`).value);
    
    try {
        const res = await authFetch(`${API_BASE}/income/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, guests, rent_type, hours: rent_type==='hourly' ? hours : 0 })
        });
        if(res.ok) {
            await Promise.all([loadSidebarHistory(), fetchStats(), fetchRooms()]);
        } else {
            alert("Error al actualizar la base de datos.");
        }
    } catch(e) {
        alert("Error de red.");
    }
}

async function deleteRecord(id, amount) {
    if(!confirm(`¿Borrar registro de forma permanente? Se deducirán $${amount.toFixed(2)} de las estadísticas diarias.`)) return;
    try {
        const res = await authFetch(`${API_BASE}/income/${id}`, { method: 'DELETE' });
        if(res.ok) {
            await Promise.all([loadSidebarHistory(), fetchStats(), fetchRooms()]);
        } else {
            alert("Error al borrar.");
        }
    } catch(e) {
        alert("Error de red.");
    }
}
