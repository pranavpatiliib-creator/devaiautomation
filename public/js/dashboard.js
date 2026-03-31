
const state = {
    token: localStorage.getItem('token'),
    activeModule: 'dashboard',
    channelsOAuthListenerBound: false,
    autoReplyPromptOpen: false,
    autoReplySetupCache: null,
    settingsLogoDataUrl: '',
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
    products: 'Products',
    appointments: 'Appointments',
    leads: 'Leads',
    posts: 'Posts',
    'knowledge-base': 'Auto Reply Setup',
    channels: 'Channel Connections',
    settings: 'Settings'
};

const AUTO_REPLY_PROMPT_LIBRARY = {
    default: [
        {
            key: 'business_hours',
            question: 'What are your business hours?',
            placeholder: 'Example: Monday to Saturday, 9:00 AM to 8:00 PM. Sunday closed.',
            hint: 'Customers often ask when they can visit or expect a reply.'
        },
        {
            key: 'location',
            question: 'Where is your business located?',
            placeholder: 'Example: 2nd Floor, MG Road, Pune. Landmark: Near City Mall.',
            hint: 'This helps auto replies answer location and visit-related questions.'
        },
        {
            key: 'contact',
            question: 'What is the best contact number or WhatsApp number for customers?',
            placeholder: 'Example: +91 98XXXXXX12 on call or WhatsApp.',
            hint: 'Useful when customers ask how to reach you quickly.'
        },
        {
            key: 'pricing',
            question: 'How should we answer when customers ask about pricing?',
            placeholder: 'Example: Prices depend on the service. Share your requirement and we will send the exact quote.',
            hint: 'A clear pricing response prevents vague or inconsistent replies.'
        },
        {
            key: 'booking',
            question: 'How can customers book, place an order, or confirm service?',
            placeholder: 'Example: Share your name, phone number, preferred time, and service. We will confirm shortly.',
            hint: 'This gives the auto reply a clear next step.'
        }
    ],
    salon: [
        {
            key: 'appointment_policy',
            question: 'How should we answer appointment and walk-in questions?',
            placeholder: 'Example: We accept both walk-ins and appointments. Appointments are preferred on weekends.',
            hint: 'Perfect for salons, spas, and beauty businesses.'
        },
        {
            key: 'popular_services',
            question: 'Which salon services should we mention first in replies?',
            placeholder: 'Example: Haircut, beard styling, facial, hair color, bridal makeup.',
            hint: 'This helps the bot describe your services naturally.'
        }
    ],
    clinic: [
        {
            key: 'doctor_availability',
            question: 'What should we say about doctor availability or consultation slots?',
            placeholder: 'Example: Consultation is available Monday to Saturday, 10 AM to 1 PM and 5 PM to 8 PM.',
            hint: 'Useful for clinics, dentists, and other medical practices.'
        },
        {
            key: 'emergency_notice',
            question: 'What is the right response for urgent or emergency inquiries?',
            placeholder: 'Example: For emergencies, please call immediately or visit the nearest hospital. Online replies are not for emergency care.',
            hint: 'This keeps auto replies safer for time-sensitive medical queries.'
        }
    ],
    restaurant: [
        {
            key: 'menu_highlights',
            question: 'What menu items or specialties should we mention in quick replies?',
            placeholder: 'Example: South Indian breakfast, thali meals, fresh juices, and family combos.',
            hint: 'Great for cafes, restaurants, and cloud kitchens.'
        },
        {
            key: 'delivery_policy',
            question: 'How should we answer delivery, takeaway, or dine-in questions?',
            placeholder: 'Example: Dine-in and takeaway are available. Delivery is available within 5 km from 11 AM to 10 PM.',
            hint: 'Helps set expectations before a customer orders.'
        }
    ],
    retail: [
        {
            key: 'product_categories',
            question: 'Which product categories should we mention in replies?',
            placeholder: 'Example: Mobile accessories, Bluetooth devices, tempered glass, and chargers.',
            hint: 'Useful for stores and product-led businesses.'
        },
        {
            key: 'stock_check',
            question: 'How should we respond when customers ask if an item is in stock?',
            placeholder: 'Example: Please share the product name or photo and we will confirm stock availability quickly.',
            hint: 'This gives the auto reply a consistent stock-check response.'
        }
    ],
    coaching: [
        {
            key: 'course_info',
            question: 'What should we say about courses, classes, or batches?',
            placeholder: 'Example: We offer spoken English, IELTS, and interview preparation in weekday and weekend batches.',
            hint: 'Useful for coaching centers, tutors, and institutes.'
        },
        {
            key: 'demo_policy',
            question: 'Do you offer demo classes, counselling, or trial sessions?',
            placeholder: 'Example: Yes, one counselling call is free before enrollment.',
            hint: 'This is often one of the first things students ask.'
        }
    ]
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

function normalizeProfessionKey(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return 'default';
    if (text.includes('salon') || text.includes('beauty') || text.includes('spa') || text.includes('barber')) return 'salon';
    if (text.includes('clinic') || text.includes('doctor') || text.includes('dental') || text.includes('hospital')) return 'clinic';
    if (text.includes('restaurant') || text.includes('cafe') || text.includes('food') || text.includes('bakery')) return 'restaurant';
    if (text.includes('shop') || text.includes('store') || text.includes('retail') || text.includes('mobile')) return 'retail';
    if (text.includes('coach') || text.includes('tuition') || text.includes('class') || text.includes('education') || text.includes('training')) return 'coaching';
    return 'default';
}

function getAutoReplyQuestions(profile) {
    const profession = profile?.tenant?.industry || profile?.user?.profession || '';
    const variant = normalizeProfessionKey(profession);
    return [...AUTO_REPLY_PROMPT_LIBRARY.default, ...(AUTO_REPLY_PROMPT_LIBRARY[variant] || [])];
}

function findKnowledgeBaseAnswer(entries, prompt) {
    const match = (entries || []).find((item) => String(item.question || '').trim() === prompt.question);
    return match ? String(match.answer || '').trim() : '';
}

function computeAutoReplyProgress(profile, entries) {
    const prompts = getAutoReplyQuestions(profile);
    const answered = prompts.filter((prompt) => findKnowledgeBaseAnswer(entries, prompt)).length;
    const pending = prompts.filter((prompt) => !findKnowledgeBaseAnswer(entries, prompt));
    return {
        prompts,
        pending,
        answered,
        total: prompts.length,
        profession: profile?.tenant?.industry || profile?.user?.profession || 'your business'
    };
}

async function upsertKnowledgeBaseAnswer(existingEntries, prompt, answer) {
    const existing = (existingEntries || []).find((item) => String(item.question || '').trim() === prompt.question);
    if (existing?.id) {
        return authedRequest(`/api/knowledge-base/${existing.id}`, {
            method: 'PUT',
            body: {
                question: prompt.question,
                answer
            }
        });
    }

    return authedRequest('/api/knowledge-base', {
        method: 'POST',
        body: {
            question: prompt.question,
            answer
        }
    });
}

async function loadAutoReplySetupData(forceRefresh = false) {
    if (!forceRefresh && state.autoReplySetupCache) {
        return state.autoReplySetupCache;
    }

    const [profile, entries, autoReplySettings] = await Promise.all([
        authedRequest('/api/settings/profile'),
        authedRequest('/api/knowledge-base'),
        authedRequest('/api/auto-reply/settings')
    ]);

    state.autoReplySetupCache = { profile, entries, autoReplySettings };
    return state.autoReplySetupCache;
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
        products: renderProductsModule,
        appointments: renderAppointmentsModule,
        leads: renderLeadsModule,
        posts: renderPostsModule,
        'knowledge-base': renderKnowledgeBaseModule,
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
        onRenderFooter = () => '',
        onReady = null
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

    if (typeof onReady === 'function') {
        await onReady({
            loadRecords,
            resetForm,
            writePayload
        });
    }
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

async function renderPostsModule() {
    setRootHtml(`
        <section class="card stack">
            <h2>Social Posts</h2>
            <p>Create drafts, schedule posts, or publish immediately to connected Facebook and Instagram channels.</p>
            <input id="postId" type="hidden">
            <div class="form-grid">
                <select id="postPlatform">
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                </select>
                <input id="postScheduleAt" type="datetime-local">
                <input id="postMediaUrl" class="wide" placeholder="Public image URL (required for Instagram publishing)">
                <textarea id="postContent" class="wide" placeholder="Write your post caption or message"></textarea>
            </div>
            <div class="actions">
                <button class="btn" id="savePostBtn" type="button">Save Draft / Schedule</button>
                <button class="btn btn-secondary" id="publishPostBtn" type="button">Publish Now</button>
                <button class="btn btn-secondary" id="resetPostBtn" type="button">Reset</button>
            </div>
        </section>
        <section class="card stack">
            <div class="toolbar">
                <select id="postStatusFilter">
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="retrying">Retrying</option>
                    <option value="posted">Posted</option>
                    <option value="failed">Failed</option>
                </select>
                <button class="btn btn-secondary" id="refreshPostsBtn" type="button">Refresh</button>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Platform</th>
                            <th>Content</th>
                            <th>Status</th>
                            <th>Scheduled</th>
                            <th>Posted</th>
                            <th>Error</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="postsTable"></tbody>
                </table>
            </div>
            <div id="postAttemptsPanel" class="empty-state">Select a post to view recent publish attempts.</div>
        </section>
    `);

    const table = document.getElementById('postsTable');
    const attemptsPanel = document.getElementById('postAttemptsPanel');

    function resetPostForm() {
        document.getElementById('postId').value = '';
        document.getElementById('postPlatform').value = 'facebook';
        document.getElementById('postScheduleAt').value = '';
        document.getElementById('postMediaUrl').value = '';
        document.getElementById('postContent').value = '';
    }

    function collectPostPayload() {
        const platform = document.getElementById('postPlatform').value;
        const content = document.getElementById('postContent').value.trim();
        const mediaUrl = document.getElementById('postMediaUrl').value.trim();
        const scheduleAt = document.getElementById('postScheduleAt').value;
        return {
            platform,
            content,
            scheduled_at: scheduleAt ? new Date(scheduleAt).toISOString() : null,
            media_urls: mediaUrl ? [mediaUrl] : []
        };
    }

    async function loadAttempts(postId) {
        try {
            const attempts = await authedRequest(`/api/posts/${postId}/attempts`);
            if (!attempts.length) {
                attemptsPanel.innerHTML = '<div class="empty-state">No attempts recorded yet for this post.</div>';
                return;
            }

            attemptsPanel.innerHTML = `
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Error</th>
                                <th>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${attempts.map((attempt) => `
                                <tr>
                                    <td>${escapeHtml(attempt.status || '-')}</td>
                                    <td>${escapeHtml(attempt.error || '-')}</td>
                                    <td>${formatDate(attempt.created_at)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (error) {
            notifyError(error);
        }
    }

    async function loadPosts() {
        try {
            const status = document.getElementById('postStatusFilter').value;
            const posts = await authedRequest(`/api/posts${buildQuery({ status })}`);

            if (!posts.length) {
                table.innerHTML = '<tr><td colspan="7"><div class="empty-state">No posts created yet.</div></td></tr>';
                return;
            }

            table.innerHTML = posts.map((post) => `
                <tr>
                    <td>${escapeHtml(post.platform || '-')}</td>
                    <td>${escapeHtml(post.content || '-')}</td>
                    <td><span class="status-pill">${escapeHtml(post.status || '-')}</span></td>
                    <td>${formatDate(post.scheduled_at)}</td>
                    <td>${formatDate(post.posted_at)}</td>
                    <td>${escapeHtml(post.last_error || '-')}</td>
                    <td>
                        <button class="btn btn-secondary" data-post-edit="${post.id}" type="button">Edit</button>
                        <button class="btn btn-secondary" data-post-publish="${post.id}" type="button">Publish</button>
                        <button class="btn btn-secondary" data-post-attempts="${post.id}" type="button">Attempts</button>
                        <button class="btn btn-danger" data-post-delete="${post.id}" type="button">Delete</button>
                    </td>
                </tr>
            `).join('');

            table.querySelectorAll('[data-post-edit]').forEach((button) => {
                const post = posts.find((item) => item.id === button.dataset.postEdit);
                if (!post) return;

                button.addEventListener('click', () => {
                    document.getElementById('postId').value = post.id;
                    document.getElementById('postPlatform').value = post.platform || 'facebook';
                    document.getElementById('postScheduleAt').value = post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : '';
                    document.getElementById('postMediaUrl').value = Array.isArray(post.media_urls) ? (post.media_urls[0] || '') : '';
                    document.getElementById('postContent').value = post.content || '';
                    attemptsPanel.innerHTML = '<div class="empty-state">Editing selected post.</div>';
                });
            });
        } catch (error) {
            notifyError(error);
        }
    }

    document.getElementById('savePostBtn').addEventListener('click', async () => {
        const postId = document.getElementById('postId').value;
        const payload = collectPostPayload();

        try {
            if (postId) {
                await authedRequest(`/api/posts/${postId}`, { method: 'PUT', body: payload });
            } else {
                await authedRequest('/api/posts', { method: 'POST', body: payload });
            }
            notifySuccess('Post saved successfully.');
            resetPostForm();
            await loadPosts();
        } catch (error) {
            notifyError(error);
        }
    });

    document.getElementById('publishPostBtn').addEventListener('click', async () => {
        try {
            const postId = document.getElementById('postId').value;
            if (postId) {
                await authedRequest(`/api/posts/${postId}/publish`, { method: 'POST' });
            } else {
                const created = await authedRequest('/api/posts', { method: 'POST', body: collectPostPayload() });
                await authedRequest(`/api/posts/${created.post.id}/publish`, { method: 'POST' });
            }
            notifySuccess('Post queued for publishing.');
            resetPostForm();
            await loadPosts();
        } catch (error) {
            notifyError(error);
        }
    });

    document.getElementById('resetPostBtn').addEventListener('click', resetPostForm);
    document.getElementById('refreshPostsBtn').addEventListener('click', loadPosts);
    document.getElementById('postStatusFilter').addEventListener('change', loadPosts);

    table.addEventListener('click', async (event) => {
        const publishButton = event.target.closest('[data-post-publish]');
        if (publishButton) {
            try {
                await authedRequest(`/api/posts/${publishButton.dataset.postPublish}/publish`, { method: 'POST' });
                notifySuccess('Post queued for publishing.');
                await loadPosts();
            } catch (error) {
                notifyError(error);
            }
            return;
        }

        const attemptsButton = event.target.closest('[data-post-attempts]');
        if (attemptsButton) {
            await loadAttempts(attemptsButton.dataset.postAttempts);
            return;
        }

        const deleteButton = event.target.closest('[data-post-delete]');
        if (!deleteButton) return;

        const confirmed = window.confirm('Delete this post?');
        if (!confirmed) return;

        try {
            await authedRequest(`/api/posts/${deleteButton.dataset.postDelete}`, { method: 'DELETE' });
            notifySuccess('Post deleted.');
            await loadPosts();
            attemptsPanel.innerHTML = '<div class="empty-state">Select a post to view recent publish attempts.</div>';
        } catch (error) {
            notifyError(error);
        }
    });

    resetPostForm();
    await loadPosts();
}
async function openAutoReplySetupPrompt() {
    if (state.autoReplyPromptOpen) return;

    const { profile, entries } = await loadAutoReplySetupData();
    const progress = computeAutoReplyProgress(profile, entries);
    const prompt = progress.pending[0];

    if (!prompt) return;

    state.autoReplyPromptOpen = true;

    const modalHost = document.createElement('div');
    modalHost.className = 'setup-modal-backdrop';

    const currentIndex = progress.answered + 1;
    const progressPercent = Math.max(8, Math.round((progress.answered / progress.total) * 100));
    modalHost.innerHTML = `
        <div class="setup-modal" role="dialog" aria-modal="true" aria-labelledby="autoReplyPromptTitle">
            <h3 id="autoReplyPromptTitle">Complete your auto reply setup</h3>
            <p>We will keep asking the important questions for ${escapeHtml(progress.profession)} until your reply assistant has enough business context.</p>
            <div class="setup-progress"><span style="width:${progressPercent}%"></span></div>
            <div class="setup-modal-meta">
                <span>Question ${currentIndex} of ${progress.total}</span>
                <span>${progress.total - progress.answered} remaining</span>
            </div>
            <label class="prompt-label" for="autoReplyPromptAnswer">${escapeHtml(prompt.question)}</label>
            <p>${escapeHtml(prompt.hint || '')}</p>
            <textarea id="autoReplyPromptAnswer" placeholder="${escapeHtml(prompt.placeholder || 'Write the exact business answer here...')}"></textarea>
            <div class="actions" style="margin-top:16px;">
                <button class="btn" id="autoReplyPromptSaveBtn" type="button">Save And Continue</button>
                <button class="btn btn-secondary" id="autoReplyPromptSettingsBtn" type="button">Open Settings</button>
            </div>
        </div>
    `;

    document.body.appendChild(modalHost);

    const answerInput = document.getElementById('autoReplyPromptAnswer');
    if (answerInput) answerInput.focus();

    const closeModal = () => {
        state.autoReplyPromptOpen = false;
        modalHost.remove();
    };

    const saveButton = document.getElementById('autoReplyPromptSaveBtn');
    if (saveButton) {
        saveButton.addEventListener('click', async () => {
            const answer = String(answerInput?.value || '').trim();
            if (!answer) {
                showToast('Please answer the question so the auto reply can use exact details.', 'error');
                if (answerInput) answerInput.focus();
                return;
            }

            try {
                const saved = await upsertKnowledgeBaseAnswer(entries, prompt, answer);
                const existingIndex = entries.findIndex((item) => String(item.question || '').trim() === prompt.question);
                if (existingIndex >= 0) {
                    entries[existingIndex] = { ...entries[existingIndex], answer, updated_at: new Date().toISOString() };
                } else {
                    entries.unshift(saved);
                }
                closeModal();
                showToast('Answer saved.', 'success');

                if (state.activeModule === 'knowledge-base') {
                    await renderKnowledgeBaseModule();
                }

                await openAutoReplySetupPrompt();
            } catch (error) {
                notifyError(error);
            }
        });
    }

    const settingsButton = document.getElementById('autoReplyPromptSettingsBtn');
    if (settingsButton) {
        settingsButton.addEventListener('click', async () => {
            closeModal();
            await switchModule('settings');
        });
    }
}

async function renderKnowledgeBaseModule() {
    const { profile, entries, autoReplySettings } = await loadAutoReplySetupData();

    const progress = computeAutoReplyProgress(profile, entries);
    const completionPercent = progress.total ? Math.round((progress.answered / progress.total) * 100) : 100;

    setRootHtml(`
        <section class="card stack setup-highlight">
            <h2>Auto Reply Setup</h2>
            <p>Answer the key questions your customers ask most often. The bot will keep using these exact answers for faster and more reliable replies.</p>
            <div class="setup-chip-row">
                <span class="setup-chip ${progress.pending.length ? 'pending' : 'complete'}">${escapeHtml(progress.profession)}</span>
                <span class="setup-chip ${progress.pending.length ? 'pending' : 'complete'}">${completionPercent}% complete</span>
                <span class="setup-chip ${autoReplySettings?.enabled ? 'complete' : 'pending'}">${autoReplySettings?.enabled ? 'Auto reply on' : 'Auto reply off'}</span>
            </div>
            <div class="actions">
                <button class="btn" id="continueAutoReplySetupBtn" type="button">${progress.pending.length ? 'Continue Question Setup' : 'Review Answers'}</button>
                <button class="btn btn-secondary" id="toggleAutoReplyBtn" type="button">${autoReplySettings?.enabled ? 'Disable Auto Reply' : 'Enable Auto Reply'}</button>
            </div>
        </section>
        <section class="setup-grid">
            <section class="card stack">
                <h3>Question Coverage</h3>
                <div class="setup-list" id="autoReplyQuestionList"></div>
            </section>
            <section class="setup-sidecard">
                <section class="card stack">
                    <h3>Why This Matters</h3>
                    <ul class="setup-checklist">
                        <li>Customers get exact answers for timings, booking, pricing, and location.</li>
                        <li>The reply assistant sounds closer to your real business.</li>
                        <li>Only unanswered questions remain in the guided popup.</li>
                    </ul>
                </section>
                <section class="card stack">
                    <h3>Current Setup</h3>
                    <p class="muted">Answered ${progress.answered} out of ${progress.total} guided questions for ${escapeHtml(progress.profession)}.</p>
                    <p class="muted">${progress.pending.length ? `${progress.pending.length} questions still need exact answers.` : 'Everything needed for the guided setup is filled in.'}</p>
                </section>
            </section>
        </section>
    `);

    const list = document.getElementById('autoReplyQuestionList');
    list.innerHTML = progress.prompts.map((prompt) => {
        const answer = findKnowledgeBaseAnswer(entries, prompt);
        return `
            <article class="setup-question">
                <strong>${escapeHtml(prompt.question)}</strong>
                <p>${escapeHtml(prompt.hint || '')}</p>
                <div class="setup-question-footer">
                    <span class="setup-answer">${escapeHtml(answer || 'Not answered yet')}</span>
                    <button class="btn btn-secondary" data-setup-question="${escapeHtml(prompt.key)}" type="button">${answer ? 'Edit Answer' : 'Answer Now'}</button>
                </div>
            </article>
        `;
    }).join('');

    document.getElementById('continueAutoReplySetupBtn').addEventListener('click', async () => {
        await openAutoReplySetupPrompt();
    });

    document.getElementById('toggleAutoReplyBtn').addEventListener('click', async () => {
        try {
            await authedRequest('/api/auto-reply/settings', {
                method: 'PUT',
                body: {
                    enabled: !autoReplySettings?.enabled,
                    ai_enabled: autoReplySettings?.ai_enabled || false,
                    delay_seconds: autoReplySettings?.delay_seconds || 0
                }
            });
            state.autoReplySetupCache = {
                ...state.autoReplySetupCache,
                autoReplySettings: {
                    ...autoReplySettings,
                    enabled: !autoReplySettings?.enabled
                }
            };
            notifySuccess(`Auto reply ${autoReplySettings?.enabled ? 'disabled' : 'enabled'} successfully.`);
            await renderKnowledgeBaseModule();
        } catch (error) {
            notifyError(error);
        }
    });

    list.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-setup-question]');
        if (!button) return;

        const prompt = progress.prompts.find((item) => item.key === button.dataset.setupQuestion);
        if (!prompt) return;

        const existingAnswer = findKnowledgeBaseAnswer(entries, prompt);
        const nextAnswer = window.prompt(prompt.question, existingAnswer || '');
        if (nextAnswer === null) return;

        const trimmedAnswer = String(nextAnswer).trim();
        if (!trimmedAnswer) {
            notifyError(new Error('Answer cannot be empty.'));
            return;
        }

        try {
            const saved = await upsertKnowledgeBaseAnswer(entries, prompt, trimmedAnswer);
            const existingIndex = entries.findIndex((item) => String(item.question || '').trim() === prompt.question);
            if (existingIndex >= 0) {
                entries[existingIndex] = { ...entries[existingIndex], answer: trimmedAnswer, updated_at: new Date().toISOString() };
            } else {
                entries.unshift(saved);
            }
            notifySuccess('Answer saved successfully.');
            await renderKnowledgeBaseModule();
        } catch (error) {
            notifyError(error);
        }
    });
}

async function renderProductsModule() {
    await renderCrudModule({
        title: 'Products',
        endpoint: '/api/products',
        fields: [
            { id: 'productName', key: 'product_name', label: 'Product Name' },
            { id: 'productCategory', key: 'category', label: 'Category' },
            { id: 'productPrice', key: 'price', label: 'Price', type: 'number' },
            { id: 'productStock', key: 'stock_quantity', label: 'Stock Qty', type: 'number' },
            { id: 'productDescription', key: 'description', label: 'Description', type: 'textarea', wide: true },
            {
                id: 'productActive',
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
            { key: 'product_name', label: 'Product' },
            { key: 'category', label: 'Category' },
            { key: 'price', label: 'Price' },
            { key: 'stock_quantity', label: 'Stock Qty' },
            { key: 'is_active', label: 'Status', render: (row) => row.is_active ? 'Active' : 'Inactive' }
        ],
        onRenderFooter: () => `
            <section class="import-panel">
                <h3>Import Product Data</h3>
                <p class="muted">Upload Excel, CSV, or text data and keep editing products after import.</p>
                <div class="form-grid">
                    <input id="productImportFile" type="file" accept=".xlsx,.xls,.csv,.txt" class="wide">
                    <textarea id="productImportText" class="wide" placeholder="Or paste plain text here. Example: Product Name, Category, Price, Stock Qty, Description"></textarea>
                </div>
                <div class="actions">
                    <button class="btn" id="importProductsBtn" type="button">Import Products</button>
                    <button class="btn btn-secondary" id="clearProductImportBtn" type="button">Clear Import</button>
                </div>
                <div id="productImportStatus" class="muted"></div>
            </section>
        `,
        onReady: async ({ loadRecords }) => {
            const fileInput = document.getElementById('productImportFile');
            const textInput = document.getElementById('productImportText');
            const status = document.getElementById('productImportStatus');
            const clearBtn = document.getElementById('clearProductImportBtn');
            const importBtn = document.getElementById('importProductsBtn');

            function setStatus(message, type = 'muted') {
                if (!status) return;
                status.className = type === 'error' ? 'form-feedback error' : 'muted';
                status.textContent = message;
            }

            async function readSelectedFile(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onerror = () => reject(new Error('Failed to read the selected file.'));
                    reader.onload = () => {
                        const result = reader.result;
                        if (typeof result === 'string') {
                            const base64 = result.includes(',') ? result.split(',')[1] : result;
                            resolve(base64);
                            return;
                        }
                        reject(new Error('Unsupported file format.'));
                    };
                    reader.readAsDataURL(file);
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    if (fileInput) fileInput.value = '';
                    if (textInput) textInput.value = '';
                    setStatus('');
                });
            }

            if (importBtn) {
                importBtn.addEventListener('click', async () => {
                    const file = fileInput?.files?.[0] || null;
                    const pastedText = String(textInput?.value || '').trim();

                    if (!file && !pastedText) {
                        setStatus('Choose a file or paste product text first.', 'error');
                        return;
                    }

                    try {
                        importBtn.disabled = true;
                        setStatus('Importing products...');

                        const payload = file
                            ? {
                                fileName: file.name,
                                base64: await readSelectedFile(file)
                            }
                            : {
                                fileName: 'products.txt',
                                text: pastedText
                            };

                        const result = await authedRequest('/api/products/import', {
                            method: 'POST',
                            body: payload
                        });

                        setStatus(`Imported ${result.imported || 0} products successfully.`);
                        if (fileInput) fileInput.value = '';
                        if (textInput) textInput.value = '';
                        await loadRecords();
                    } catch (error) {
                        setStatus(error.message || 'Import failed.', 'error');
                    } finally {
                        importBtn.disabled = false;
                    }
                });
            }
        }
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
            <section class="logo-upload-panel">
                <div class="logo-upload-copy">
                    <h3>Business Logo</h3>
                    <p class="muted">Upload a PNG or JPEG logo for your business profile.</p>
                </div>
                <div class="logo-upload-controls">
                    <div id="settingsLogoPreview" class="logo-preview empty-state">No logo uploaded</div>
                    <input id="settingsLogoFile" type="file" accept="image/png,image/jpeg">
                    <div class="actions">
                        <button class="btn btn-secondary" id="removeLogoBtn" type="button">Remove Logo</button>
                    </div>
                </div>
            </section>
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

    function renderLogoPreview(dataUrl) {
        const preview = document.getElementById('settingsLogoPreview');
        if (!preview) return;

        if (!dataUrl) {
            preview.className = 'logo-preview empty-state';
            preview.innerHTML = 'No logo uploaded';
            return;
        }

        preview.className = 'logo-preview';
        preview.innerHTML = `<img src="${escapeHtml(dataUrl)}" alt="Business logo preview">`;
    }

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
        state.settingsLogoDataUrl = tenant.business_logo || '';
        renderLogoPreview(state.settingsLogoDataUrl);

        const userId = getUserId();
        document.getElementById('leadFormLink').value = `${window.location.origin}/form?user=${encodeURIComponent(userId)}`;
    } catch (error) {
        notifyError(error);
    }

    document.getElementById('settingsLogoFile').addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['image/png', 'image/jpeg'];
        if (!allowedTypes.includes(file.type)) {
            notifyError(new Error('Please upload only PNG or JPEG logo files.'));
            event.target.value = '';
            return;
        }

        try {
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error('Failed to read logo file.'));
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });

            state.settingsLogoDataUrl = String(dataUrl || '');
            renderLogoPreview(state.settingsLogoDataUrl);
        } catch (error) {
            notifyError(error);
        }
    });

    document.getElementById('removeLogoBtn').addEventListener('click', () => {
        state.settingsLogoDataUrl = '';
        document.getElementById('settingsLogoFile').value = '';
        renderLogoPreview('');
    });

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
            instagramId: document.getElementById('settingInstagram').value.trim(),
            businessLogo: state.settingsLogoDataUrl
        };

        try {
            await authedRequest('/api/settings/profile', {
                method: 'PUT',
                body: payload
            });
            state.autoReplySetupCache = null;
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
    await openAutoReplySetupPrompt();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}
