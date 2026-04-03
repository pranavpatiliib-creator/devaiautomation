
const state = {
    token: null,
    activeModule: 'dashboard',
    channelsOAuthListenerBound: false,
    autoReplyPromptOpen: false,
    autoReplySetupCache: null,
    settingsLogoDataUrl: '',
    dashboardConfig: null,
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
    billing: 'Create Bill',
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

function formatReceiptDateTime(value) {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return '-';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day}/${month}/${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

function escapeAttribute(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
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
    if (text.includes('hotel') || text.includes('resort') || text.includes('lodge')) return 'hotel';
    if (text.includes('shop') || text.includes('store') || text.includes('retail') || text.includes('mobile')) return 'retail';
    if (text.includes('coach') || text.includes('tuition') || text.includes('class') || text.includes('education') || text.includes('training')) return 'coaching';
    return 'default';
}

function getDashboardConfigForProfession(professionKey) {
    const base = {
        professionKey,
        defaultModule: 'dashboard',
        enabledModules: [
            'dashboard',
            'customers',
            'conversations',
            'services',
            'offers',
            'products',
            'billing',
            'appointments',
            'leads',
            'posts',
            'knowledge-base',
            'channels',
            'settings'
        ],
        moduleLabels: {},
        moduleTitles: {},
        overviewStats: ['customers', 'conversations', 'leads', 'appointments'],
        dashboardWidgets: ['messagesChart', 'leadsChart', 'inventoryAlerts', 'salesSummary']
    };

    if (professionKey === 'salon') {
        return {
            ...base,
            defaultModule: 'appointments',
            enabledModules: [
                'dashboard',
                'customers',
                'conversations',
                'services',
                'offers',
                'appointments',
                'leads',
                'posts',
                'knowledge-base',
                'channels',
                'settings'
            ],
            moduleLabels: {
                appointments: 'Bookings',
                'knowledge-base': 'Auto Replies'
            },
            moduleTitles: {
                services: 'Services & Pricing',
                appointments: 'Bookings & Slots',
                'knowledge-base': 'Auto Replies Setup'
            },
            overviewStats: ['customers', 'conversations', 'leads', 'appointments']
        };
    }

    if (professionKey === 'clinic') {
        return {
            ...base,
            defaultModule: 'appointments',
            enabledModules: [
                'dashboard',
                'customers',
                'conversations',
                'services',
                'billing',
                'appointments',
                'leads',
                'knowledge-base',
                'channels',
                'settings'
            ],
            moduleLabels: {
                services: 'Treatments',
                billing: 'Billing',
                'knowledge-base': 'Auto Replies'
            },
            moduleTitles: {
                services: 'Treatments & Fees',
                billing: 'Billing',
                appointments: 'Appointments',
                'knowledge-base': 'Auto Replies Setup'
            },
            overviewStats: ['customers', 'conversations', 'leads', 'appointments']
        };
    }

    if (professionKey === 'restaurant') {
        return {
            ...base,
            defaultModule: 'billing',
            enabledModules: [
                'dashboard',
                'customers',
                'conversations',
                'products',
                'offers',
                'billing',
                'leads',
                'posts',
                'knowledge-base',
                'channels',
                'settings'
            ],
            moduleLabels: {
                products: 'Menu',
                billing: 'Billing',
                'knowledge-base': 'Auto Replies'
            },
            moduleTitles: {
                products: 'Menu Management',
                billing: 'Billing',
                'knowledge-base': 'Auto Replies Setup'
            },
            overviewStats: ['customers', 'conversations', 'leads'],
            dashboardWidgets: ['messagesChart', 'leadsChart', 'inventoryAlerts', 'salesSummary']
        };
    }

    if (professionKey === 'hotel') {
        return {
            ...base,
            defaultModule: 'appointments',
            enabledModules: [
                'dashboard',
                'customers',
                'conversations',
                'products',
                'offers',
                'billing',
                'appointments',
                'leads',
                'posts',
                'knowledge-base',
                'channels',
                'settings'
            ],
            moduleLabels: {
                products: 'Menu',
                appointments: 'Table Book',
                billing: 'Billing',
                'knowledge-base': 'Auto Replies'
            },
            moduleTitles: {
                products: 'Menu Management',
                appointments: 'Table Book',
                billing: 'Billing',
                'knowledge-base': 'Auto Replies Setup'
            },
            overviewStats: ['customers', 'conversations', 'leads', 'appointments'],
            dashboardWidgets: ['messagesChart', 'leadsChart', 'inventoryAlerts', 'salesSummary']
        };
    }

    if (professionKey === 'retail') {
        return {
            ...base,
            defaultModule: 'products',
            enabledModules: [
                'dashboard',
                'customers',
                'conversations',
                'products',
                'offers',
                'billing',
                'leads',
                'posts',
                'knowledge-base',
                'channels',
                'settings'
            ],
            moduleLabels: {
                products: 'Inventory',
                billing: 'Billing',
                'knowledge-base': 'Auto Replies'
            },
            moduleTitles: {
                products: 'Inventory Management',
                billing: 'Billing',
                'knowledge-base': 'Auto Replies Setup'
            },
            overviewStats: ['customers', 'conversations', 'leads'],
            dashboardWidgets: ['messagesChart', 'leadsChart', 'inventoryAlerts', 'salesSummary']
        };
    }

    if (professionKey === 'coaching') {
        return {
            ...base,
            defaultModule: 'leads',
            enabledModules: [
                'dashboard',
                'customers',
                'conversations',
                'services',
                'offers',
                'billing',
                'appointments',
                'leads',
                'posts',
                'knowledge-base',
                'channels',
                'settings'
            ],
            moduleLabels: {
                services: 'Programs',
                appointments: 'Batches',
                'knowledge-base': 'Auto Replies'
            },
            moduleTitles: {
                services: 'Programs & Pricing',
                appointments: 'Batches & Sessions',
                'knowledge-base': 'Auto Replies Setup'
            },
            overviewStats: ['customers', 'conversations', 'leads', 'appointments']
        };
    }

    return base;
}

function applyDashboardConfig(config) {
    state.dashboardConfig = config;

    const sidebar = document.getElementById('sidebarNav');
    if (sidebar) {
        sidebar.querySelectorAll('.nav-item').forEach((button) => {
            const moduleKey = button.dataset.module;
            const isEnabled = config.enabledModules.includes(moduleKey);
            button.style.display = isEnabled ? '' : 'none';
            if (isEnabled) {
                const label = config.moduleLabels[moduleKey];
                if (label) button.textContent = label;
            }
        });
    }

    Object.entries(config.moduleTitles || {}).forEach(([key, title]) => {
        moduleTitles[key] = title;
    });

    Object.entries(config.moduleLabels || {}).forEach(([key, label]) => {
        moduleTitles[key] = label;
    });

    if (!config.enabledModules.includes(state.activeModule)) {
        state.activeModule = config.defaultModule && config.enabledModules.includes(config.defaultModule)
            ? config.defaultModule
            : 'dashboard';
    }

    setModuleTitle(state.activeModule);
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

function renderSidebarLogoBadge() {
    const badge = document.getElementById('sidebarLogoBadge');
    if (!badge) return;

    if (state.settingsLogoDataUrl) {
        badge.innerHTML = `<img src="${escapeHtml(state.settingsLogoDataUrl)}" alt="Business logo">`;
        badge.classList.add('has-image');
        return;
    }

    badge.textContent = '+';
    badge.classList.remove('has-image');
}

async function loadLogoState() {
    try {
        const profile = await authedRequest('/api/settings/profile');
        state.settingsLogoDataUrl = profile?.tenant?.business_logo || '';
        renderSidebarLogoBadge();
    } catch (error) {
        console.error('Logo state load failed:', error);
    }
}

async function openLogoModal() {
    const modalHost = document.createElement('div');
    modalHost.className = 'setup-modal-backdrop';
    modalHost.innerHTML = `
        <div class="setup-modal" role="dialog" aria-modal="true" aria-labelledby="logoModalTitle">
            <h3 id="logoModalTitle">Business Logo</h3>
            <p>Upload a PNG or JPEG logo. This keeps the settings screen cleaner and lets you manage branding quickly.</p>
            <div id="logoModalPreview" class="logo-preview empty-state">No logo uploaded</div>
            <input id="logoModalFile" type="file" accept="image/png,image/jpeg">
            <div class="actions" style="margin-top:16px;">
                <button class="btn" id="saveLogoModalBtn" type="button">Save Logo</button>
                <button class="btn btn-secondary" id="removeLogoModalBtn" type="button">Remove</button>
                <button class="btn btn-secondary" id="closeLogoModalBtn" type="button">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modalHost);

    const preview = document.getElementById('logoModalPreview');
    const fileInput = document.getElementById('logoModalFile');
    let currentLogo = state.settingsLogoDataUrl || '';

    function renderPreview(dataUrl) {
        if (!preview) return;
        if (!dataUrl) {
            preview.className = 'logo-preview empty-state';
            preview.innerHTML = 'No logo uploaded';
            return;
        }

        preview.className = 'logo-preview';
        preview.innerHTML = `<img src="${escapeHtml(dataUrl)}" alt="Business logo preview">`;
    }

    renderPreview(currentLogo);

    const closeModal = () => {
        modalHost.remove();
    };

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!['image/png', 'image/jpeg'].includes(file.type)) {
            notifyError(new Error('Please upload only PNG or JPEG logo files.'));
            event.target.value = '';
            return;
        }

        try {
            currentLogo = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error('Failed to read logo file.'));
                reader.onload = () => resolve(String(reader.result || ''));
                reader.readAsDataURL(file);
            });
            renderPreview(currentLogo);
        } catch (error) {
            notifyError(error);
        }
    });

    document.getElementById('removeLogoModalBtn').addEventListener('click', () => {
        currentLogo = '';
        fileInput.value = '';
        renderPreview('');
    });

    document.getElementById('closeLogoModalBtn').addEventListener('click', closeModal);

    document.getElementById('saveLogoModalBtn').addEventListener('click', async () => {
        try {
            await authedRequest('/api/settings/profile', {
                method: 'PUT',
                body: {
                    businessLogo: currentLogo
                }
            });
            state.settingsLogoDataUrl = currentLogo;
            renderSidebarLogoBadge();
            notifySuccess('Logo updated successfully.');
            closeModal();
        } catch (error) {
            notifyError(error);
        }
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
        const professionKey = normalizeProfessionKey(profile?.tenant?.industry || profile?.user?.profession);
        applyDashboardConfig(getDashboardConfigForProfession(professionKey));
        state.settingsLogoDataUrl = profile?.tenant?.business_logo || '';
        renderSidebarLogoBadge();

        const businessEl = document.getElementById('businessTitle');
        const userEl = document.getElementById('userName');

        if (businessEl) businessEl.textContent = businessName;
        if (userEl) userEl.textContent = name;
        return profile;
    } catch (error) {
        console.error('Profile load failed:', error);
        return null;
    }
}

function bindGlobalEvents() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    const logoBtn = document.getElementById('openLogoModalBtn');
    if (logoBtn) {
        logoBtn.addEventListener('click', openLogoModal);
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
        billing: renderBillingModule,
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
    const overviewStats = state.dashboardConfig?.overviewStats || ['customers', 'conversations', 'leads', 'appointments'];
    const widgets = state.dashboardConfig?.dashboardWidgets || ['messagesChart', 'leadsChart', 'inventoryAlerts', 'salesSummary'];
    const statsHtml = [
        overviewStats.includes('customers')
            ? `<article class="stat-item"><label>Total Customers</label><strong id="statCustomers">0</strong></article>`
            : '',
        overviewStats.includes('conversations')
            ? `<article class="stat-item"><label>Total Conversations</label><strong id="statConversations">0</strong></article>`
            : '',
        overviewStats.includes('leads')
            ? `<article class="stat-item"><label>Total Leads</label><strong id="statLeads">0</strong></article>`
            : '',
        overviewStats.includes('appointments')
            ? `<article class="stat-item"><label>Upcoming Appointments</label><strong id="statAppointments">0</strong></article>`
            : ''
    ].filter(Boolean).join('');

    const kpiHtml = `
        <section class="card stack" ${widgets.includes('salesSummary') || widgets.includes('inventoryAlerts') ? '' : 'style="display:none;"'}>
            <h3 style="margin:0;">Quick Summary</h3>
            <div class="stats-grid" style="margin-top:12px;">
                ${widgets.includes('salesSummary')
        ? `
                    <article class="stat-item">
                        <label>Sales Today</label>
                        <strong id="kpiSalesToday">0</strong>
                    </article>
                    <article class="stat-item">
                        <label>Sales This Month</label>
                        <strong id="kpiSalesMonth">0</strong>
                    </article>
                  `
        : ''}
                ${widgets.includes('inventoryAlerts')
        ? `
                    <article class="stat-item">
                        <label>Out of Stock</label>
                        <strong id="kpiOutOfStock">0</strong>
                    </article>
                    <article class="stat-item">
                        <label>Low Stock</label>
                        <strong id="kpiLowStock">0</strong>
                    </article>
                  `
        : ''}
            </div>
        </section>
    `;

    setRootHtml(`
        <section class="card">
            <h2>Overview</h2>
            <div class="stats-grid">
                ${statsHtml}
            </div>
        </section>
        ${kpiHtml}
        <section class="chart-grid">
            <article class="card" ${widgets.includes('messagesChart') ? '' : 'style="display:none;"'}>
                <h3>Messages Per Day</h3>
                <canvas id="messagesChart" height="160"></canvas>
            </article>
            <article class="card" ${widgets.includes('leadsChart') ? '' : 'style="display:none;"'}>
                <h3>Leads Per Day</h3>
                <canvas id="leadsChart" height="160"></canvas>
            </article>
        </section>
    `);

    try {
        const overview = await authedRequest('/api/dashboard/overview');
        const totals = overview.totals || {};
        const charts = overview.charts || {};
        const extra = overview.extra || {};

        const customersEl = document.getElementById('statCustomers');
        const conversationsEl = document.getElementById('statConversations');
        const leadsEl = document.getElementById('statLeads');
        const appointmentsEl = document.getElementById('statAppointments');

        if (customersEl) customersEl.textContent = totals.customers || 0;
        if (conversationsEl) conversationsEl.textContent = totals.conversations || 0;
        if (leadsEl) leadsEl.textContent = totals.leads || 0;
        if (appointmentsEl) appointmentsEl.textContent = totals.upcomingAppointments || 0;

        const salesTodayEl = document.getElementById('kpiSalesToday');
        const salesMonthEl = document.getElementById('kpiSalesMonth');
        const outOfStockEl = document.getElementById('kpiOutOfStock');
        const lowStockEl = document.getElementById('kpiLowStock');

        if (salesTodayEl) salesTodayEl.textContent = Number(extra?.sales?.today || 0).toFixed(2);
        if (salesMonthEl) salesMonthEl.textContent = Number(extra?.sales?.month || 0).toFixed(2);
        if (outOfStockEl) outOfStockEl.textContent = extra?.inventory?.outOfStock ?? 0;
        if (lowStockEl) {
            const threshold = extra?.inventory?.lowStockThreshold ?? 5;
            lowStockEl.textContent = `${extra?.inventory?.lowStock ?? 0} (≤ ${threshold})`;
        }

        const msgPoints = charts.messagesPerDay || [];
        const leadPoints = charts.leadsPerDay || [];

        const messageCtx = document.getElementById('messagesChart');
        const leadCtx = document.getElementById('leadsChart');

        if (messageCtx) {
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
        }

        if (leadCtx) {
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
        }
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
        rowActions = () => '',
        onRenderFooter = () => '',
        onRecordsLoaded = null,
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
                if (typeof onRecordsLoaded === 'function') {
                    await onRecordsLoaded([]);
                }
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
                                ${rowActions(item)}
                                <button class="btn btn-danger" data-delete="${item.id}" type="button">Delete</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            if (typeof onRecordsLoaded === 'function') {
                await onRecordsLoaded(data.map(mapRow));
            }
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
        ],
        rowActions: (item) => {
            if (!item?.id || item?.is_active === false) return '';
            return `<button class="btn" data-publish-offer="${escapeHtml(item.id)}" type="button">Publish</button>`;
        },
        onReady: async ({ loadRecords }) => {
            const table = document.getElementById('recordsTable');
            if (!table) return;

            table.addEventListener('click', async (event) => {
                const publishBtn = event.target.closest('[data-publish-offer]');
                if (!publishBtn) return;

                const offerId = publishBtn.dataset.publishOffer;
                const confirmed = window.confirm('Publish this offer to Facebook and Instagram now?');
                if (!confirmed) return;

                const originalText = publishBtn.textContent;
                publishBtn.disabled = true;
                publishBtn.textContent = 'Publishing...';

                try {
                    await authedRequest(`/api/offers/${offerId}/publish`, { method: 'POST' });
                    notifySuccess('Offer queued for publishing. It should post in a few seconds.');
                    await loadRecords();
                } catch (error) {
                    notifyError(error);
                } finally {
                    publishBtn.disabled = false;
                    publishBtn.textContent = originalText;
                }
            });
        }
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
                <input id="postMediaUrl" class="wide" placeholder="Image URL (auto-filled after upload)">
                <input id="postMediaFile" type="file" accept="image/png,image/jpeg,image/webp" class="wide">
                <textarea id="postContent" class="wide" placeholder="Write your post caption or message"></textarea>
            </div>
            <div class="actions">
                <button class="btn btn-secondary" id="uploadPostMediaBtn" type="button">Upload Image</button>
                <button class="btn" id="savePostBtn" type="button">Save Draft / Schedule</button>
                <button class="btn btn-secondary" id="publishPostBtn" type="button">Publish Now</button>
                <button class="btn btn-secondary" id="resetPostBtn" type="button">Reset</button>
            </div>
        </section>
        <section class="card stack">
            <h3>Automatic Flyer</h3>
            <p class="muted">Generate a ready-to-post flyer image and caption using your OpenAI API key on the server.</p>
            <div class="form-grid">
                <input id="flyerHeadline" placeholder="Headline (e.g., Summer Offer)">
                <input id="flyerTheme" placeholder="Theme (e.g., minimal, premium, bright)">
                <input id="flyerSubheadline" class="wide" placeholder="Subheadline (optional)">
                <input id="flyerOffer" class="wide" placeholder="Offer / details (optional)">
                <input id="flyerCta" class="wide" placeholder="Call-to-action (optional)">
                <textarea id="flyerNotes" class="wide" placeholder="Extra notes (optional)"></textarea>
            </div>
            <div class="actions">
                <button class="btn" id="generateFlyerBtn" type="button">Generate Flyer</button>
                <button class="btn btn-secondary" id="useFlyerBtn" type="button" disabled>Use Flyer in Post</button>
                <a class="btn btn-secondary" id="downloadFlyerBtn" href="#" download="flyer.png" style="display:none">Download PNG</a>
            </div>
            <div id="flyerPreview" class="empty-state">No flyer generated yet.</div>
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
    const flyerPreview = document.getElementById('flyerPreview');
    const useFlyerBtn = document.getElementById('useFlyerBtn');
    const downloadFlyerBtn = document.getElementById('downloadFlyerBtn');
    let latestFlyer = null;

    function resetPostForm() {
        document.getElementById('postId').value = '';
        document.getElementById('postPlatform').value = 'facebook';
        document.getElementById('postScheduleAt').value = '';
        document.getElementById('postMediaUrl').value = '';
        document.getElementById('postMediaFile').value = '';
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

    function collectFlyerPayload() {
        return {
            headline: document.getElementById('flyerHeadline').value.trim(),
            theme: document.getElementById('flyerTheme').value.trim(),
            subheadline: document.getElementById('flyerSubheadline').value.trim(),
            offer: document.getElementById('flyerOffer').value.trim(),
            cta: document.getElementById('flyerCta').value.trim(),
            notes: document.getElementById('flyerNotes').value.trim()
        };
    }

    function setFlyerState(flyer) {
        latestFlyer = flyer;
        if (!flyer?.image_url) {
            flyerPreview.innerHTML = 'No flyer generated yet.';
            useFlyerBtn.disabled = true;
            downloadFlyerBtn.style.display = 'none';
            downloadFlyerBtn.href = '#';
            return;
        }

        const imageSrc = `${flyer.image_url}?v=${Date.now()}`;
        flyerPreview.innerHTML = `
            <div class="stack">
                <img src="${escapeHtml(imageSrc)}" alt="Generated flyer" style="max-width: 360px; width: 100%; border-radius: 12px;">
                ${flyer.caption ? `<pre style="white-space: pre-wrap; margin: 0;" class="muted">${escapeHtml(flyer.caption)}</pre>` : ''}
            </div>
        `;
        useFlyerBtn.disabled = false;
        downloadFlyerBtn.style.display = 'inline-flex';
        downloadFlyerBtn.href = flyer.image_url;
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

    document.getElementById('uploadPostMediaBtn').addEventListener('click', async () => {
        const fileInput = document.getElementById('postMediaFile');
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
            notifyError(new Error('Please choose an image file first.'));
            return;
        }

        try {
            const form = new FormData();
            form.append('file', file);

            const response = await fetch(`${window.location.origin}/api/posts/media`, {
                method: 'POST',
                body: form
            });

            const contentType = response.headers.get('content-type') || '';
            const payload = contentType.includes('application/json') ? await response.json() : { error: await response.text() };
            if (!response.ok) {
                throw new Error(payload?.error || `Upload failed (${response.status})`);
            }

            const absoluteUrl = `${window.location.origin}${payload.url}`;
            document.getElementById('postMediaUrl').value = absoluteUrl;
            notifySuccess('Image uploaded.');
        } catch (error) {
            notifyError(error);
        }
    });

    document.getElementById('resetPostBtn').addEventListener('click', resetPostForm);
    document.getElementById('refreshPostsBtn').addEventListener('click', loadPosts);
    document.getElementById('postStatusFilter').addEventListener('change', loadPosts);

    document.getElementById('generateFlyerBtn').addEventListener('click', async () => {
        try {
            useFlyerBtn.disabled = true;
            flyerPreview.innerHTML = '<div class="empty-state">Generating flyer…</div>';
            downloadFlyerBtn.style.display = 'none';
            const payload = collectFlyerPayload();
            const result = await authedRequest('/api/posts/flyer', { method: 'POST', body: payload });
            setFlyerState(result.flyer);
            notifySuccess('Flyer generated.');
        } catch (error) {
            setFlyerState(null);
            notifyError(error);
        }
    });

    useFlyerBtn.addEventListener('click', () => {
        if (!latestFlyer?.image_url) return;
        const absoluteUrl = `${window.location.origin}${latestFlyer.image_url}`;
        document.getElementById('postMediaUrl').value = absoluteUrl;
        if (latestFlyer.caption) {
            const current = document.getElementById('postContent').value.trim();
            document.getElementById('postContent').value = current ? `${current}\n\n${latestFlyer.caption}` : latestFlyer.caption;
        }
        notifySuccess('Flyer added to the post form.');
    });

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
    setFlyerState(null);
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
            { id: 'productBrand', key: 'brand_name', label: 'Brand Name' },
            { id: 'productCategory', key: 'category', label: 'Category' },
            { id: 'productPrice', key: 'price', label: 'Price', type: 'number' },
            { id: 'productStock', key: 'stock_quantity', label: 'No of Pcs', type: 'number' },
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
            { key: 'brand_name', label: 'Brand' },
            { key: 'category', label: 'Category' },
            { key: 'price', label: 'Price' },
            { key: 'stock_quantity', label: 'Pcs' },
            { key: 'updated_at', label: 'Updated', render: (row) => formatDate(row.updated_at || row.created_at) },
            { key: 'is_active', label: 'Status', render: (row) => row.is_active ? 'Active' : 'Inactive' }
        ],
        onRenderFooter: () => `
            <section class="card stack" style="margin-top:16px;">
                <h3 style="margin:0;">Products to be ordered</h3>
                <p class="muted">Automatically lists items with 0 pcs in stock.</p>
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Brand</th>
                                <th>Category</th>
                                <th>Pcs</th>
                                <th>Updated</th>
                            </tr>
                        </thead>
                        <tbody id="productsToOrderTable"></tbody>
                    </table>
                </div>
            </section>
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
        onRecordsLoaded: async (records) => {
            const table = document.getElementById('productsToOrderTable');
            if (!table) return;

            const outOfStock = (records || [])
                .filter((item) => Number(item.stock_quantity || 0) <= 0)
                .sort((a, b) => {
                    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
                    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
                    return bTime - aTime;
                });

            if (outOfStock.length === 0) {
                table.innerHTML = `<tr><td colspan="5"><div class="empty-state">No products pending order.</div></td></tr>`;
                return;
            }

            table.innerHTML = outOfStock.map((row) => `
                <tr>
                    <td>${escapeHtml(row.product_name || '-')}</td>
                    <td>${escapeHtml(row.brand_name || '-')}</td>
                    <td>${escapeHtml(row.category || '-')}</td>
                    <td>${escapeHtml(String(row.stock_quantity ?? 0))}</td>
                    <td>${escapeHtml(formatDate(row.updated_at || row.created_at))}</td>
                </tr>
            `).join('');
        },
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

async function renderBillingModule() {
    setRootHtml(`
        <section class="card stack">
            <h2>Create Bill</h2>
            <div class="form-grid">
                <input id="billCustomerName" placeholder="Customer Name">
                <input id="billMobileNumber" placeholder="Mobile Number">
                <select id="billPrintLayout">
                    <option value="a4" selected>A4</option>
                    <option value="a5">A5</option>
                    <option value="80">80mm Thermal</option>
                    <option value="58">58mm Thermal</option>
                    <option value="custom">Custom Width</option>
                </select>
                <input id="billCustomWidth" type="number" placeholder="Custom width (mm)" disabled>
            </div>
            <div class="toolbar">
                <input id="billDateTime" readonly>
                <input id="billGST" type="number" placeholder="GST %" value="0" step="0.01">
                <input id="billDiscount" type="number" placeholder="Discount %" value="0" step="0.01">
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Sr No</th>
                            <th>Product Name</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Total</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="billItemsTable"></tbody>
                </table>
            </div>
            <div class="actions">
                <button class="btn btn-secondary" id="addBillRowBtn" type="button">Add Item</button>
            </div>
            <div class="billing-summary">
                <span>Subtotal: <strong id="billSubtotal">0.00</strong></span>
                <span>Grand Total: <strong id="billGrandTotal">0.00</strong></span>
            </div>
            <div class="actions">
                <button class="btn" id="saveBillBtn" type="button">Save Bill</button>
                <button class="btn btn-secondary" id="printBillBtn" type="button">Print Bill</button>
                <button class="btn btn-secondary" id="downloadBillPdfBtn" type="button">Download PDF</button>
            </div>
        </section>
        <section class="card stack">
            <h3>Receipt Preview</h3>
            <div class="billing-preview-shell">
                <div id="billReceiptPreview" class="bill-receipt"></div>
            </div>
        </section>
        <section class="card stack">
            <div class="toolbar">
                <h3 style="margin:0;">Billing History</h3>
                <input id="billHistorySearch" placeholder="Search customer or mobile">
                <button class="btn btn-secondary" id="billHistoryRefreshBtn" type="button">Refresh</button>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Invoice</th>
                            <th>Customer</th>
                            <th>Mobile</th>
                            <th>Date</th>
                            <th>Total</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="billHistoryTable"></tbody>
                </table>
            </div>
        </section>
    `);

    const stateBilling = {
        items: [],
        savedBill: null,
        activeBillId: null,
        tenantProfile: await authedRequest('/api/settings/profile')
    };

    const itemsTable = document.getElementById('billItemsTable');
    const historyTable = document.getElementById('billHistoryTable');
    const preview = document.getElementById('billReceiptPreview');
    const dateTimeInput = document.getElementById('billDateTime');
    const gstInput = document.getElementById('billGST');
    const discountInput = document.getElementById('billDiscount');
    const printLayoutSelect = document.getElementById('billPrintLayout');
    const customWidthInput = document.getElementById('billCustomWidth');

    dateTimeInput.value = formatReceiptDateTime(new Date().toISOString());

    function getPrintLayoutConfig() {
        const value = printLayoutSelect.value;
        if (value === 'a4') return { key: 'a4', widthMm: 210, contentWidthMm: 190, letterheadMaxMm: 30 };
        if (value === 'a5') return { key: 'a5', widthMm: 148, contentWidthMm: 128, letterheadMaxMm: 24 };
        if (value === '80') return { key: '80', widthMm: 80, contentWidthMm: 72, letterheadMaxMm: 18 };
        if (value === '58') return { key: '58', widthMm: 58, contentWidthMm: 50, letterheadMaxMm: 16 };
        const widthMm = Math.max(40, Number(customWidthInput.value || 80));
        const letterheadMaxMm = widthMm >= 180 ? 30 : widthMm >= 120 ? 24 : widthMm >= 80 ? 18 : 16;
        return { key: 'custom', widthMm, contentWidthMm: Math.max(40, widthMm - 8), letterheadMaxMm };
    }

    function getReceiptWidthMm() {
        return getPrintLayoutConfig().widthMm;
    }

    function computeTotals() {
        const subtotal = stateBilling.items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.price) || 0)), 0);
        const gstPercent = Math.max(0, Number(gstInput.value || 0));
        const discountPercent = Math.max(0, Number(discountInput.value || 0));
        const gst = Number((subtotal * gstPercent / 100).toFixed(2));
        const discount = Number((subtotal * discountPercent / 100).toFixed(2));
        const grandTotal = Math.max(0, subtotal + gst - discount);
        document.getElementById('billSubtotal').textContent = subtotal.toFixed(2);
        document.getElementById('billGrandTotal').textContent = grandTotal.toFixed(2);
        return { subtotal, gstPercent, discountPercent, gst, discount, grandTotal };
    }

    function updateBillRowAmount(rowId) {
        const item = stateBilling.items.find((row) => row.id === rowId);
        const amountCell = itemsTable.querySelector(`[data-bill-line-total="${rowId}"]`);
        if (!item || !amountCell) return;
        amountCell.textContent = ((Number(item.quantity) || 0) * (Number(item.price) || 0)).toFixed(2);
    }

    function renderReceipt(billOverride = null) {
        const current = billOverride || {
            invoice_number: stateBilling.savedBill?.invoice_number || 'Preview',
            customer_name: document.getElementById('billCustomerName').value.trim(),
            mobile_number: document.getElementById('billMobileNumber').value.trim(),
            bill_datetime: new Date().toISOString(),
            items: stateBilling.items.map((item) => ({
                name: item.name,
                quantity: Number(item.quantity) || 0,
                price: Number(item.price) || 0,
                line_total: (Number(item.quantity) || 0) * (Number(item.price) || 0)
            })),
            subtotal: computeTotals().subtotal,
            gst_percent: computeTotals().gstPercent,
            gst_amount: computeTotals().gst,
            discount_percent: computeTotals().discountPercent,
            discount_amount: computeTotals().discount,
            grand_total: computeTotals().grandTotal,
            receipt_width_mm: getReceiptWidthMm()
        };

        const layout = getPrintLayoutConfig();
        preview.style.setProperty('--receipt-width-mm', `${layout.widthMm}mm`);
        preview.style.setProperty('--receipt-content-width-mm', `${layout.contentWidthMm}mm`);
        preview.style.setProperty('--receipt-letterhead-max-mm', `${layout.letterheadMaxMm}mm`);
        preview.innerHTML = `
            <div class="receipt-inner">
                <div class="receipt-invoice-top">Invoice No: ${escapeHtml(current.invoice_number)}</div>
                <div class="receipt-header">
                    <div class="receipt-header-logo">
                        ${stateBilling.tenantProfile?.tenant?.business_logo ? `<img class="receipt-logo" src="${escapeAttribute(stateBilling.tenantProfile.tenant.business_logo)}" alt="Logo">` : ''}
                    </div>
                    <div class="receipt-header-copy">
                        <h4>${escapeHtml(stateBilling.tenantProfile?.tenant?.business_name || 'Business')}</h4>
                        <p>${escapeHtml(stateBilling.tenantProfile?.tenant?.industry || '')}</p>
                        <p>${escapeHtml(stateBilling.tenantProfile?.user?.location || '')}</p>
                        <p>${escapeHtml(stateBilling.tenantProfile?.tenant?.whatsapp_number || '')}</p>
                        <p>${escapeHtml(formatReceiptDateTime(current.bill_datetime))}</p>
                    </div>
                </div>
                <div class="receipt-rule"></div>
                <div class="receipt-customer-block">
                    <p>Customer: ${escapeHtml(current.customer_name || '-')}</p>
                    ${current.mobile_number ? `<p>Mobile: ${escapeHtml(current.mobile_number)}</p>` : ''}
                </div>
                <div class="receipt-rule"></div>
                <table class="receipt-items-table">
                    <thead>
                        <tr>
                            <th>Sr</th>
                            <th>Product Name</th>
                            <th>Qty</th>
                            <th>Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(current.items || []).map((item, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${escapeHtml(item.name || '-')}</td>
                                <td>${escapeHtml(item.quantity)}</td>
                                <td>${escapeHtml(Number(item.price || 0).toFixed(2))}</td>
                                <td>${escapeHtml(Number(item.line_total || 0).toFixed(2))}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="receipt-rule"></div>
                <p class="receipt-row"><span>Subtotal</span><strong>${Number(current.subtotal || 0).toFixed(2)}</strong></p>
                <p class="receipt-row"><span>GST (${Number(current.gst_percent || 0).toFixed(2)}%)</span><strong>${Number(current.gst_amount || 0).toFixed(2)}</strong></p>
                <p class="receipt-row"><span>Discount (${Number(current.discount_percent || 0).toFixed(2)}%)</span><strong>${Number(current.discount_amount || 0).toFixed(2)}</strong></p>
                <p class="receipt-row grand"><span>Grand Total</span><strong>${Number(current.grand_total || 0).toFixed(2)}</strong></p>
                <div class="receipt-signature">
                    <span>Authorized Signatory</span>
                </div>
            </div>
        `;
    }

    async function fetchCatalog(query) {
        if (!query || query.trim().length < 1) return [];
        return authedRequest(`/api/billing/catalog${buildQuery({ q: query.trim() })}`);
    }

    async function buildSuggestions(input, rowId) {
        const list = input.parentElement.querySelector('.billing-suggestions');
        if (!list) return;
        const results = await fetchCatalog(input.value);
        if (!results.length) {
            list.innerHTML = '';
            list.style.display = 'none';
            return;
        }

        list.innerHTML = results.map((item) => `
            <button type="button" class="billing-suggestion" data-row-id="${rowId}" data-name="${escapeAttribute(item.name)}" data-price="${escapeAttribute(item.price)}" data-ref-type="${escapeAttribute(item.type || '')}" data-ref-id="${escapeAttribute(item.id || '')}" data-stock="${escapeAttribute(item.stock_quantity ?? '')}">
                <span>${escapeHtml(item.name)}</span>
                <span>${escapeHtml(Number(item.price || 0).toFixed(2))}</span>
            </button>
        `).join('');
        list.style.display = 'block';
    }

    function applySuggestion(rowId, name, price, refType = '', refId = '', stockQuantity = null) {
        const item = stateBilling.items.find((row) => row.id === rowId);
        if (!item) return;
        item.name = name;
        item.price = Number(price || 0);
        item.quantity = item.quantity || 1;
        item.ref_type = refType || null;
        item.ref_id = refId || null;
        item.max_stock = refType === 'product' && stockQuantity !== null && stockQuantity !== '' ? Number(stockQuantity) : null;
        if (item.max_stock !== null && Number(item.quantity || 1) > item.max_stock) {
            item.quantity = Math.max(1, item.max_stock);
        }
        renderItems();
    }

    function renderItems() {
        if (!stateBilling.items.length) {
            itemsTable.innerHTML = '<tr><td colspan="5"><div class="empty-state">Add products or services to start the bill.</div></td></tr>';
            renderReceipt();
            return;
        }

        itemsTable.innerHTML = stateBilling.items.map((item) => `
            <tr>
                <td class="billing-col-serial">${stateBilling.items.findIndex((row) => row.id === item.id) + 1}</td>
                <td class="billing-col-name">
                    <div class="billing-autocomplete">
                        <input data-bill-name="${item.id}" value="${escapeAttribute(item.name)}" placeholder="Type product or service">
                        <div class="billing-suggestions"></div>
                    </div>
                </td>
                <td class="billing-col-qty"><input data-bill-qty="${item.id}" type="number" min="1" ${item.ref_type === 'product' && Number.isFinite(item.max_stock) && item.max_stock !== null ? `max="${escapeAttribute(item.max_stock)}"` : ''} step="1" inputmode="numeric" value="${escapeAttribute(item.quantity)}"></td>
                <td class="billing-col-price"><input data-bill-price="${item.id}" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeAttribute(item.price)}"></td>
                <td class="billing-col-total" data-bill-line-total="${item.id}">${((Number(item.quantity) || 0) * (Number(item.price) || 0)).toFixed(2)}</td>
                <td class="billing-col-action"><button class="btn btn-danger" data-bill-remove="${item.id}" type="button">Remove</button></td>
            </tr>
        `).join('');
        computeTotals();
        renderReceipt();
    }

    function addRow(data = {}) {
        stateBilling.items.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: data.name || '',
            quantity: data.quantity || 1,
            price: data.price || 0,
            ref_type: data.ref_type || null,
            ref_id: data.ref_id || null,
            max_stock: data.max_stock ?? null
        });
        renderItems();
    }

    function populateBillForm(bill) {
        stateBilling.savedBill = bill;
        stateBilling.activeBillId = bill.id || null;
        document.getElementById('billCustomerName').value = bill.customer_name || '';
        document.getElementById('billMobileNumber').value = bill.mobile_number || '';
        dateTimeInput.value = formatReceiptDateTime(bill.bill_datetime);
        gstInput.value = Number(bill.gst_percent || 0);
        discountInput.value = Number(bill.discount_percent || 0);
        const savedWidth = Number(bill.receipt_width_mm || 210);
        if (savedWidth === 210) {
            printLayoutSelect.value = 'a4';
            customWidthInput.value = '';
            customWidthInput.disabled = true;
        } else if (savedWidth === 148) {
            printLayoutSelect.value = 'a5';
            customWidthInput.value = '';
            customWidthInput.disabled = true;
        } else if (savedWidth === 80) {
            printLayoutSelect.value = '80';
            customWidthInput.value = '';
            customWidthInput.disabled = true;
        } else if (savedWidth === 58) {
            printLayoutSelect.value = '58';
            customWidthInput.value = '';
            customWidthInput.disabled = true;
        } else {
            printLayoutSelect.value = 'custom';
            customWidthInput.value = savedWidth;
            customWidthInput.disabled = false;
        }
        stateBilling.items = (bill.items || []).map((item) => ({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: item.name || '',
            quantity: Number(item.quantity || 1),
            price: Number(item.price || 0)
        }));
        renderItems();
        renderReceipt(bill);
    }

    function resetBillForm() {
        stateBilling.savedBill = null;
        stateBilling.activeBillId = null;
        document.getElementById('billCustomerName').value = '';
        document.getElementById('billMobileNumber').value = '';
        dateTimeInput.value = formatReceiptDateTime(new Date().toISOString());
        gstInput.value = 0;
        discountInput.value = 0;
        printLayoutSelect.value = 'a4';
        customWidthInput.value = '';
        customWidthInput.disabled = true;
        stateBilling.items = [];
        addRow();
    }

    async function loadHistory() {
        try {
            const search = document.getElementById('billHistorySearch').value.trim();
            const bills = await authedRequest(`/api/bills${buildQuery({ search })}`);
            if (!bills.length) {
                historyTable.innerHTML = '<tr><td colspan="6"><div class="empty-state">No bills found.</div></td></tr>';
                return;
            }

            historyTable.innerHTML = bills.map((bill) => `
                <tr>
                    <td>#${escapeHtml(bill.invoice_number)}</td>
                    <td>${escapeHtml(bill.customer_name || '-')}</td>
                    <td>${escapeHtml(bill.mobile_number || '-')}</td>
                    <td>${escapeHtml(formatReceiptDateTime(bill.bill_datetime))}</td>
                    <td>${escapeHtml(Number(bill.grand_total || 0).toFixed(2))}</td>
                    <td>
                        <div class="actions">
                            <button class="btn btn-secondary" data-bill-view="${bill.id}" type="button">View</button>
                            <button class="btn btn-secondary" data-bill-print="${bill.id}" type="button">Reprint</button>
                            <button class="btn btn-secondary" data-bill-pdf="${bill.id}" type="button">PDF</button>
                            <button class="btn btn-danger" data-bill-delete="${bill.id}" type="button">Delete</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            notifyError(error);
        }
    }

    async function saveBill() {
        try {
            const isEditing = Boolean(stateBilling.activeBillId);
            const totals = computeTotals();

            const stockIssue = (stateBilling.items || []).find((item) =>
                item.ref_type === 'product' &&
                Number.isFinite(item.max_stock) &&
                item.max_stock !== null &&
                (Number(item.quantity || 1) > Number(item.max_stock))
            );
            if (stockIssue) {
                notifyError(new Error(`Only ${stockIssue.max_stock} pcs available for "${stockIssue.name}".`));
                return null;
            }

            const payload = {
                customerName: document.getElementById('billCustomerName').value.trim(),
                mobileNumber: document.getElementById('billMobileNumber').value.trim(),
                items: stateBilling.items.map((item) => ({
                    name: item.name,
                    quantity: Number(item.quantity) || 1,
                    price: Number(item.price) || 0,
                    item_type: item.ref_type || undefined,
                    ref_id: item.ref_id || undefined
                })),
                gstPercent: totals.gstPercent,
                discountPercent: totals.discountPercent,
                receiptWidthMm: getReceiptWidthMm()
            };

            const bill = await authedRequest(stateBilling.activeBillId ? `/api/bills/${stateBilling.activeBillId}` : '/api/bills', {
                method: stateBilling.activeBillId ? 'PUT' : 'POST',
                body: payload
            });
            stateBilling.savedBill = bill;
            stateBilling.activeBillId = bill.id;
            renderReceipt(bill);
            notifySuccess(`Bill #${bill.invoice_number} ${isEditing ? 'updated' : 'saved'}.`);
            await loadHistory();
            return bill;
        } catch (error) {
            notifyError(error);
            return null;
        }
    }

    function printReceipt() {
        const layout = getPrintLayoutConfig();
        const pageSize = layout.key === 'a4' ? 'A4' : layout.key === 'a5' ? 'A5' : `${layout.widthMm}mm auto`;
        const rootVars = `--receipt-width-mm:${layout.widthMm}mm;--receipt-content-width-mm:${layout.contentWidthMm}mm;--receipt-letterhead-max-mm:${layout.letterheadMaxMm}mm;`;
        const html = `
<!doctype html>
<html><head><title>Print Bill</title>
<style>
@page { size: ${pageSize}; margin: 10mm; }
html,body{margin:0;padding:0;}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
/* Use the same receipt markup/styles as the on-screen preview */
.bill-receipt{${rootVars}}
@media print{
  .bill-receipt{border:none;box-shadow:none;}
}
</style>
<link rel="stylesheet" href="${window.location.origin}/css/dashboard.css">
</head><body>${preview.outerHTML}<script>window.print();</script></body></html>`;
        const popup = window.open('', 'print_bill', 'width=420,height=760');
        if (!popup) {
            notifyError(new Error('Popup blocked. Please allow popups to print.'));
            return;
        }
        popup.document.write(html);
        popup.document.close();
    }

    itemsTable.addEventListener('input', async (event) => {
        const nameInput = event.target.closest('[data-bill-name]');
        const qtyInput = event.target.closest('[data-bill-qty]');
        const priceInput = event.target.closest('[data-bill-price]');

        if (nameInput) {
            const item = stateBilling.items.find((row) => row.id === nameInput.dataset.billName);
            if (!item) return;
            item.name = nameInput.value;
            item.ref_type = null;
            item.ref_id = null;
            renderReceipt();
            await buildSuggestions(nameInput, item.id);
            return;
        }

        if (qtyInput) {
            const item = stateBilling.items.find((row) => row.id === qtyInput.dataset.billQty);
            if (!item) return;
            let parsedValue = Math.max(1, parseInt(qtyInput.value || '1', 10) || 1);
            if (item.ref_type === 'product' && Number.isFinite(item.max_stock) && item.max_stock !== null) {
                parsedValue = Math.min(parsedValue, Math.max(1, item.max_stock));
                if (String(parsedValue) !== String(qtyInput.value || '')) {
                    qtyInput.value = String(parsedValue);
                }
            }
            item.quantity = parsedValue;
            updateBillRowAmount(item.id);
            computeTotals();
            renderReceipt();
            return;
        }

        if (priceInput) {
            const item = stateBilling.items.find((row) => row.id === priceInput.dataset.billPrice);
            if (!item) return;
            const parsedValue = Math.max(0, Number(priceInput.value || 0));
            item.price = parsedValue;
            updateBillRowAmount(item.id);
            computeTotals();
            renderReceipt();
        }
    });

    itemsTable.addEventListener('click', async (event) => {
        const removeBtn = event.target.closest('[data-bill-remove]');
        const suggestionBtn = event.target.closest('.billing-suggestion');
        if (removeBtn) {
            stateBilling.items = stateBilling.items.filter((item) => item.id !== removeBtn.dataset.billRemove);
            renderItems();
            return;
        }
        if (suggestionBtn) {
            applySuggestion(
                suggestionBtn.dataset.rowId,
                suggestionBtn.dataset.name,
                suggestionBtn.dataset.price,
                suggestionBtn.dataset.refType,
                suggestionBtn.dataset.refId,
                suggestionBtn.dataset.stock
            );
        }
    });

    itemsTable.addEventListener('keydown', (event) => {
        const nameInput = event.target.closest('[data-bill-name]');
        if (!nameInput) return;
        const list = nameInput.parentElement.querySelector('.billing-suggestions');
        const suggestions = Array.from(list?.querySelectorAll('.billing-suggestion') || []);
        if (!suggestions.length) return;

        let currentIndex = suggestions.findIndex((button) => button.classList.contains('active'));

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            currentIndex = Math.min(suggestions.length - 1, currentIndex + 1);
            suggestions.forEach((button, index) => button.classList.toggle('active', index === currentIndex));
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            currentIndex = Math.max(0, currentIndex - 1);
            suggestions.forEach((button, index) => button.classList.toggle('active', index === currentIndex));
            return;
        }

        if (event.key === 'Enter' && currentIndex >= 0) {
            event.preventDefault();
            const selected = suggestions[currentIndex];
            applySuggestion(
                selected.dataset.rowId,
                selected.dataset.name,
                selected.dataset.price,
                selected.dataset.refType,
                selected.dataset.refId,
                selected.dataset.stock
            );
        }
    });

    [gstInput, discountInput, printLayoutSelect, customWidthInput, document.getElementById('billCustomerName'), document.getElementById('billMobileNumber')].forEach((el) => {
        el.addEventListener('input', () => {
            customWidthInput.disabled = printLayoutSelect.value !== 'custom';
            renderReceipt();
        });
    });

    document.getElementById('addBillRowBtn').addEventListener('click', () => addRow());
    document.getElementById('saveBillBtn').addEventListener('click', saveBill);
    document.getElementById('printBillBtn').addEventListener('click', async () => {
        const bill = stateBilling.savedBill || await saveBill();
        if (bill) {
            renderReceipt(bill);
            printReceipt();
        }
    });
    document.getElementById('downloadBillPdfBtn').addEventListener('click', async () => {
        const bill = stateBilling.savedBill || await saveBill();
        if (!bill) return;
        try {
            const blob = await API.download(`/api/bills/${bill.id}/pdf`, state.token);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `invoice_${bill.invoice_number}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            notifyError(error);
        }
    });
    document.getElementById('billHistoryRefreshBtn').addEventListener('click', loadHistory);
    document.getElementById('billHistorySearch').addEventListener('input', () => {
        window.clearTimeout(renderBillingModule.historyTimer);
        renderBillingModule.historyTimer = window.setTimeout(loadHistory, 250);
    });

    historyTable.addEventListener('click', async (event) => {
        const viewBtn = event.target.closest('[data-bill-view]');
        const printBtn = event.target.closest('[data-bill-print]');
        const pdfBtn = event.target.closest('[data-bill-pdf]');
        const deleteBtn = event.target.closest('[data-bill-delete]');
        if (viewBtn) {
            try {
                const bill = await authedRequest(`/api/bills/${viewBtn.dataset.billView}`);
                populateBillForm(bill);
            } catch (error) {
                notifyError(error);
            }
            return;
        }
        if (printBtn) {
            try {
                const bill = await authedRequest(`/api/bills/${printBtn.dataset.billPrint}`);
                populateBillForm(bill);
                printReceipt();
            } catch (error) {
                notifyError(error);
            }
            return;
        }
        if (pdfBtn) {
            try {
                const blob = await API.download(`/api/bills/${pdfBtn.dataset.billPdf}/pdf`, state.token);
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `invoice.pdf`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
            } catch (error) {
                notifyError(error);
            }
            return;
        }
        if (deleteBtn) {
            const confirmed = window.confirm('Delete this bill?');
            if (!confirmed) return;
            try {
                await authedRequest(`/api/bills/${deleteBtn.dataset.billDelete}`, {
                    method: 'DELETE'
                });
                if (stateBilling.activeBillId === deleteBtn.dataset.billDelete) {
                    resetBillForm();
                }
                notifySuccess('Bill deleted.');
                await loadHistory();
            } catch (error) {
                notifyError(error);
            }
        }
    });

    document.getElementById('saveBillBtn').insertAdjacentHTML('afterend', '<button class="btn btn-secondary" id="newBillBtn" type="button">New Bill</button>');
    document.getElementById('newBillBtn').addEventListener('click', resetBillForm);

    addRow();
    await loadHistory();
    renderReceipt();
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
        state.settingsLogoDataUrl = tenant.business_logo || '';
        renderSidebarLogoBadge();

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
    bindGlobalEvents();
    try {
        await loadProfileHeader();
    } catch (error) {
        window.location = '/login';
        return;
    }
    await loadLogoState();
    await switchModule(state.activeModule);
    await openAutoReplySetupPrompt();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}
