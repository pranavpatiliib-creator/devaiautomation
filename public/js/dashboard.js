
const state = {
    token: localStorage.getItem('token'),
    activeModule: 'dashboard',
    channelsOAuthListenerBound: false,
    charts: {
        messages: null,
        leads: null
    }
};
const moduleTitles = {
    dashboard: 'Dashboard Overview',
    customers: 'Customers',
    conversations: 'Conversations',
    services: 'Services Management',
    offers: 'Offers Management',
    'menu-builder': 'Menu Builder',
    appointments: 'Appointments',
    leads: 'Leads',
    'knowledge-base': 'Knowledge Base',
    'automation-rules': 'Automation Rules',
    channels: 'Channel Connections',
    settings: 'Settings'
};

function getToastHost() {
    let host = document.getElementById('toastHost');
    if (!host) {
        host = document.createElement('div');
        host.id = 'toastHost';
        host.className = 'toast-host';
        document.body.appendChild(host);
    }
    return host;
}

function showToast(message, type = 'info') {
    const host = getToastHost();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    host.appendChild(toast);

    window.setTimeout(() => {
        toast.classList.add('toast-leave');
        window.setTimeout(() => toast.remove(), 180);
    }, 3200);
}
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
}

function setModuleTitle(moduleKey) {
    const subtitle = document.getElementById('topbarSubtitle');
    if (subtitle) {
        subtitle.textContent = moduleTitles[moduleKey] || 'LeadFlow AI';
    }
}

function buildQuery(params) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            search.append(key, value);
        }
    });
    const qs = search.toString();
    return qs ? `?${qs}` : '';
}

async function authedRequest(endpoint, options = {}) {
    try {
        return await API.request(endpoint, {
            ...options,
            token: state.token
        });
    } catch (error) {
        const message = String(error?.message || '').toLowerCase();
        if (message.includes('token') || message.includes('access denied')) {
            showToast('Session expired. Please login again.', 'error');
            setTimeout(() => logout(), 350);
        }
        throw error;
    }
}

function setRootHtml(html) {
    const root = document.getElementById('moduleRoot');
    if (root) root.innerHTML = html;
}

function destroyCharts() {
    if (state.charts.messages) {
        state.charts.messages.destroy();
        state.charts.messages = null;
    }
    if (state.charts.leads) {
        state.charts.leads.destroy();
        state.charts.leads = null;
    }
}

function setActiveNav(moduleName) {
    document.querySelectorAll('.nav-item').forEach((button) => {
        button.classList.toggle('active', button.dataset.module === moduleName);
    });
}

function notifyError(error) {
    showToast(error?.message || 'Something went wrong', 'error');
}

function notifySuccess(message) {
    showToast(message, 'success');
}

async function loadProfileHeader() {
    try {
        const profile = await authedRequest('/api/settings/profile');
        const businessName = profile?.tenant?.business_name || localStorage.getItem('businessName') || 'LeadFlow AI';
        const name = profile?.user?.name || localStorage.getItem('name') || 'User';

        const businessEl = document.getElementById('businessTitle');
        const userEl = document.getElementById('userName');

        if (businessEl) businessEl.textContent = businessName;
        if (userEl) userEl.textContent = name;
    } catch (error) {
        console.error('Profile load failed:', error);
    }
}

function bindGlobalEvents() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    const sidebar = document.getElementById('sidebarNav');
    if (sidebar) {
        sidebar.addEventListener('click', (event) => {
            const button = event.target.closest('.nav-item');
            if (!button) return;
            switchModule(button.dataset.module);
        });
    }
}

async function switchModule(moduleName) {
    state.activeModule = moduleName;
    setActiveNav(moduleName);
    setModuleTitle(moduleName);
    destroyCharts();

    const loaders = {
        dashboard: renderDashboardModule,
        customers: renderCustomersModule,
        conversations: renderConversationsModule,
        services: renderServicesModule,
        offers: renderOffersModule,
        'menu-builder': renderMenuBuilderModule,
        appointments: renderAppointmentsModule,
        leads: renderLeadsModule,
        'knowledge-base': renderKnowledgeBaseModule,
        'automation-rules': renderAutomationRulesModule,
        channels: renderChannelsModule,
        settings: renderSettingsModule
    };

    const loader = loaders[moduleName] || renderDashboardModule;
    await loader();
}

async function renderDashboardModule() {
    setRootHtml(`
        <section class="card">
            <h2>Overview</h2>
            <div class="stats-grid">
                <article class="stat-item">
                    <label>Total Customers</label>
                    <strong id="statCustomers">0</strong>
                </article>
                <article class="stat-item">
                    <label>Total Conversations</label>
                    <strong id="statConversations">0</strong>
                </article>
                <article class="stat-item">
                    <label>Total Leads</label>
                    <strong id="statLeads">0</strong>
                </article>
                <article class="stat-item">
                    <label>Upcoming Appointments</label>
                    <strong id="statAppointments">0</strong>
                </article>
            </div>
        </section>
        <section class="chart-grid">
            <article class="card">
                <h3>Messages Per Day</h3>
                <canvas id="messagesChart" height="160"></canvas>
            </article>
            <article class="card">
                <h3>Leads Per Day</h3>
                <canvas id="leadsChart" height="160"></canvas>
            </article>
        </section>
    `);

    try {
        const overview = await authedRequest('/api/dashboard/overview');
        const totals = overview.totals || {};
        const charts = overview.charts || {};

        document.getElementById('statCustomers').textContent = totals.customers || 0;
        document.getElementById('statConversations').textContent = totals.conversations || 0;
        document.getElementById('statLeads').textContent = totals.leads || 0;
        document.getElementById('statAppointments').textContent = totals.upcomingAppointments || 0;

        const msgPoints = charts.messagesPerDay || [];
        const leadPoints = charts.leadsPerDay || [];

        const messageCtx = document.getElementById('messagesChart');
        const leadCtx = document.getElementById('leadsChart');

        state.charts.messages = new Chart(messageCtx, {
            type: 'line',
            data: {
                labels: msgPoints.map((point) => point.date),
                datasets: [{
                    label: 'Messages',
                    data: msgPoints.map((point) => point.count),
                    borderColor: '#0f5cd9',
                    backgroundColor: 'rgba(15, 92, 217, 0.12)',
                    tension: 0.28,
                    fill: true
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { x: { ticks: { maxRotation: 0, autoSkip: true } } }
            }
        });

        state.charts.leads = new Chart(leadCtx, {
            type: 'bar',
            data: {
                labels: leadPoints.map((point) => point.date),
                datasets: [{
                    label: 'Leads',
                    data: leadPoints.map((point) => point.count),
                    backgroundColor: '#138a5a'
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { x: { ticks: { maxRotation: 0, autoSkip: true } } }
            }
        });
    } catch (error) {
        notifyError(error);
    }
}
async function renderCustomersModule() {
    setRootHtml(`
        <section class="card stack">
            <h2>Customers</h2>
            <div class="toolbar">
                <input id="customerSearch" placeholder="Search name, phone, sender id">
                <button class="btn" id="customerSearchBtn" type="button">Search</button>
                <button class="btn btn-secondary" id="customerResetBtn" type="button">Reset</button>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Channel</th>
                            <th>Sender ID</th>
                            <th>Created</th>
                            <th>History</th>
                        </tr>
                    </thead>
                    <tbody id="customersTable"></tbody>
                </table>
            </div>
        </section>
        <section class="card stack">
            <h3>Conversation History</h3>
            <div id="customerHistory" class="empty-state">Select a customer to view conversation history.</div>
        </section>
    `);

    const table = document.getElementById('customersTable');
    const history = document.getElementById('customerHistory');
    const searchInput = document.getElementById('customerSearch');
    let searchTimer = null;

    async function loadCustomers() {
        try {
            const search = searchInput.value.trim();
            const customers = await authedRequest(`/api/customers${buildQuery({ search })}`);

            if (!customers.length) {
                table.innerHTML = '<tr><td colspan="6"><div class="empty-state">No customers found.</div></td></tr>';
                return;
            }

            table.innerHTML = customers.map((customer) => `
                <tr>
                    <td>${escapeHtml(customer.name || 'Unknown')}</td>
                    <td>${escapeHtml(customer.phone || '-')}</td>
                    <td><span class="status-pill">${escapeHtml(customer.channel || '-')}</span></td>
                    <td>${escapeHtml(customer.sender_id || '-')}</td>
                    <td>${formatDate(customer.created_at)}</td>
                    <td><button class="btn btn-secondary" data-history-id="${customer.id}" type="button">View</button></td>
                </tr>
            `).join('');
        } catch (error) {
            notifyError(error);
        }
    }

    table.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-history-id]');
        if (!button) return;

        try {
            const conversations = await authedRequest(`/api/customers/${button.dataset.historyId}/conversations`);
            if (!conversations.length) {
                history.innerHTML = '<div class="empty-state">No conversation history for this customer.</div>';
                return;
            }

            history.innerHTML = `
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Channel</th>
                                <th>Direction</th>
                                <th>Message</th>
                                <th>Intent</th>
                                <th>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${conversations.map((conv) => `
                                <tr>
                                    <td>${escapeHtml(conv.channel || '-')}</td>
                                    <td>${escapeHtml(conv.direction || '-')}</td>
                                    <td>${escapeHtml(conv.message || '-')}</td>
                                    <td>${escapeHtml(conv.intent || '-')}</td>
                                    <td>${formatDate(conv.created_at)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            notifyError(error);
        }
    });

    document.getElementById('customerSearchBtn').addEventListener('click', loadCustomers);
    document.getElementById('customerResetBtn').addEventListener('click', () => {
        searchInput.value = '';
        loadCustomers();
    });
    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            loadCustomers();
        }
    });
    searchInput.addEventListener('input', () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(loadCustomers, 280);
    });

    await loadCustomers();
}

async function renderConversationsModule() {
    setRootHtml(`
        <section class="card stack">
            <h2>Conversations</h2>
            <div class="toolbar">
                <select id="conversationChannel">
                    <option value="">All Channels</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook Messenger</option>
                </select>
                <input id="conversationFrom" type="date">
                <input id="conversationTo" type="date">
                <button class="btn" id="conversationFilterBtn" type="button">Apply</button>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Channel</th>
                            <th>Direction</th>
                            <th>Message</th>
                            <th>Intent</th>
                            <th>Time</th>
                        </tr>
                    </thead>
                    <tbody id="conversationsTable"></tbody>
                </table>
            </div>
        </section>
    `);

    const table = document.getElementById('conversationsTable');

    async function loadConversations() {
        try {
            const channel = document.getElementById('conversationChannel').value;
            const fromDate = document.getElementById('conversationFrom').value;
            const toDate = document.getElementById('conversationTo').value;

            const data = await authedRequest(`/api/conversations${buildQuery({ channel, fromDate, toDate })}`);

            if (!data.length) {
                table.innerHTML = '<tr><td colspan="6"><div class="empty-state">No conversations found.</div></td></tr>';
                return;
            }

            table.innerHTML = data.map((item) => `
                <tr>
                    <td>${escapeHtml(item.customers?.name || item.sender_id || 'Unknown')}</td>
                    <td>${escapeHtml(item.channel || '-')}</td>
                    <td>${escapeHtml(item.direction || '-')}</td>
                    <td>${escapeHtml(item.message || '-')}</td>
                    <td>${escapeHtml(item.intent || '-')}</td>
                    <td>${formatDate(item.created_at)}</td>
                </tr>
            `).join('');
        } catch (error) {
            notifyError(error);
        }
    }

    document.getElementById('conversationFilterBtn').addEventListener('click', loadConversations);
    await loadConversations();
}

async function renderCrudModule(config) {
    const {
        title,
        endpoint,
        fields,
        columns,
        mapRow = (item) => item,
        onRenderFooter = () => ''
    } = config;

    const formInputs = fields.map((field) => {
        if (field.type === 'textarea') {
            return `<textarea id="${field.id}" placeholder="${field.label}" class="${field.wide ? 'wide' : ''}"></textarea>`;
        }
        if (field.type === 'select') {
            return `
                <select id="${field.id}" class="${field.wide ? 'wide' : ''}">
                    ${(field.options || []).map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('')}
                </select>
            `;
        }
        return `<input id="${field.id}" type="${field.type || 'text'}" placeholder="${field.label}" class="${field.wide ? 'wide' : ''}">`;
    }).join('');
    setRootHtml(`
        <section class="card stack">
            <h2>${title}</h2>
            <input id="recordId" type="hidden">
            <div class="form-grid">${formInputs}</div>
            <div class="actions">
                <button class="btn" id="saveRecordBtn" type="button">Save</button>
                <button class="btn btn-secondary" id="resetRecordBtn" type="button">Reset</button>
            </div>
        </section>
        <section class="card stack">
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            ${columns.map((column) => `<th>${column.label}</th>`).join('')}
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="recordsTable"></tbody>
                </table>
            </div>
            ${onRenderFooter()}
        </section>
    `);

    const table = document.getElementById('recordsTable');
    const recordId = document.getElementById('recordId');

    function readPayload() {
        const payload = {};
        fields.forEach((field) => {
            const element = document.getElementById(field.id);
            if (!element) return;
            let value = element.value;
            if (field.type === 'number') value = value === '' ? '' : Number(value);
            if (field.type === 'checkbox') value = element.checked;
            if (field.coerce === 'boolean') value = value === 'true';
            payload[field.key] = value;
        });
        return payload;
    }

    function writePayload(item) {
        recordId.value = item.id || '';
        fields.forEach((field) => {
            const element = document.getElementById(field.id);
            if (!element) return;
            const value = item[field.key];
            if (field.type === 'checkbox') {
                element.checked = Boolean(value);
            } else {
                element.value = value ?? '';
            }
        });
    }

    function resetForm() {
        recordId.value = '';
        fields.forEach((field) => {
            const element = document.getElementById(field.id);
            if (!element) return;
            if (field.type === 'checkbox') {
                element.checked = field.defaultChecked !== false;
            } else {
                element.value = field.defaultValue ?? '';
            }
        });
    }

    async function loadRecords() {
        try {
            const data = await authedRequest(endpoint);
            if (!data.length) {
                table.innerHTML = `<tr><td colspan="${columns.length + 1}"><div class="empty-state">No records found.</div></td></tr>`;
                return;
            }

            table.innerHTML = data.map((raw) => {
                const item = mapRow(raw);
                const encoded = encodeURIComponent(JSON.stringify(item));
                return `
                    <tr>
                        ${columns.map((column) => `<td>${column.render ? column.render(item) : escapeHtml(item[column.key] ?? '-')}</td>`).join('')}
                        <td>
                            <div class="actions">
                                <button class="btn btn-secondary" data-edit="${encoded}" type="button">Edit</button>
                                <button class="btn btn-danger" data-delete="${item.id}" type="button">Delete</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            notifyError(error);
        }
    }

    async function saveRecord() {
        try {
            const payload = readPayload();
            if (recordId.value) {
                await authedRequest(`${endpoint}/${recordId.value}`, {
                    method: 'PUT',
                    body: payload
                });
            } else {
                await authedRequest(endpoint, {
                    method: 'POST',
                    body: payload
                });
            }
            resetForm();
            await loadRecords();
        } catch (error) {
            notifyError(error);
        }
    }

    table.addEventListener('click', async (event) => {
        const editButton = event.target.closest('[data-edit]');
        const deleteButton = event.target.closest('[data-delete]');

        if (editButton) {
            try {
                const record = JSON.parse(decodeURIComponent(editButton.dataset.edit));
                writePayload(record);
            } catch (error) {
                console.error(error);
            }
        }

        if (deleteButton) {
            const confirmed = window.confirm('Delete this record?');
            if (!confirmed) return;

            try {
                await authedRequest(`${endpoint}/${deleteButton.dataset.delete}`, {
                    method: 'DELETE'
                });
                await loadRecords();
            } catch (error) {
                notifyError(error);
            }
        }
    });

    document.getElementById('saveRecordBtn').addEventListener('click', saveRecord);
    document.getElementById('resetRecordBtn').addEventListener('click', resetForm);

    resetForm();
    await loadRecords();
}

async function renderServicesModule() {
    await renderCrudModule({
        title: 'Services Management',
        endpoint: '/api/services',
        fields: [
            { id: 'serviceName', key: 'service_name', label: 'Service Name' },
            { id: 'serviceDescription', key: 'description', label: 'Description', wide: true },
            { id: 'servicePrice', key: 'price', label: 'Price', type: 'number' },
            { id: 'serviceDiscount', key: 'discount', label: 'Discount (%)', type: 'number' }
        ],
        columns: [
            { key: 'service_name', label: 'Service' },
            { key: 'description', label: 'Description' },
            { key: 'price', label: 'Price' },
            { key: 'discount', label: 'Discount (%)' },
            { key: 'created_at', label: 'Created', render: (row) => formatDate(row.created_at) }
        ]
    });
}

async function renderOffersModule() {
    await renderCrudModule({
        title: 'Offers Management',
        endpoint: '/api/offers',
        fields: [
            { id: 'offerTitle', key: 'title', label: 'Offer Title' },
            { id: 'offerDescription', key: 'description', label: 'Description', wide: true },
            { id: 'offerDiscount', key: 'discount', label: 'Discount (%)', type: 'number' },
            { id: 'offerValidUntil', key: 'valid_until', label: 'Expiration Date', type: 'date' },
            {
                id: 'offerActive',
                key: 'is_active',
                label: 'Status',
                type: 'select',
                coerce: 'boolean',
                options: [
                    { value: true, label: 'Active' },
                    { value: false, label: 'Inactive' }
                ],
                defaultValue: true
            }
        ],
        columns: [
            { key: 'title', label: 'Title' },
            { key: 'description', label: 'Description' },
            { key: 'discount', label: 'Discount (%)' },
            { key: 'valid_until', label: 'Expires On' },
            { key: 'is_active', label: 'Status', render: (row) => row.is_active ? 'Active' : 'Inactive' }
        ]
    });
}

async function renderMenuBuilderModule() {
    await renderCrudModule({
        title: 'Menu Builder',
        endpoint: '/api/menu-options',
        fields: [
            { id: 'menuTitle', key: 'title', label: 'Menu Title' },
            {
                id: 'menuAction',
                key: 'action_type',
                label: 'Action Type',
                type: 'select',
                options: [
                    { value: 'booking', label: 'Booking' },
                    { value: 'services', label: 'Services' },
                    { value: 'offers', label: 'Offers' },
                    { value: 'location', label: 'Location' },
                    { value: 'ai_chat', label: 'AI Chat' }
                ]
            },
            { id: 'menuValue', key: 'action_value', label: 'Action Value' },
            { id: 'menuPosition', key: 'position', label: 'Position', type: 'number', defaultValue: 1 }
        ],
        columns: [
            { key: 'title', label: 'Title' },
            { key: 'action_type', label: 'Action' },
            { key: 'action_value', label: 'Value' },
            { key: 'position', label: 'Position' }
        ]
    });
}
async function renderAppointmentsModule() {
    setRootHtml(`
        <section class="card stack">
            <h2>Appointment Manager</h2>
            <div class="toolbar">
                <select id="appointmentStatus">
                    <option value="">All Status</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <input id="appointmentFrom" type="date">
                <input id="appointmentTo" type="date">
                <button class="btn" id="appointmentFilterBtn" type="button">Apply</button>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Service</th>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Status</th>
                            <th>Notes</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="appointmentsTable"></tbody>
                </table>
            </div>
        </section>
    `);

    const table = document.getElementById('appointmentsTable');

    async function loadAppointments() {
        try {
            const status = document.getElementById('appointmentStatus').value;
            const fromDate = document.getElementById('appointmentFrom').value;
            const toDate = document.getElementById('appointmentTo').value;

            const rows = await authedRequest(`/api/appointments${buildQuery({ status, fromDate, toDate })}`);

            if (!rows.length) {
                table.innerHTML = '<tr><td colspan="7"><div class="empty-state">No appointments found.</div></td></tr>';
                return;
            }

            table.innerHTML = rows.map((row) => `
                <tr>
                    <td>${escapeHtml(row.customers?.name || '-')}</td>
                    <td>${escapeHtml(row.services?.service_name || '-')}</td>
                    <td>${escapeHtml(row.appointment_date || '-')}</td>
                    <td>${escapeHtml(row.appointment_time || '-')}</td>
                    <td>
                        <select data-status-id="${row.id}">
                            ${['scheduled', 'confirmed', 'completed', 'cancelled'].map((statusOption) => `
                                <option value="${statusOption}" ${row.status === statusOption ? 'selected' : ''}>${statusOption}</option>
                            `).join('')}
                        </select>
                    </td>
                    <td>
                        <input value="${escapeHtml(row.notes || '')}" data-notes-id="${row.id}" placeholder="Notes">
                    </td>
                    <td>
                        <button class="btn btn-danger" data-cancel-id="${row.id}" type="button">Cancel</button>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            notifyError(error);
        }
    }

    table.addEventListener('change', async (event) => {
        const statusSelect = event.target.closest('[data-status-id]');
        if (!statusSelect) return;

        try {
            await authedRequest(`/api/appointments/${statusSelect.dataset.statusId}`, {
                method: 'PUT',
                body: { status: statusSelect.value }
            });
        } catch (error) {
            notifyError(error);
            await loadAppointments();
        }
    });

    table.addEventListener('blur', async (event) => {
        const noteInput = event.target.closest('[data-notes-id]');
        if (!noteInput) return;

        try {
            await authedRequest(`/api/appointments/${noteInput.dataset.notesId}`, {
                method: 'PUT',
                body: { notes: noteInput.value }
            });
        } catch (error) {
            notifyError(error);
        }
    }, true);

    table.addEventListener('click', async (event) => {
        const cancelBtn = event.target.closest('[data-cancel-id]');
        if (!cancelBtn) return;

        const confirmed = window.confirm('Cancel this appointment?');
        if (!confirmed) return;

        try {
            await authedRequest(`/api/appointments/${cancelBtn.dataset.cancelId}/cancel`, {
                method: 'PUT'
            });
            await loadAppointments();
        } catch (error) {
            notifyError(error);
        }
    });

    document.getElementById('appointmentFilterBtn').addEventListener('click', loadAppointments);
    await loadAppointments();
}

async function renderLeadsModule() {
    setRootHtml(`
        <section class="card stack">
            <h2>Leads Manager</h2>
            <div class="toolbar">
                <select id="leadStatusFilter">
                    <option value="">All Status</option>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="converted">Converted</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                </select>
                <input id="leadSearch" placeholder="Search by name, phone, service">
                <button class="btn" id="leadFilterBtn" type="button">Apply</button>
                <button class="btn btn-secondary" id="leadExportBtn" type="button">Export PDF</button>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Service</th>
                            <th>Status</th>
                            <th>Note</th>
                            <th>Created</th>
                        </tr>
                    </thead>
                    <tbody id="leadsTable"></tbody>
                </table>
            </div>
        </section>
    `);

    const table = document.getElementById('leadsTable');
    let leadSearchTimer = null;

    async function loadLeads() {
        try {
            const status = document.getElementById('leadStatusFilter').value;
            const search = document.getElementById('leadSearch').value.trim();
            const rows = await authedRequest(`/api/leads${buildQuery({ status, search })}`);

            if (!rows.length) {
                table.innerHTML = '<tr><td colspan="6"><div class="empty-state">No leads found.</div></td></tr>';
                return;
            }

            table.innerHTML = rows.map((row) => `
                <tr>
                    <td>${escapeHtml(row.name || '-')}</td>
                    <td>${escapeHtml(row.phone || '-')}</td>
                    <td>${escapeHtml(row.service || '-')}</td>
                    <td>
                        <select data-lead-status="${row.id}">
                            ${['new', 'contacted', 'qualified', 'converted', 'won', 'lost'].map((statusOption) => `
                                <option value="${statusOption}" ${String(row.status || '').toLowerCase() === statusOption ? 'selected' : ''}>${statusOption}</option>
                            `).join('')}
                        </select>
                    </td>
                    <td><input value="${escapeHtml(row.note || '')}" data-lead-note="${row.id}" placeholder="Add notes"></td>
                    <td>${formatDate(row.created_at)}</td>
                </tr>
            `).join('');
        } catch (error) {
            notifyError(error);
        }
    }

    table.addEventListener('change', async (event) => {
        const statusSelect = event.target.closest('[data-lead-status]');
        if (!statusSelect) return;

        try {
            await authedRequest(`/api/leads/${statusSelect.dataset.leadStatus}`, {
                method: 'PUT',
                body: { status: statusSelect.value }
            });
        } catch (error) {
            notifyError(error);
            await loadLeads();
        }
    });

    table.addEventListener('blur', async (event) => {
        const noteInput = event.target.closest('[data-lead-note]');
        if (!noteInput) return;

        try {
            await authedRequest(`/api/leads/${noteInput.dataset.leadNote}`, {
                method: 'PUT',
                body: { note: noteInput.value }
            });
        } catch (error) {
            notifyError(error);
        }
    }, true);

    document.getElementById('leadFilterBtn').addEventListener('click', loadLeads);
    document.getElementById('leadSearch').addEventListener('input', () => {
        window.clearTimeout(leadSearchTimer);
        leadSearchTimer = window.setTimeout(loadLeads, 300);
    });
    document.getElementById('leadExportBtn').addEventListener('click', async () => {
        const status = document.getElementById('leadStatusFilter').value;
        const endpoint = `/api/leads/export/pdf${buildQuery({ status })}`;

        try {
            const blob = await API.download(endpoint, state.token);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `leads_${Date.now()}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            notifyError(error);
        }
    });

    await loadLeads();
}
async function renderKnowledgeBaseModule() {
    await renderCrudModule({
        title: 'Knowledge Base',
        endpoint: '/api/knowledge-base',
        fields: [
            { id: 'kbQuestion', key: 'question', label: 'Question', wide: true },
            { id: 'kbAnswer', key: 'answer', label: 'Answer', type: 'textarea', wide: true }
        ],
        columns: [
            { key: 'question', label: 'Question' },
            { key: 'answer', label: 'Answer' },
            { key: 'created_at', label: 'Created', render: (row) => formatDate(row.created_at) }
        ]
    });
}

async function renderAutomationRulesModule() {
    await renderCrudModule({
        title: 'Automation Rules',
        endpoint: '/api/automation-rules',
        fields: [
            { id: 'ruleKeyword', key: 'keyword', label: 'Keyword' },
            { id: 'ruleReply', key: 'replyMessage', label: 'Reply Message', type: 'textarea', wide: true },
            { id: 'rulePriority', key: 'priority', label: 'Priority', type: 'number', defaultValue: 1 }
        ],
        columns: [
            { key: 'keyword', label: 'Keyword' },
            { key: 'replyMessage', label: 'Reply Message' },
            { key: 'priority', label: 'Priority' }
        ]
    });
}

async function renderChannelsModule() {
    setRootHtml(`
        <section class="card stack">
            <h2>Channel Connections</h2>
            <div class="toolbar">
                <button class="btn" id="connectFacebookOAuthBtn" type="button">Connect Facebook</button>
                <button class="btn" id="connectInstagramOAuthBtn" type="button">Connect Instagram</button>
            </div>
            <div class="form-grid">
                <input value="whatsapp" readonly>
                <input id="channelToken" placeholder="WhatsApp Access Token">
                <input id="channelPageId" placeholder="WhatsApp Page / Account ID">
                <input id="channelPhoneNumber" placeholder="WhatsApp Phone Number">
            </div>
            <div class="actions">
                <button class="btn" id="connectChannelBtn" type="button">Save WhatsApp Connection</button>
            </div>
        </section>
        <section class="card stack">
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Channel</th>
                            <th>Connected</th>
                            <th>Token</th>
                            <th>Page ID</th>
                            <th>Phone</th>
                            <th>Profile</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="channelsTable"></tbody>
                </table>
            </div>
        </section>
    `);

    const table = document.getElementById('channelsTable');

    async function loadChannels() {
        try {
            const channels = await authedRequest('/api/channel-connections');
            if (!channels.length) {
                table.innerHTML = '<tr><td colspan="8"><div class="empty-state">No channel connections configured.</div></td></tr>';
                return;
            }

            function renderProfile(profile, channel) {
                if (!profile) return '-';
                if (channel === 'facebook') {
                    const name = profile.page_name || 'Facebook Page';
                    const picture = profile.page_picture ? `<img src="${escapeHtml(profile.page_picture)}" alt="${escapeHtml(name)}" style="width:26px;height:26px;border-radius:999px;vertical-align:middle;margin-right:8px;">` : '';
                    return `${picture}<span>${escapeHtml(name)}</span>`;
                }
                if (channel === 'instagram') {
                    const username = profile.username ? `@${profile.username}` : 'Instagram Business';
                    const display = profile.name || username;
                    const picture = profile.profile_picture ? `<img src="${escapeHtml(profile.profile_picture)}" alt="${escapeHtml(display)}" style="width:26px;height:26px;border-radius:999px;vertical-align:middle;margin-right:8px;">` : '';
                    return `${picture}<span>${escapeHtml(display)}</span>`;
                }
                return escapeHtml(JSON.stringify(profile));
            }

            table.innerHTML = channels.map((row) => `
                <tr>
                    <td>${escapeHtml(row.channel)}</td>
                    <td>${row.has_token ? 'Yes' : 'No'}</td>
                    <td>${escapeHtml(row.token_preview || '-')}</td>
                    <td>${escapeHtml(row.page_id || '-')}</td>
                    <td>${escapeHtml(row.phone_number || '-')}</td>
                    <td>${renderProfile(row.profile, row.channel)}</td>
                    <td>
                        <select data-channel-status="${row.id}">
                            <option value="true" ${row.is_active ? 'selected' : ''}>Active</option>
                            <option value="false" ${!row.is_active ? 'selected' : ''}>Inactive</option>
                        </select>
                    </td>
                    <td>
                        <button class="btn btn-danger" data-channel-delete="${row.id}" type="button">Disconnect</button>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            notifyError(error);
        }
    }

    async function startMetaOAuth(channel) {
        try {
            const response = await authedRequest(`/api/meta/oauth/start${buildQuery({ channel })}`);
            if (!response?.authUrl) {
                throw new Error('Meta OAuth URL not available');
            }

            const popup = window.open(response.authUrl, `meta_oauth_${channel}`, 'width=600,height=760');
            if (!popup) {
                throw new Error('Popup blocked. Please allow popups and try again.');
            }
        } catch (error) {
            notifyError(error);
        }
    }

    if (!state.channelsOAuthListenerBound) {
        window.addEventListener('message', async (event) => {
            if (event.origin !== window.location.origin) return;
            if (!event.data || event.data.type !== 'meta_oauth_success') return;

            notifySuccess(`${event.data.channel} connected successfully.`);
            if (state.activeModule === 'channels') {
                await loadChannels();
            }
        });
        state.channelsOAuthListenerBound = true;
    }

    document.getElementById('connectFacebookOAuthBtn').addEventListener('click', () => startMetaOAuth('facebook'));
    document.getElementById('connectInstagramOAuthBtn').addEventListener('click', () => startMetaOAuth('instagram'));

    document.getElementById('connectChannelBtn').addEventListener('click', async () => {
        const accessToken = document.getElementById('channelToken').value.trim();
        const pageId = document.getElementById('channelPageId').value.trim();
        const phoneNumber = document.getElementById('channelPhoneNumber').value.trim();

        try {
            await authedRequest('/api/channel-connections', {
                method: 'POST',
                body: {
                    channel: 'whatsapp',
                    accessToken,
                    pageId,
                    phoneNumber,
                    is_active: true
                }
            });

            document.getElementById('channelToken').value = '';
            document.getElementById('channelPageId').value = '';
            document.getElementById('channelPhoneNumber').value = '';

            await loadChannels();
        } catch (error) {
            notifyError(error);
        }
    });

    table.addEventListener('change', async (event) => {
        const statusSelect = event.target.closest('[data-channel-status]');
        if (!statusSelect) return;

        try {
            await authedRequest(`/api/channel-connections/${statusSelect.dataset.channelStatus}`, {
                method: 'PUT',
                body: { is_active: statusSelect.value === 'true' }
            });
        } catch (error) {
            notifyError(error);
            await loadChannels();
        }
    });

    table.addEventListener('click', async (event) => {
        const deleteButton = event.target.closest('[data-channel-delete]');
        if (!deleteButton) return;

        const confirmed = window.confirm('Disconnect this channel?');
        if (!confirmed) return;

        try {
            await authedRequest(`/api/channel-connections/${deleteButton.dataset.channelDelete}`, {
                method: 'DELETE'
            });
            await loadChannels();
        } catch (error) {
            notifyError(error);
        }
    });

    await loadChannels();
}
async function renderSettingsModule() {
    setRootHtml(`
        <section class="card stack">
            <h2>Profile & Tenant Settings</h2>
            <div class="form-grid">
                <input id="settingName" placeholder="Name">
                <input id="settingBusinessName" placeholder="Business Name">
                <input id="settingProfession" placeholder="Industry / Profession">
                <input id="settingPhone" placeholder="Business Phone">
                <input id="settingLocation" placeholder="Location">
                <input id="settingServices" placeholder="Services" class="wide">
                <input id="settingWebsite" placeholder="Website" class="wide">
                <input id="settingWhatsapp" placeholder="WhatsApp Number">
                <input id="settingFbPage" placeholder="Facebook Page ID">
                <input id="settingInstagram" placeholder="Instagram ID">
            </div>
            <div class="actions">
                <button class="btn" id="saveSettingsBtn" type="button">Save Settings</button>
            </div>
        </section>
        <section class="card stack">
            <h3>Lead Form Link</h3>
            <p class="muted">Share this link publicly to collect leads for your tenant.</p>
            <div class="toolbar">
                <input id="leadFormLink" readonly>
                <button class="btn btn-secondary" id="copyLeadFormLinkBtn" type="button">Copy Link</button>
            </div>
        </section>
    `);

    try {
        const profile = await authedRequest('/api/settings/profile');
        const user = profile.user || {};
        const tenant = profile.tenant || {};

        document.getElementById('settingName').value = user.name || '';
        document.getElementById('settingBusinessName').value = tenant.business_name || user.business_name || '';
        document.getElementById('settingProfession').value = tenant.industry || user.profession || '';
        document.getElementById('settingPhone').value = user.business_phone || '';
        document.getElementById('settingLocation').value = user.location || '';
        document.getElementById('settingServices').value = user.services || '';
        document.getElementById('settingWebsite').value = user.website || '';
        document.getElementById('settingWhatsapp').value = tenant.whatsapp_number || '';
        document.getElementById('settingFbPage').value = tenant.fb_page_id || '';
        document.getElementById('settingInstagram').value = tenant.instagram_id || '';

        const userId = getUserId();
        document.getElementById('leadFormLink').value = `${window.location.origin}/form?user=${encodeURIComponent(userId)}`;
    } catch (error) {
        notifyError(error);
    }

    document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
        const payload = {
            name: document.getElementById('settingName').value.trim(),
            businessName: document.getElementById('settingBusinessName').value.trim(),
            profession: document.getElementById('settingProfession').value.trim(),
            industry: document.getElementById('settingProfession').value.trim(),
            businessPhone: document.getElementById('settingPhone').value.trim(),
            location: document.getElementById('settingLocation').value.trim(),
            services: document.getElementById('settingServices').value.trim(),
            website: document.getElementById('settingWebsite').value.trim(),
            whatsappNumber: document.getElementById('settingWhatsapp').value.trim(),
            fbPageId: document.getElementById('settingFbPage').value.trim(),
            instagramId: document.getElementById('settingInstagram').value.trim()
        };

        try {
            await authedRequest('/api/settings/profile', {
                method: 'PUT',
                body: payload
            });
            await loadProfileHeader();
            notifySuccess('Settings updated successfully.');
        } catch (error) {
            notifyError(error);
        }
    });

    document.getElementById('copyLeadFormLinkBtn').addEventListener('click', async () => {
        const link = document.getElementById('leadFormLink').value;
        try {
            await navigator.clipboard.writeText(link);
            notifySuccess('Lead form link copied.');
        } catch (error) {
            notifyError(error);
        }
    });
}

async function initDashboard() {
    if (!state.token) {
        window.location = '/login';
        return;
    }

    bindGlobalEvents();
    await loadProfileHeader();
    await switchModule(state.activeModule);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}
