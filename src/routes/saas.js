
const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

const supabase = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const { connectionReadLimiter, connectionWriteLimiter } = require('../middleware/rateLimiter');
const { encryptSecret, decryptSecret, maskSecret } = require('../utils/secretCrypto');
const { generateFlyerAndSave } = require('../services/flyerService');
const logger = require('../utils/appLogger');

router.use(verifyToken, requireTenant);

function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function toNullableNumber(value) {
    if (value === '' || value === null || value === undefined) {
        return null;
    }

    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function toBoolean(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
        if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    }

    return Boolean(value);
}

function normalizeDate(dateValue, isEndOfDay = false) {
    if (!dateValue) return null;

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;

    if (isEndOfDay) {
        date.setHours(23, 59, 59, 999);
    } else {
        date.setHours(0, 0, 0, 0);
    }

    return date.toISOString();
}

function buildDailySeries(rows = [], days = 14) {
    const now = new Date();
    const labels = [];
    const counts = new Map();

    for (let offset = days - 1; offset >= 0; offset -= 1) {
        const date = new Date(now);
        date.setDate(now.getDate() - offset);
        const key = date.toISOString().slice(0, 10);
        labels.push(key);
        counts.set(key, 0);
    }

    for (const row of rows) {
        if (!row.created_at) continue;
        const key = new Date(row.created_at).toISOString().slice(0, 10);
        if (counts.has(key)) {
            counts.set(key, (counts.get(key) || 0) + 1);
        }
    }

    return labels.map((date) => ({
        date,
        count: counts.get(date) || 0
    }));
}

function formatReceiptDateTime(value) {
    const date = new Date(value || Date.now());
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day}/${month}/${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

function mmToPoints(mm) {
    return Number(mm || 80) * 2.834645669;
}

function resolveBillPageConfig(receiptWidthMm) {
    const widthMm = Number(receiptWidthMm || 210);
    if (widthMm === 210) {
        return { size: 'A4', pageWidthPt: 595.28, marginX: 28, logoFit: [70, 22] };
    }
    if (widthMm === 148) {
        return { size: 'A5', pageWidthPt: 419.53, marginX: 18, logoFit: [58, 18] };
    }
    return {
        size: [mmToPoints(widthMm), 841.89],
        pageWidthPt: mmToPoints(widthMm),
        marginX: 12,
        logoFit: widthMm <= 58 ? [42, 16] : [52, 18]
    };
}

function normalizeBillItems(items) {
    return (Array.isArray(items) ? items : [])
        .map((item) => {
            const name = String(item.name || item.product_name || item.productName || item.service_name || '').trim();
            const quantity = Math.max(1, toNumber(item.quantity, 1));
            const price = Math.max(0, toNullableNumber(item.price) ?? 0);
            const itemType = String(item.item_type || item.type || '').trim().toLowerCase();
            const refId = String(item.ref_id || item.refId || item.product_id || item.productId || item.service_id || item.serviceId || '').trim();
            return {
                name,
                quantity,
                price,
                line_total: Number((quantity * price).toFixed(2)),
                item_type: itemType || null,
                ref_id: refId || null
            };
        })
        .filter((item) => item.name);
}

async function resolveProductIdForBillItem(tenantId, item) {
    const explicitType = String(item?.item_type || '').toLowerCase();
    const refId = String(item?.ref_id || '').trim();
    if (explicitType === 'product' && refId) return refId;
    if (explicitType === 'service') return null;

    // Best-effort fallback: if user typed a product name manually, attempt to resolve it.
    const name = String(item?.name || '').trim();
    if (!name) return null;

    const { data, error } = await supabase
        .from('products')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('product_name', name)
        .limit(1)
        .maybeSingle();

    if (error) {
        if (isMissingTableError(error)) return null;
        throw error;
    }

    return data?.id || null;
}

async function buildProductStockDeltas(tenantId, items) {
    const deltas = new Map(); // productId -> qty (positive means deduct)

    for (const item of items || []) {
        const quantity = Math.max(1, toNumber(item?.quantity, 1));
        let productId = null;

        if (String(item?.item_type || '').toLowerCase() === 'product') {
            productId = String(item?.ref_id || '').trim() || null;
        }

        const itemType = String(item?.item_type || '').toLowerCase();
        if (!productId && !itemType) {
            productId = await resolveProductIdForBillItem(tenantId, item);
        }

        if (!productId) continue;

        deltas.set(productId, (deltas.get(productId) || 0) + quantity);
    }

    return deltas;
}

async function applyProductStockAdjustments({ tenantId, deltas }) {
    const productIds = Array.from(deltas.keys());
    if (productIds.length === 0) return;

    const { data, error } = await supabase
        .from('products')
        .select('id,product_name,stock_quantity')
        .eq('tenant_id', tenantId)
        .in('id', productIds);

    if (error) {
        if (isMissingTableError(error)) return;
        throw error;
    }

    const rows = data || [];
    const byId = new Map(rows.map((row) => [row.id, row]));

    const missing = productIds.filter((id) => !byId.has(id));
    if (missing.length) {
        const message = `Some products were not found for inventory deduction: ${missing.join(', ')}`;
        const err = new Error(message);
        err.status = 400;
        throw err;
    }

    for (const [productId, qty] of deltas.entries()) {
        const row = byId.get(productId);
        const current = Number(row?.stock_quantity || 0);
        const next = current - Number(qty || 0); // qty>0 deducts, qty<0 restores
        if (next < 0) {
            const name = row?.product_name ? `"${row.product_name}"` : productId;
            const err = new Error(`Insufficient stock for product ${name}. Available ${current}, required ${qty}.`);
            err.status = 400;
            throw err;
        }
    }

    const now = new Date().toISOString();
    for (const [productId, qty] of deltas.entries()) {
        const current = Number(byId.get(productId)?.stock_quantity || 0);
        const next = Math.max(0, current - Number(qty || 0));
        const { error: updateError } = await supabase
            .from('products')
            .update({ stock_quantity: next, updated_at: now })
            .eq('tenant_id', tenantId)
            .eq('id', productId);

        if (updateError) {
            if (isMissingTableError(updateError)) return;
            throw updateError;
        }
    }
}

async function getNextInvoiceNumber(tenantId) {
    const { data, error } = await supabase
        .from('bills')
        .select('invoice_number')
        .eq('tenant_id', tenantId)
        .order('invoice_number', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        if (isMissingTableError(error)) return 1;
        throw error;
    }

    return Number(data?.invoice_number || 0) + 1;
}

function renderBillPdf(doc, { tenant, bill }) {
    const page = resolveBillPageConfig(bill.receipt_width_mm);
    const pageWidthPt = page.pageWidthPt;
    const marginX = page.marginX;
    const printableWidth = pageWidthPt - (marginX * 2);
    const logoWidth = page.logoFit[0];
    const headerGap = pageWidthPt < 300 ? 8 : 16;
    const copyX = marginX + logoWidth + headerGap;
    const copyWidth = Math.max(80, printableWidth - logoWidth - headerGap);
    let y = 18;

    if (tenant.business_logo && /^data:image\/(png|jpeg);base64,/.test(tenant.business_logo)) {
        try {
            const base64 = tenant.business_logo.split(',')[1];
            doc.image(Buffer.from(base64, 'base64'), marginX, y, { fit: page.logoFit, align: 'left' });
        } catch (_) {}
    }

    doc.fontSize(10).text(`Invoice No: ${bill.invoice_number}`, pageWidthPt - 180, y, { width: 152, align: 'right' });

    const metaLines = [
        tenant.business_name || 'Business',
        tenant.industry || '',
        tenant.location || '',
        tenant.whatsapp_number ? `Contact: ${tenant.whatsapp_number}` : '',
        formatReceiptDateTime(bill.bill_datetime)
    ].filter(Boolean);

    metaLines.forEach((line, index) => {
        doc.fontSize(index === 0 ? 16 : 9);
        doc.text(line, copyX, y, { width: copyWidth, align: 'center' });
        y += index === 0 ? 14 : 10;
    });

    y = Math.min(y, 84);
    y += 6;
    doc.moveTo(marginX, y).lineTo(pageWidthPt - marginX, y).strokeColor('#999').stroke();
    y += 8;

    doc.fontSize(10).text(`Customer: ${bill.customer_name || '-'}`, marginX, y, { width: printableWidth, align: 'left' });
    y += 10;
    if (bill.mobile_number) {
        doc.text(`Mobile: ${bill.mobile_number}`, marginX, y, { width: printableWidth, align: 'left' });
        y += 12;
    }

    const columns = {
        sr: marginX,
        name: marginX + 36,
        qty: pageWidthPt - 210,
        price: pageWidthPt - 150,
        total: pageWidthPt - 78
    };

    doc.fontSize(10).text('Sr', columns.sr, y, { width: 20 });
    doc.text('Product Name', columns.name, y, { width: 240 });
    doc.text('Qty', columns.qty, y, { width: 34, align: 'center' });
    doc.text('Price', columns.price, y, { width: 50, align: 'right' });
    doc.text('Total', columns.total, y, { width: 50, align: 'right' });
    y += 12;
    doc.moveTo(marginX, y).lineTo(pageWidthPt - marginX, y).strokeColor('#c9d3e7').stroke();
    y += 6;

    (bill.items || []).forEach((item, index) => {
        doc.fontSize(10).text(String(index + 1), columns.sr, y, { width: 20, align: 'center' });
        doc.text(item.name, columns.name, y, { width: 240 });
        doc.text(String(item.quantity), columns.qty, y, { width: 34, align: 'center' });
        doc.text(item.price.toFixed(2), columns.price, y, { width: 50, align: 'right' });
        doc.text(item.line_total.toFixed(2), columns.total, y, { width: 50, align: 'right' });
        y += 14;
    });

    y += 4;
    doc.moveTo(marginX, y).lineTo(pageWidthPt - marginX, y).strokeColor('#999').stroke();
    y += 8;
    [
        ['Subtotal', Number(bill.subtotal || 0)],
        [`GST (${Number(bill.gst_percent || 0).toFixed(2)}%)`, Number(bill.gst_amount || 0)],
        [`Discount (${Number(bill.discount_percent || 0).toFixed(2)}%)`, Number(bill.discount_amount || 0)],
        ['Grand Total', Number(bill.grand_total || 0)]
    ].forEach(([label, amount]) => {
        doc.fontSize(label === 'Grand Total' ? 11 : 10).text(label, marginX, y, { width: printableWidth / 2 });
        doc.text(amount.toFixed(2), pageWidthPt / 2, y, { width: printableWidth / 2, align: 'right' });
        y += label === 'Grand Total' ? 13 : 11;
    });

    y += 22;
    doc.moveTo(pageWidthPt - 190, y).lineTo(pageWidthPt - 28, y).strokeColor('#666').stroke();
    y += 6;
    doc.fontSize(10).text('Authorized Signatory', pageWidthPt - 190, y, { width: 162, align: 'center' });
}

function safeJsonError(res, error, message) {
    console.error(message, error);
    return res.status(500).json({ error: message });
}

function isMissingTableError(error) {
    return error?.code === 'PGRST205';
}

function isMissingColumnError(error, columnName = '') {
    if (error?.code !== '42703') return false;
    if (!columnName) return true;
    return String(error.message || '').includes(columnName);
}

function isMissingRelationError(error) {
    return error?.code === 'PGRST200';
}

function sanitizeSearch(value) {
    return String(value || '')
        .replace(/[^a-zA-Z0-9@._+\-\s]/g, ' ')
        .trim();
}

function normalizeImportHeader(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function readWorksheetRows({ fileName, base64, text }) {
    const lowerName = String(fileName || '').toLowerCase();

    if (text) {
        const workbook = XLSX.read(text, { type: 'string' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
    }

    if (!base64) {
        throw new Error('Missing import file content');
    }

    const buffer = Buffer.from(base64, 'base64');
    const workbook = lowerName.endsWith('.csv')
        ? XLSX.read(buffer.toString('utf8'), { type: 'string' })
        : XLSX.read(buffer, { type: 'buffer' });

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
}

function parseTextProducts(text) {
    return String(text || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const parts = line.split('|').map((item) => item.trim());
            return {
                product_name: parts[0] || '',
                category: parts[1] || '',
                price: parts[2] || '',
                stock_quantity: parts[3] || '',
                description: parts.slice(4).join(' | ')
            };
        })
        .filter((row) => row.product_name);
}

function mapImportedProduct(row) {
    const normalized = {};
    Object.entries(row || {}).forEach(([key, value]) => {
        normalized[normalizeImportHeader(key)] = value;
    });

    const productName = String(
        normalized.product_name
        || normalized.product
        || normalized.name
        || normalized.item_name
        || ''
    ).trim();

    if (!productName) return null;

    return {
        product_name: productName,
        category: String(normalized.category || normalized.type || '').trim() || null,
        description: String(normalized.description || normalized.details || '').trim() || null,
        price: toNullableNumber(normalized.price ?? normalized.amount ?? normalized.rate),
        stock_quantity: toNumber(normalized.stock_quantity ?? normalized.stock ?? normalized.qty ?? normalized.quantity, 0),
        is_active: toBoolean(normalized.is_active ?? normalized.active ?? true, true)
    };
}

function mapRuleRow(row) {
    return {
        id: row.id,
        keyword: row.trigger_value ?? row.keyword ?? '',
        replyMessage: row.reply ?? row.reply_message ?? '',
        priority: row.priority || 1,
        created_at: row.created_at
    };
}

function mapConnectionRow(row) {
    const token = decryptSecret(row.access_token);
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : null;

    return {
        id: row.id,
        channel: row.channel,
        page_id: row.page_id,
        phone_number: row.phone_number,
        is_active: row.is_active !== false,
        has_token: Boolean(row.access_token),
        token_preview: token ? maskSecret(token) : '',
        profile: metadata,
        created_at: row.created_at
    };
}

async function getCountForTenant(tableName, tenantId, queryBuilder = null) {
    let query = supabase
        .from(tableName)
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

    if (typeof queryBuilder === 'function') {
        query = queryBuilder(query);
    }

    const { count, error } = await query;
    if (error) {
        if (isMissingTableError(error)) return 0;
        throw error;
    }

    return count || 0;
}

async function getChartRows(tableName, tenantId, since) {
    const { data, error } = await supabase
        .from(tableName)
        .select('created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', since)
        .order('created_at', { ascending: true });

    if (error) {
        if (isMissingTableError(error)) return [];
        throw error;
    }

    return data || [];
}

async function getOutOfStockCount(tenantId) {
    const { count, error } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .lte('stock_quantity', 0);

    if (error) {
        if (isMissingTableError(error)) return 0;
        throw error;
    }

    return count || 0;
}

async function getLowStockCount(tenantId, threshold = 5) {
    const limit = Math.max(1, toNumber(threshold, 5));
    const { count, error } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gt('stock_quantity', 0)
        .lte('stock_quantity', limit);

    if (error) {
        if (isMissingTableError(error)) return 0;
        throw error;
    }

    return count || 0;
}

async function getSalesTotalBetween(tenantId, startIso, endIso) {
    let query = supabase
        .from('bills')
        .select('grand_total,bill_datetime')
        .eq('tenant_id', tenantId);

    if (startIso) query = query.gte('bill_datetime', startIso);
    if (endIso) query = query.lt('bill_datetime', endIso);

    const { data, error } = await query;
    if (error) {
        if (isMissingTableError(error)) return 0;
        throw error;
    }

    return Number((data || []).reduce((sum, row) => sum + Number(row.grand_total || 0), 0).toFixed(2));
}

router.get('/me', async (req, res) => {
    try {
        let { data: user, error } = await supabase
            .from('users')
            .select('id,name,email,profession,business_name,business_phone,location,services,website')
            .eq('id', req.user.id)
            .maybeSingle();

        if (error && isMissingColumnError(error)) {
            ({ data: user, error } = await supabase
                .from('users')
                .select('id,name,email,profession,business_name,business_phone,location')
                .eq('id', req.user.id)
                .maybeSingle());
            if (!error && user) {
                user.services = null;
                user.website = null;
            }
        }

        if (error) throw error;

        return res.json({
            user,
            tenant: {
                id: req.tenant.id,
                business_name: req.tenant.business_name,
                industry: req.tenant.industry,
                whatsapp_number: req.tenant.whatsapp_number,
                fb_page_id: req.tenant.fb_page_id,
                instagram_id: req.tenant.instagram_id,
                business_logo: req.tenant.business_logo || null
            }
        });
    } catch (error) {
        return safeJsonError(res, error, 'Failed to load profile');
    }
});

router.get('/dashboard/overview', async (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

        const since = thirtyDaysAgo.toISOString();
        const startOfToday = new Date(`${today}T00:00:00.000Z`).toISOString();
        const startOfTomorrow = new Date(Date.parse(startOfToday) + 24 * 60 * 60 * 1000).toISOString();
        const startOfMonth = new Date(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1).toISOString();

        const [
            totalCustomers,
            totalConversations,
            totalLeads,
            upcomingAppointments,
            conversationRows,
            leadRows,
            outOfStockCount,
            lowStockCount,
            salesToday,
            salesMonth
        ] = await Promise.all([
            getCountForTenant('customers', req.tenantId),
            getCountForTenant('conversations', req.tenantId),
            getCountForTenant('leads', req.tenantId),
            getCountForTenant('appointments', req.tenantId, (query) =>
                query
                    .gte('appointment_date', today)
                    .in('status', ['scheduled', 'confirmed', 'rescheduled'])
            ),
            getChartRows('conversations', req.tenantId, since),
            getChartRows('leads', req.tenantId, since),
            getOutOfStockCount(req.tenantId),
            getLowStockCount(req.tenantId, Number(process.env.LOW_STOCK_THRESHOLD) || 5),
            getSalesTotalBetween(req.tenantId, startOfToday, startOfTomorrow),
            getSalesTotalBetween(req.tenantId, startOfMonth, null)
        ]);

        return res.json({
            totals: {
                customers: totalCustomers,
                conversations: totalConversations,
                leads: totalLeads,
                upcomingAppointments
            },
            extra: {
                inventory: {
                    outOfStock: outOfStockCount,
                    lowStock: lowStockCount,
                    lowStockThreshold: Number(process.env.LOW_STOCK_THRESHOLD) || 5
                },
                sales: {
                    today: salesToday,
                    month: salesMonth
                }
            },
            charts: {
                messagesPerDay: buildDailySeries(conversationRows, 14),
                leadsPerDay: buildDailySeries(leadRows, 14)
            }
        });
    } catch (error) {
        return safeJsonError(res, error, 'Failed to load dashboard overview');
    }
});
router.get('/customers', async (req, res) => {
    try {
        const search = sanitizeSearch(req.query.search);
        const limit = Math.min(toNumber(req.query.limit, 100), 200);

        let query = supabase
            .from('customers')
            .select('id,name,phone,sender_id,channel,created_at')
            .eq('tenant_id', req.tenantId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (search) {
            query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,sender_id.ilike.%${search}%`);
        }

        const { data, error } = await query;
        if (error) {
            if (isMissingTableError(error)) return res.json([]);
            throw error;
        }

        return res.json(data || []);
    } catch (error) {
        return safeJsonError(res, error, 'Failed to load customers');
    }
});

router.get('/customers/:customerId/conversations', async (req, res) => {
    try {
        const { customerId } = req.params;

        const { data, error } = await supabase
            .from('conversations')
            .select('id,channel,message,direction,intent,created_at')
            .eq('tenant_id', req.tenantId)
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false })
            .limit(250);

        if (error) {
            if (isMissingTableError(error)) return res.json([]);
            throw error;
        }

        return res.json(data || []);
    } catch (error) {
        return safeJsonError(res, error, 'Failed to load conversation history');
    }
});

router.get('/conversations', async (req, res) => {
    try {
        const { channel, fromDate, toDate, customerId } = req.query;

        let query = supabase
            .from('conversations')
            .select('id,customer_id,channel,sender_id,message,direction,intent,created_at,customers(name,phone)')
            .eq('tenant_id', req.tenantId)
            .order('created_at', { ascending: false })
            .limit(500);

        if (channel && channel !== 'all') {
            query = query.eq('channel', channel);
        }

        const fromIso = normalizeDate(fromDate, false);
        const toIso = normalizeDate(toDate, true);

        if (fromIso) query = query.gte('created_at', fromIso);
        if (toIso) query = query.lte('created_at', toIso);
        if (customerId) query = query.eq('customer_id', customerId);

        let { data, error } = await query;
        if (error && isMissingRelationError(error)) {
            ({ data, error } = await supabase
                .from('conversations')
                .select('id,customer_id,channel,sender_id,message,direction,intent,created_at')
                .eq('tenant_id', req.tenantId)
                .order('created_at', { ascending: false })
                .limit(500));
        }
        if (error) {
            if (isMissingTableError(error)) return res.json([]);
            throw error;
        }

        return res.json(data || []);
    } catch (error) {
        return safeJsonError(res, error, 'Failed to load conversations');
    }
});

router.get('/services', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('services')
            .select('id,service_name,description,price,discount,created_at')
            .eq('tenant_id', req.tenantId)
            .order('created_at', { ascending: false });

        if (error) {
            if (isMissingTableError(error)) return res.json([]);
            throw error;
        }

        return res.json(data || []);
    } catch (error) {
        return safeJsonError(res, error, 'Failed to load services');
    }
});

router.post('/services', async (req, res) => {
    try {
        const serviceName = String(req.body.service_name || req.body.serviceName || '').trim();

        if (!serviceName) {
            return res.status(400).json({ error: 'Service name is required' });
        }

        const row = {
            tenant_id: req.tenantId,
            service_name: serviceName,
            description: req.body.description || null,
            price: toNullableNumber(req.body.price),
            discount: toNumber(req.body.discount, 0)
        };

        const { data, error } = await supabase
            .from('services')
            .insert(row)
            .select('id,service_name,description,price,discount,created_at')
            .single();

        if (error) throw error;

        return res.status(201).json(data);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'services table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to create service');
    }
});

router.put('/services/:id', async (req, res) => {
    try {
        const payload = {};

        if (req.body.service_name !== undefined || req.body.serviceName !== undefined) {
            payload.service_name = String(req.body.service_name || req.body.serviceName || '').trim();
        }
        if (req.body.description !== undefined) payload.description = req.body.description;
        if (req.body.price !== undefined) payload.price = toNullableNumber(req.body.price);
        if (req.body.discount !== undefined) payload.discount = toNumber(req.body.discount, 0);

        if (Object.keys(payload).length === 0) {
            return res.status(400).json({ error: 'No fields provided for update' });
        }

        const { data, error } = await supabase
            .from('services')
            .update(payload)
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .select('id,service_name,description,price,discount,created_at')
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Service not found' });

        return res.json(data);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'services table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to update service');
    }
});

router.delete('/services/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('services')
            .delete()
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId);

        if (error) throw error;

        return res.json({ success: true });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'services table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to delete service');
    }
});
router.get('/offers', async (req, res) => {
    try {
        let { data, error } = await supabase
            .from('offers')
            .select('id,title,description,discount,valid_until,is_active,created_at')
            .eq('tenant_id', req.tenantId)
            .order('created_at', { ascending: false });

        if (error && isMissingColumnError(error)) {
            ({ data, error } = await supabase
                .from('offers')
                .select('id,title,description,discount,valid_until,created_at')
                .eq('tenant_id', req.tenantId)
                .order('created_at', { ascending: false }));
            if (!error) {
                data = (data || []).map((row) => ({ ...row, is_active: true }));
            }
        }

        if (error) {
            if (isMissingTableError(error)) return res.json([]);
            throw error;
        }

        return res.json(data || []);
    } catch (error) {
        return safeJsonError(res, error, 'Failed to load offers');
    }
});

router.post('/offers', async (req, res) => {
    try {
        const title = String(req.body.title || '').trim();
        if (!title) {
            return res.status(400).json({ error: 'Offer title is required' });
        }

        const row = {
            tenant_id: req.tenantId,
            title,
            description: req.body.description || null,
            discount: toNullableNumber(req.body.discount),
            valid_until: req.body.valid_until || req.body.validUntil || null,
            is_active: toBoolean(req.body.is_active, true)
        };

        let { data, error } = await supabase
            .from('offers')
            .insert(row)
            .select('id,title,description,discount,valid_until,is_active,created_at')
            .single();

        if (error && isMissingColumnError(error, 'is_active')) {
            const fallbackRow = { ...row };
            delete fallbackRow.is_active;
            ({ data, error } = await supabase
                .from('offers')
                .insert(fallbackRow)
                .select('id,title,description,discount,valid_until,created_at')
                .single());
            if (!error && data) {
                data.is_active = true;
            }
        }

        if (error) throw error;

        return res.status(201).json(data);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'offers table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to create offer');
    }
});

router.put('/offers/:id', async (req, res) => {
    try {
        const payload = {};

        if (req.body.title !== undefined) payload.title = String(req.body.title || '').trim();
        if (req.body.description !== undefined) payload.description = req.body.description;
        if (req.body.discount !== undefined) payload.discount = toNullableNumber(req.body.discount);
        if (req.body.valid_until !== undefined || req.body.validUntil !== undefined) {
            payload.valid_until = req.body.valid_until || req.body.validUntil || null;
        }
        if (req.body.is_active !== undefined) payload.is_active = toBoolean(req.body.is_active, true);

        if (Object.keys(payload).length === 0) {
            return res.status(400).json({ error: 'No fields provided for update' });
        }

        let { data, error } = await supabase
            .from('offers')
            .update(payload)
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .select('id,title,description,discount,valid_until,is_active,created_at')
            .maybeSingle();

        if (error && isMissingColumnError(error, 'is_active')) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.is_active;
            ({ data, error } = await supabase
                .from('offers')
                .update(fallbackPayload)
                .eq('id', req.params.id)
                .eq('tenant_id', req.tenantId)
                .select('id,title,description,discount,valid_until,created_at')
                .maybeSingle());
            if (!error && data) {
                data.is_active = true;
            }
        }

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Offer not found' });

        return res.json(data);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'offers table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to update offer');
    }
});

router.delete('/offers/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('offers')
            .delete()
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId);

        if (error) throw error;

        return res.json({ success: true });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'offers table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to delete offer');
    }
});

router.post('/offers/:id/publish', async (req, res) => {
    try {
        const offerId = req.params.id;
        const { data: offer, error } = await supabase
            .from('offers')
            .select('id,title,description,discount,valid_until,is_active,created_at')
            .eq('tenant_id', req.tenantId)
            .eq('id', offerId)
            .maybeSingle();

        if (error) {
            if (isMissingTableError(error)) {
                return res.status(503).json({ error: 'offers table is missing. Run schema migration.' });
            }
            throw error;
        }
        if (!offer) return res.status(404).json({ error: 'Offer not found' });
        if (offer.is_active === false) return res.status(400).json({ error: 'Offer is inactive' });

        const discountLine = offer.discount ? `${offer.discount}% OFF` : '';
        const validLine = offer.valid_until ? `Valid until: ${String(offer.valid_until).slice(0, 10)}` : '';
        const offerLines = [discountLine, validLine].filter(Boolean).join(' • ');

        const flyer = await generateFlyerAndSave({
            tenant: req.tenant,
            flyer: {
                headline: offer.title,
                subheadline: offerLines,
                offer: offer.description || offerLines,
                theme: req.tenant?.industry || ''
            }
        });

        const caption = (flyer.caption || '').trim() || `${offer.title}\n${offerLines}\nDM us to book now.`;
        const mediaUrls = flyer.image_url ? [flyer.image_url] : null;
        const nowIso = new Date().toISOString();

        const { data: created, error: createError } = await supabase
            .from('social_posts')
            .insert([
                {
                    tenant_id: req.tenantId,
                    platform: 'facebook',
                    content: caption,
                    media_urls: mediaUrls,
                    status: 'scheduled',
                    scheduled_at: nowIso,
                    updated_at: nowIso
                },
                {
                    tenant_id: req.tenantId,
                    platform: 'instagram',
                    content: caption,
                    media_urls: mediaUrls,
                    status: 'scheduled',
                    scheduled_at: nowIso,
                    updated_at: nowIso
                }
            ])
            .select('id,platform,status,scheduled_at')
            .order('scheduled_at', { ascending: true });

        if (createError) {
            if (isMissingTableError(createError)) {
                return res.status(503).json({ error: 'social_posts table is missing. Run schema migration.' });
            }
            throw createError;
        }

        await logger.logAutomation({
            tenantId: req.tenantId,
            workflowName: 'offer_publish',
            status: 'queued',
            payload: {
                offer_id: offerId,
                posts: (created || []).map((row) => ({ id: row.id, platform: row.platform }))
            }
        });

        return res.json({ success: true, posts: created || [] });
    } catch (error) {
        return safeJsonError(res, error, 'Failed to publish offer');
    }
});

router.get('/menu-options', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('menu_options')
            .select('id,title,action_type,action_value,position,created_at')
            .eq('tenant_id', req.tenantId)
            .order('position', { ascending: true });

        if (error) {
            if (isMissingTableError(error)) return res.json([]);
            throw error;
        }

        return res.json(data || []);
    } catch (error) {
        return safeJsonError(res, error, 'Failed to load menu options');
    }
});

router.post('/menu-options', async (req, res) => {
    try {
        const title = String(req.body.title || '').trim();
        const actionType = String(req.body.action_type || req.body.actionType || '').trim();

        if (!title || !actionType) {
            return res.status(400).json({ error: 'Menu title and action type are required' });
        }

        const row = {
            tenant_id: req.tenantId,
            title,
            action_type: actionType,
            action_value: req.body.action_value || req.body.actionValue || null,
            position: toNumber(req.body.position, 1)
        };

        const { data, error } = await supabase
            .from('menu_options')
            .insert(row)
            .select('id,title,action_type,action_value,position,created_at')
            .single();

        if (error) throw error;

        return res.status(201).json(data);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'menu_options table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to create menu option');
    }
});

router.put('/menu-options/:id', async (req, res) => {
    try {
        const payload = {};

        if (req.body.title !== undefined) payload.title = String(req.body.title || '').trim();
        if (req.body.action_type !== undefined || req.body.actionType !== undefined) {
            payload.action_type = String(req.body.action_type || req.body.actionType || '').trim();
        }
        if (req.body.action_value !== undefined || req.body.actionValue !== undefined) {
            payload.action_value = req.body.action_value || req.body.actionValue || null;
        }
        if (req.body.position !== undefined) payload.position = toNumber(req.body.position, 1);

        if (Object.keys(payload).length === 0) {
            return res.status(400).json({ error: 'No fields provided for update' });
        }

        const { data, error } = await supabase
            .from('menu_options')
            .update(payload)
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .select('id,title,action_type,action_value,position,created_at')
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Menu option not found' });

        return res.json(data);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'menu_options table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to update menu option');
    }
});

router.delete('/menu-options/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('menu_options')
            .delete()
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId);

        if (error) throw error;

        return res.json({ success: true });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'menu_options table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to delete menu option');
    }
});

router.get('/products', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('id,product_name,brand_name,category,description,price,stock_quantity,is_active,created_at,updated_at')
            .eq('tenant_id', req.tenantId)
            .order('created_at', { ascending: false });

        if (error) {
            if (isMissingTableError(error)) return res.json([]);
            throw error;
        }

        return res.json(data || []);
    } catch (error) {
        return safeJsonError(res, error, 'Failed to load products');
    }
});

router.post('/products', async (req, res) => {
    try {
        const productName = String(req.body.product_name || req.body.productName || '').trim();
        const brandName = String(req.body.brand_name || req.body.brandName || '').trim();
        const category = String(req.body.category || '').trim();
        const description = String(req.body.description || '').trim();

        if (!productName) {
            return res.status(400).json({ error: 'Product name is required' });
        }

        const { data, error } = await supabase
            .from('products')
            .insert({
                tenant_id: req.tenantId,
                product_name: productName,
                brand_name: brandName || null,
                category: category || null,
                description: description || null,
                price: toNullableNumber(req.body.price),
                stock_quantity: toNumber(req.body.stock_quantity ?? req.body.stockQuantity, 0),
                is_active: toBoolean(req.body.is_active ?? req.body.isActive, true),
                updated_at: new Date().toISOString()
            })
            .select('id,product_name,brand_name,category,description,price,stock_quantity,is_active,created_at,updated_at')
            .single();

        if (error) throw error;

        return res.status(201).json(data);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'products table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to create product');
    }
});

router.post('/products/import', async (req, res) => {
    try {
        const fileName = String(req.body.fileName || 'products.txt').trim();
        const rawRows = req.body.text
            ? parseTextProducts(req.body.text)
            : readWorksheetRows({
                fileName,
                base64: req.body.base64
            });

        const rows = rawRows
            .map(mapImportedProduct)
            .filter(Boolean)
            .map((row) => ({
                tenant_id: req.tenantId,
                ...row
            }));

        if (!rows.length) {
            return res.status(400).json({ error: 'No valid product rows found in the uploaded data' });
        }

        const { data, error } = await supabase
            .from('products')
            .insert(rows)
            .select('id');

        if (error) throw error;

        return res.json({
            success: true,
            imported: (data || []).length
        });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'products table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to import products');
    }
});

router.put('/products/:id', async (req, res) => {
    try {
        const payload = {};

        if (req.body.product_name !== undefined || req.body.productName !== undefined) {
            payload.product_name = String(req.body.product_name || req.body.productName || '').trim();
        }
        if (req.body.brand_name !== undefined || req.body.brandName !== undefined) {
            payload.brand_name = String(req.body.brand_name || req.body.brandName || '').trim() || null;
        }
        if (req.body.category !== undefined) payload.category = String(req.body.category || '').trim() || null;
        if (req.body.description !== undefined) payload.description = String(req.body.description || '').trim() || null;
        if (req.body.price !== undefined) payload.price = toNullableNumber(req.body.price);
        if (req.body.stock_quantity !== undefined || req.body.stockQuantity !== undefined) {
            payload.stock_quantity = toNumber(req.body.stock_quantity ?? req.body.stockQuantity, 0);
        }
        if (req.body.is_active !== undefined || req.body.isActive !== undefined) {
            payload.is_active = toBoolean(req.body.is_active ?? req.body.isActive, true);
        }

        if (Object.keys(payload).length === 0) {
            return res.status(400).json({ error: 'No fields provided for update' });
        }

        payload.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('products')
            .update(payload)
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .select('id,product_name,brand_name,category,description,price,stock_quantity,is_active,created_at,updated_at')
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Product not found' });

        return res.json(data);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'products table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to update product');
    }
});

router.delete('/products/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId);

        if (error) throw error;

        return res.json({ success: true });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'products table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to delete product');
    }
});

router.get('/billing/catalog', async (req, res) => {
    try {
        const q = sanitizeSearch(req.query.q || '');
        if (!q) return res.json([]);

        const [productsRes, servicesRes] = await Promise.all([
            supabase
                .from('products')
                .select('id,product_name,price,category,stock_quantity')
                .eq('tenant_id', req.tenantId)
                .eq('is_active', true)
                .ilike('product_name', `%${q}%`)
                .limit(8),
            supabase
                .from('services')
                .select('id,service_name,price')
                .eq('tenant_id', req.tenantId)
                .ilike('service_name', `%${q}%`)
                .limit(8)
        ]);

        const products = (productsRes.data || []).map((item) => ({
            id: item.id,
            type: 'product',
            name: item.product_name,
            price: Number(item.price || 0),
            category: item.category || '',
            stock_quantity: Number(item.stock_quantity || 0)
        }));
        const services = (servicesRes.data || []).map((item) => ({
            id: item.id,
            type: 'service',
            name: item.service_name,
            price: Number(item.price || 0),
            category: 'service'
        }));

        return res.json([...products, ...services].slice(0, 12));
    } catch (error) {
        return safeJsonError(res, error, 'Failed to load billing catalog');
    }
});

router.get('/bills', async (req, res) => {
    try {
        const search = sanitizeSearch(req.query.search || '');
        let query = supabase
            .from('bills')
            .select('id,invoice_number,customer_name,mobile_number,bill_datetime,grand_total,receipt_width_mm,created_at')
            .eq('tenant_id', req.tenantId)
            .order('invoice_number', { ascending: false });

        if (search) {
            query = query.or(`customer_name.ilike.%${search}%,mobile_number.ilike.%${search}%`);
        }

        const { data, error } = await query.limit(100);
        if (error) {
            if (isMissingTableError(error)) return res.json([]);
            throw error;
        }

        return res.json(data || []);
    } catch (error) {
        return safeJsonError(res, error, 'Failed to load bills');
    }
});

router.post('/bills', async (req, res) => {
    try {
        const items = normalizeBillItems(req.body.items);
        if (!items.length) {
            return res.status(400).json({ error: 'At least one bill item is required' });
        }

        const stockDeltas = await buildProductStockDeltas(req.tenantId, items);
        await applyProductStockAdjustments({ tenantId: req.tenantId, deltas: stockDeltas });

        const subtotal = Number(items.reduce((sum, item) => sum + item.line_total, 0).toFixed(2));
        const gstPercent = Math.max(0, toNullableNumber(req.body.gst_percent ?? req.body.gstPercent ?? req.body.gst_amount ?? req.body.gstAmount) ?? 0);
        const discountPercent = Math.max(0, toNullableNumber(req.body.discount_percent ?? req.body.discountPercent ?? req.body.discount_amount ?? req.body.discountAmount) ?? 0);
        const gstAmount = Number((subtotal * gstPercent / 100).toFixed(2));
        const discountAmount = Number((subtotal * discountPercent / 100).toFixed(2));
        const grandTotal = Number(Math.max(0, subtotal + gstAmount - discountAmount).toFixed(2));
        const invoiceNumber = await getNextInvoiceNumber(req.tenantId);

        const { data, error } = await supabase
            .from('bills')
            .insert({
                tenant_id: req.tenantId,
                invoice_number: invoiceNumber,
                customer_name: String(req.body.customer_name || req.body.customerName || '').trim() || null,
                mobile_number: String(req.body.mobile_number || req.body.mobileNumber || '').trim() || null,
                bill_datetime: req.body.bill_datetime || req.body.billDateTime || new Date().toISOString(),
                items,
                subtotal,
                gst_percent: gstPercent,
                gst_amount: gstAmount,
                discount_percent: discountPercent,
                discount_amount: discountAmount,
                grand_total: grandTotal,
                receipt_width_mm: toNullableNumber(req.body.receipt_width_mm ?? req.body.receiptWidthMm) ?? 80
            })
            .select('*')
            .single();

        if (error) throw error;
        return res.status(201).json(data);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'bills table is missing. Run schema migration.' });
        }
        if (error?.status) {
            return res.status(error.status).json({ error: error.message });
        }
        return safeJsonError(res, error, 'Failed to create bill');
    }
});

router.put('/bills/:id', async (req, res) => {
    try {
        const { data: existingBill, error: existingError } = await supabase
            .from('bills')
            .select('id,items')
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .maybeSingle();

        if (existingError) throw existingError;
        if (!existingBill) return res.status(404).json({ error: 'Bill not found' });

        const items = normalizeBillItems(req.body.items);
        if (!items.length) {
            return res.status(400).json({ error: 'At least one bill item is required' });
        }

        const oldItems = normalizeBillItems(existingBill.items);
        const oldDeltas = await buildProductStockDeltas(req.tenantId, oldItems);
        const newDeltas = await buildProductStockDeltas(req.tenantId, items);
        const adjustments = new Map();

        const allIds = new Set([...oldDeltas.keys(), ...newDeltas.keys()]);
        for (const productId of allIds) {
            const diff = (newDeltas.get(productId) || 0) - (oldDeltas.get(productId) || 0); // + deduct, - restore
            if (diff !== 0) adjustments.set(productId, diff);
        }

        await applyProductStockAdjustments({ tenantId: req.tenantId, deltas: adjustments });

        const subtotal = Number(items.reduce((sum, item) => sum + item.line_total, 0).toFixed(2));
        const gstPercent = Math.max(0, toNullableNumber(req.body.gst_percent ?? req.body.gstPercent ?? req.body.gst_amount ?? req.body.gstAmount) ?? 0);
        const discountPercent = Math.max(0, toNullableNumber(req.body.discount_percent ?? req.body.discountPercent ?? req.body.discount_amount ?? req.body.discountAmount) ?? 0);
        const gstAmount = Number((subtotal * gstPercent / 100).toFixed(2));
        const discountAmount = Number((subtotal * discountPercent / 100).toFixed(2));
        const grandTotal = Number(Math.max(0, subtotal + gstAmount - discountAmount).toFixed(2));

        const { data, error } = await supabase
            .from('bills')
            .update({
                customer_name: String(req.body.customer_name || req.body.customerName || '').trim() || null,
                mobile_number: String(req.body.mobile_number || req.body.mobileNumber || '').trim() || null,
                bill_datetime: req.body.bill_datetime || req.body.billDateTime || new Date().toISOString(),
                items,
                subtotal,
                gst_percent: gstPercent,
                gst_amount: gstAmount,
                discount_percent: discountPercent,
                discount_amount: discountAmount,
                grand_total: grandTotal,
                receipt_width_mm: toNullableNumber(req.body.receipt_width_mm ?? req.body.receiptWidthMm) ?? 80
            })
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .select('*')
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Bill not found' });

        return res.json(data);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'bills table is missing. Run schema migration.' });
        }
        if (error?.status) {
            return res.status(error.status).json({ error: error.message });
        }
        return safeJsonError(res, error, 'Failed to update bill');
    }
});

router.delete('/bills/:id', async (req, res) => {
    try {
        const { data: existingBill, error: existingError } = await supabase
            .from('bills')
            .select('id,items')
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .maybeSingle();

        if (existingError) throw existingError;
        if (!existingBill) return res.status(404).json({ error: 'Bill not found' });

        // Restore inventory for products that were billed.
        const oldItems = normalizeBillItems(existingBill.items);
        const deltas = await buildProductStockDeltas(req.tenantId, oldItems);
        const restore = new Map();
        for (const [productId, qty] of deltas.entries()) {
            restore.set(productId, -Math.max(1, toNumber(qty, 1)));
        }
        await applyProductStockAdjustments({ tenantId: req.tenantId, deltas: restore });

        const { error } = await supabase
            .from('bills')
            .delete()
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId);

        if (error) throw error;
        return res.json({ success: true });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'bills table is missing. Run schema migration.' });
        }
        if (error?.status) {
            return res.status(error.status).json({ error: error.message });
        }
        return safeJsonError(res, error, 'Failed to delete bill');
    }
});

router.get('/bills/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('bills')
            .select('*')
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Bill not found' });

        return res.json(data);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'bills table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to load bill');
    }
});

router.get('/bills/:id/pdf', async (req, res) => {
    try {
        const { data: user } = await supabase
            .from('users')
            .select('location')
            .eq('id', req.user.id)
            .maybeSingle();

        const { data: bill, error } = await supabase
            .from('bills')
            .select('*')
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .maybeSingle();

        if (error) throw error;
        if (!bill) return res.status(404).json({ error: 'Bill not found' });

        const page = resolveBillPageConfig(bill.receipt_width_mm);
        const doc = new PDFDocument({
            autoFirstPage: false,
            size: page.size,
            margin: 0
        });

        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => {
            const pdf = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=invoice_${bill.invoice_number}.pdf`);
            res.send(pdf);
        });

        doc.addPage({ size: page.size, margin: 0 });
        renderBillPdf(doc, {
            tenant: {
                ...req.tenant,
                location: user?.location || null
            },
            bill
        });
        doc.end();
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'bills table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to export bill PDF');
    }
});

router.get('/appointments', async (req, res) => {
    try {
        const { status, fromDate, toDate } = req.query;

        let query = supabase
            .from('appointments')
            .select('id,customer_id,service_id,appointment_date,appointment_time,status,notes,booking_source,created_at')
            .eq('tenant_id', req.tenantId)
            .order('appointment_date', { ascending: true })
            .order('appointment_time', { ascending: true });

        if (status) {
            query = query.eq('status', status);
        }

        const fromIso = normalizeDate(fromDate, false);
        const toIso = normalizeDate(toDate, true);

        if (fromIso) query = query.gte('appointment_date', fromIso.slice(0, 10));
        if (toIso) query = query.lte('appointment_date', toIso.slice(0, 10));

        let { data, error } = await query;
        if (error) {
            if (isMissingTableError(error)) return res.json([]);
            throw error;
        }

        const rows = data || [];
        if (!rows.length) {
            return res.json([]);
        }

        const customerIds = [...new Set(rows.map((row) => row.customer_id).filter(Boolean))];
        const serviceIds = [...new Set(rows.map((row) => row.service_id).filter(Boolean))];

        let customerMap = new Map();
        let serviceMap = new Map();

        if (customerIds.length > 0) {
            const { data: customers, error: customerError } = await supabase
                .from('customers')
                .select('id,name,phone')
                .in('id', customerIds);

            if (!customerError && customers) {
                customerMap = new Map(customers.map((item) => [item.id, item]));
            }
        }

        if (serviceIds.length > 0) {
            const { data: services, error: serviceError } = await supabase
                .from('services')
                .select('id,service_name')
                .in('id', serviceIds);

            if (!serviceError && services) {
                serviceMap = new Map(services.map((item) => [item.id, item]));
            }
        }

        const enriched = rows.map((row) => ({
            ...row,
            customers: row.customer_id ? customerMap.get(row.customer_id) || null : null,
            services: row.service_id ? serviceMap.get(row.service_id) || null : null
        }));

        return res.json(enriched);
    } catch (error) {
        return safeJsonError(res, error, 'Failed to load appointments');
    }
});

router.put('/appointments/:id', async (req, res) => {
    try {
        const payload = {};

        if (req.body.status !== undefined) payload.status = req.body.status;
        if (req.body.notes !== undefined) payload.notes = req.body.notes;
        if (req.body.appointment_date !== undefined || req.body.appointmentDate !== undefined) {
            payload.appointment_date = req.body.appointment_date || req.body.appointmentDate || null;
        }
        if (req.body.appointment_time !== undefined || req.body.appointmentTime !== undefined) {
            payload.appointment_time = req.body.appointment_time || req.body.appointmentTime || null;
        }

        if (Object.keys(payload).length === 0) {
            return res.status(400).json({ error: 'No fields provided for update' });
        }

        const { data, error } = await supabase
            .from('appointments')
            .update(payload)
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .select('id,customer_id,service_id,appointment_date,appointment_time,status,notes,booking_source,created_at')
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Appointment not found' });

        return res.json(data);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'appointments table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to update appointment');
    }
});

router.put('/appointments/:id/cancel', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .select('id,status')
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Appointment not found' });

        return res.json({ success: true, appointment: data });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'appointments table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to cancel appointment');
    }
});

router.get('/knowledge-base', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('knowledge_base')
            .select('id,question,answer,created_at')
            .eq('tenant_id', req.tenantId)
            .order('created_at', { ascending: false });

        if (error) {
            if (isMissingTableError(error)) return res.json([]);
            throw error;
        }

        return res.json(data || []);
    } catch (error) {
        return safeJsonError(res, error, 'Failed to load knowledge base');
    }
});

router.post('/knowledge-base', async (req, res) => {
    try {
        const question = String(req.body.question || '').trim();
        const answer = String(req.body.answer || '').trim();

        if (!question || !answer) {
            return res.status(400).json({ error: 'Question and answer are required' });
        }

        const { data, error } = await supabase
            .from('knowledge_base')
            .insert({
                tenant_id: req.tenantId,
                question,
                answer
            })
            .select('id,question,answer,created_at')
            .single();

        if (error) throw error;

        return res.status(201).json(data);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'knowledge_base table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to create knowledge base item');
    }
});

router.put('/knowledge-base/:id', async (req, res) => {
    try {
        const payload = {};

        if (req.body.question !== undefined) payload.question = String(req.body.question || '').trim();
        if (req.body.answer !== undefined) payload.answer = String(req.body.answer || '').trim();

        if (Object.keys(payload).length === 0) {
            return res.status(400).json({ error: 'No fields provided for update' });
        }

        const { data, error } = await supabase
            .from('knowledge_base')
            .update(payload)
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .select('id,question,answer,created_at')
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Knowledge base item not found' });

        return res.json(data);
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'knowledge_base table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to update knowledge base item');
    }
});

router.delete('/knowledge-base/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('knowledge_base')
            .delete()
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId);

        if (error) throw error;

        return res.json({ success: true });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'knowledge_base table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to delete knowledge base item');
    }
});

router.get('/automation-rules', async (req, res) => {
    try {
        let { data, error } = await supabase
            .from('automation_rules')
            .select('id,trigger_type,trigger_value,reply,priority,created_at')
            .eq('tenant_id', req.tenantId)
            .order('priority', { ascending: true })
            .order('created_at', { ascending: false });

        if (error && isMissingColumnError(error)) {
            ({ data, error } = await supabase
                .from('automation_rules')
                .select('id,keyword,reply_message,priority,created_at')
                .eq('tenant_id', req.tenantId)
                .order('priority', { ascending: true })
                .order('created_at', { ascending: false }));
        }

        if (error) {
            if (isMissingTableError(error)) return res.json([]);
            throw error;
        }

        return res.json((data || []).map(mapRuleRow));
    } catch (error) {
        return safeJsonError(res, error, 'Failed to load automation rules');
    }
});

router.post('/automation-rules', async (req, res) => {
    try {
        const keyword = String(req.body.keyword || req.body.trigger_value || '').trim();
        const replyMessage = String(req.body.replyMessage || req.body.reply || '').trim();

        if (!keyword || !replyMessage) {
            return res.status(400).json({ error: 'Keyword and reply message are required' });
        }

        let { data, error } = await supabase
            .from('automation_rules')
            .insert({
                tenant_id: req.tenantId,
                trigger_type: 'keyword',
                trigger_value: keyword,
                reply: replyMessage,
                priority: toNumber(req.body.priority, 1)
            })
            .select('id,trigger_type,trigger_value,reply,priority,created_at')
            .single();

        if (error && isMissingColumnError(error)) {
            ({ data, error } = await supabase
                .from('automation_rules')
                .insert({
                    tenant_id: req.tenantId,
                    keyword,
                    reply_message: replyMessage,
                    priority: toNumber(req.body.priority, 1)
                })
                .select('id,keyword,reply_message,priority,created_at')
                .single());
        }

        if (error) throw error;

        return res.status(201).json(mapRuleRow(data));
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'automation_rules table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to create automation rule');
    }
});

router.put('/automation-rules/:id', async (req, res) => {
    try {
        const payload = {};

        if (req.body.keyword !== undefined || req.body.trigger_value !== undefined) {
            payload.trigger_value = String(req.body.keyword || req.body.trigger_value || '').trim();
        }
        if (req.body.replyMessage !== undefined || req.body.reply !== undefined) {
            payload.reply = String(req.body.replyMessage || req.body.reply || '').trim();
        }
        if (req.body.priority !== undefined) payload.priority = toNumber(req.body.priority, 1);

        if (Object.keys(payload).length === 0) {
            return res.status(400).json({ error: 'No fields provided for update' });
        }

        let { data, error } = await supabase
            .from('automation_rules')
            .update(payload)
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .select('id,trigger_type,trigger_value,reply,priority,created_at')
            .maybeSingle();

        if (error && isMissingColumnError(error)) {
            const legacyPayload = {};
            if (payload.trigger_value !== undefined) legacyPayload.keyword = payload.trigger_value;
            if (payload.reply !== undefined) legacyPayload.reply_message = payload.reply;
            if (payload.priority !== undefined) legacyPayload.priority = payload.priority;

            ({ data, error } = await supabase
                .from('automation_rules')
                .update(legacyPayload)
                .eq('id', req.params.id)
                .eq('tenant_id', req.tenantId)
                .select('id,keyword,reply_message,priority,created_at')
                .maybeSingle());
        }

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Automation rule not found' });

        return res.json(mapRuleRow(data));
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'automation_rules table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to update automation rule');
    }
});

router.delete('/automation-rules/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('automation_rules')
            .delete()
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId);

        if (error) throw error;

        return res.json({ success: true });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'automation_rules table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to delete automation rule');
    }
});
router.get('/channel-connections', connectionReadLimiter, async (req, res) => {
    try {
        let { data, error } = await supabase
            .from('channel_connections')
            .select('id,channel,access_token,page_id,phone_number,is_active,metadata,created_at')
            .eq('tenant_id', req.tenantId)
            .order('created_at', { ascending: false });

        if (error && isMissingColumnError(error)) {
            ({ data, error } = await supabase
                .from('channel_connections')
                .select('id,channel,access_token,page_id,phone_number,created_at')
                .eq('tenant_id', req.tenantId)
                .order('created_at', { ascending: false }));
            if (!error) {
                data = (data || []).map((row) => ({ ...row, is_active: true, metadata: null }));
            }
        }

        if (error) {
            if (isMissingTableError(error)) return res.json([]);
            throw error;
        }

        return res.json((data || []).map(mapConnectionRow));
    } catch (error) {
        return safeJsonError(res, error, 'Failed to load channel connections');
    }
});

router.post('/channel-connections', connectionWriteLimiter, async (req, res) => {
    try {
        const channel = String(req.body.channel || '').trim().toLowerCase();
        const accessToken = String(req.body.access_token || req.body.accessToken || '').trim();

        if (!channel) {
            return res.status(400).json({ error: 'Channel is required' });
        }

        let { data: existing, error: existingError } = await supabase
            .from('channel_connections')
            .select('id,channel,access_token,page_id,phone_number,is_active,metadata,created_at')
            .eq('tenant_id', req.tenantId)
            .eq('channel', channel)
            .limit(1)
            .maybeSingle();

        if (existingError && isMissingColumnError(existingError)) {
            ({ data: existing, error: existingError } = await supabase
                .from('channel_connections')
                .select('id,channel,access_token,page_id,phone_number,created_at')
                .eq('tenant_id', req.tenantId)
                .eq('channel', channel)
                .limit(1)
                .maybeSingle());
            if (!existingError && existing) {
                existing.metadata = null;
                existing.is_active = true;
            }
        }

        if (existingError) throw existingError;

        const payload = {
            tenant_id: req.tenantId,
            channel,
            page_id: req.body.page_id || req.body.pageId || null,
            phone_number: req.body.phone_number || req.body.phoneNumber || null,
            metadata: req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : null,
            is_active: toBoolean(req.body.is_active, true)
        };

        if (accessToken) {
            payload.access_token = encryptSecret(accessToken);
        }

        let response;

        if (existing) {
            response = await supabase
                .from('channel_connections')
                .update(payload)
                .eq('id', existing.id)
                .eq('tenant_id', req.tenantId)
                .select('id,channel,access_token,page_id,phone_number,is_active,metadata,created_at')
                .single();
        } else {
            response = await supabase
                .from('channel_connections')
                .insert(payload)
                .select('id,channel,access_token,page_id,phone_number,is_active,metadata,created_at')
                .single();
        }

        if (response.error && isMissingColumnError(response.error)) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.is_active;
            delete fallbackPayload.metadata;

            if (existing) {
                response = await supabase
                    .from('channel_connections')
                    .update(fallbackPayload)
                    .eq('id', existing.id)
                    .eq('tenant_id', req.tenantId)
                    .select('id,channel,access_token,page_id,phone_number,created_at')
                    .single();
            } else {
                response = await supabase
                    .from('channel_connections')
                    .insert(fallbackPayload)
                    .select('id,channel,access_token,page_id,phone_number,created_at')
                    .single();
            }

            if (!response.error && response.data) {
                response.data.is_active = true;
                response.data.metadata = null;
            }
        }

        if (response.error) throw response.error;

        return res.status(existing ? 200 : 201).json(mapConnectionRow(response.data));
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'channel_connections table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to save channel connection');
    }
});

router.put('/channel-connections/:id', connectionWriteLimiter, async (req, res) => {
    try {
        const payload = {};

        if (req.body.page_id !== undefined || req.body.pageId !== undefined) {
            payload.page_id = req.body.page_id || req.body.pageId || null;
        }
        if (req.body.phone_number !== undefined || req.body.phoneNumber !== undefined) {
            payload.phone_number = req.body.phone_number || req.body.phoneNumber || null;
        }
        if (req.body.is_active !== undefined) {
            payload.is_active = toBoolean(req.body.is_active, true);
        }
        if (req.body.metadata !== undefined) {
            payload.metadata = req.body.metadata && typeof req.body.metadata === 'object'
                ? req.body.metadata
                : null;
        }
        if (req.body.access_token !== undefined || req.body.accessToken !== undefined) {
            const rawToken = String(req.body.access_token || req.body.accessToken || '').trim();
            if (rawToken) {
                payload.access_token = encryptSecret(rawToken);
            }
        }

        if (Object.keys(payload).length === 0) {
            return res.status(400).json({ error: 'No fields provided for update' });
        }

        let { data, error } = await supabase
            .from('channel_connections')
            .update(payload)
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId)
            .select('id,channel,access_token,page_id,phone_number,is_active,metadata,created_at')
            .maybeSingle();

        if (error && isMissingColumnError(error)) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.is_active;
            delete fallbackPayload.metadata;
            ({ data, error } = await supabase
                .from('channel_connections')
                .update(fallbackPayload)
                .eq('id', req.params.id)
                .eq('tenant_id', req.tenantId)
                .select('id,channel,access_token,page_id,phone_number,created_at')
                .maybeSingle());

            if (!error && data) {
                data.is_active = true;
                data.metadata = null;
            }
        }

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Channel connection not found' });

        return res.json(mapConnectionRow(data));
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'channel_connections table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to update channel connection');
    }
});

router.delete('/channel-connections/:id', connectionWriteLimiter, async (req, res) => {
    try {
        const { error } = await supabase
            .from('channel_connections')
            .delete()
            .eq('id', req.params.id)
            .eq('tenant_id', req.tenantId);

        if (error) throw error;

        return res.json({ success: true });
    } catch (error) {
        if (isMissingTableError(error)) {
            return res.status(503).json({ error: 'channel_connections table is missing. Run schema migration.' });
        }
        return safeJsonError(res, error, 'Failed to delete channel connection');
    }
});

router.get('/settings/profile', async (req, res) => {
    try {
        let { data: user, error } = await supabase
            .from('users')
            .select('id,name,email,profession,business_name,business_phone,location,services,website')
            .eq('id', req.user.id)
            .maybeSingle();

        if (error && isMissingColumnError(error)) {
            ({ data: user, error } = await supabase
                .from('users')
                .select('id,name,email,profession,business_name,business_phone,location')
                .eq('id', req.user.id)
                .maybeSingle());
            if (!error && user) {
                user.services = null;
                user.website = null;
            }
        }

        if (error) throw error;

        return res.json({
            user,
            tenant: {
                id: req.tenant.id,
                business_name: req.tenant.business_name,
                industry: req.tenant.industry,
                whatsapp_number: req.tenant.whatsapp_number,
                fb_page_id: req.tenant.fb_page_id,
                instagram_id: req.tenant.instagram_id,
                business_logo: req.tenant.business_logo || null
            }
        });
    } catch (error) {
        return safeJsonError(res, error, 'Failed to load settings');
    }
});

router.put('/settings/profile', async (req, res) => {
    try {
        const userUpdates = {};
        const tenantUpdates = {};

        if (req.body.name !== undefined) userUpdates.name = req.body.name;
        if (req.body.profession !== undefined) userUpdates.profession = req.body.profession;
        if (req.body.location !== undefined) userUpdates.location = req.body.location;
        if (req.body.business_name !== undefined || req.body.businessName !== undefined) {
            userUpdates.business_name = req.body.business_name || req.body.businessName;
            tenantUpdates.business_name = req.body.business_name || req.body.businessName;
        }
        if (req.body.business_phone !== undefined || req.body.businessPhone !== undefined) {
            userUpdates.business_phone = req.body.business_phone || req.body.businessPhone;
        }
        if (req.body.services !== undefined) userUpdates.services = req.body.services;
        if (req.body.website !== undefined) userUpdates.website = req.body.website;

        if (req.body.industry !== undefined) tenantUpdates.industry = req.body.industry;
        if (req.body.whatsapp_number !== undefined || req.body.whatsappNumber !== undefined) {
            tenantUpdates.whatsapp_number = req.body.whatsapp_number || req.body.whatsappNumber;
        }
        if (req.body.fb_page_id !== undefined || req.body.fbPageId !== undefined) {
            tenantUpdates.fb_page_id = req.body.fb_page_id || req.body.fbPageId;
        }
        if (req.body.instagram_id !== undefined || req.body.instagramId !== undefined) {
            tenantUpdates.instagram_id = req.body.instagram_id || req.body.instagramId;
        }
        if (req.body.business_logo !== undefined || req.body.businessLogo !== undefined) {
            tenantUpdates.business_logo = req.body.business_logo || req.body.businessLogo || null;
        }

        if (Object.keys(userUpdates).length > 0) {
            let { error: userError } = await supabase
                .from('users')
                .update(userUpdates)
                .eq('id', req.user.id);

            if (userError && isMissingColumnError(userError)) {
                const fallbackUserUpdates = { ...userUpdates };
                delete fallbackUserUpdates.services;
                delete fallbackUserUpdates.website;
                ({ error: userError } = await supabase
                    .from('users')
                    .update(fallbackUserUpdates)
                    .eq('id', req.user.id));
            }

            if (userError) throw userError;
        }

        if (Object.keys(tenantUpdates).length > 0) {
            const { error: tenantError } = await supabase
                .from('tenants')
                .update(tenantUpdates)
                .eq('id', req.tenantId)
                .eq('user_id', req.user.id);

            if (tenantError) throw tenantError;
        }

        return res.json({ success: true });
    } catch (error) {
        return safeJsonError(res, error, 'Failed to update settings');
    }
});

module.exports = router;
