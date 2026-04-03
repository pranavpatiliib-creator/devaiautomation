const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

const supabase = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const { cacheGet, bustOnWrite } = require('../middleware/redisCache');

function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
}

const ALLOWED_LEAD_STATUSES = new Set([
    'new',
    'contacted',
    'qualified',
    'converted',
    'lost',
    'won'
]);

function sanitizeLeadText(value, maxLength = 255) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, maxLength);
}

function parseLeadStatus(value) {
    const normalized = normalizeStatus(value);
    if (!normalized) return null;
    return ALLOWED_LEAD_STATUSES.has(normalized) ? normalized : null;
}

function parseDateBoundary(dateString, endOfDay = false) {
    if (!dateString) return null;

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return null;

    if (endOfDay) {
        date.setHours(23, 59, 59, 999);
    } else {
        date.setHours(0, 0, 0, 0);
    }

    return date;
}

function formatLeadDate(value) {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('en-IN');
}

function drawLeadsTable(doc, leads) {
    const tableStartX = doc.page.margins.left;
    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const tableEndY = doc.page.height - doc.page.margins.bottom;
    const cellPaddingX = 6;
    const cellPaddingY = 6;

    const columns = [
        { key: 'name', label: 'Name', width: tableWidth * 0.22 },
        { key: 'phone', label: 'Phone', width: tableWidth * 0.18 },
        { key: 'service', label: 'Service', width: tableWidth * 0.24 },
        { key: 'status', label: 'Status', width: tableWidth * 0.14 },
        { key: 'created_at', label: 'Date', width: tableWidth * 0.22 }
    ];

    const widthUsed = columns.slice(0, -1).reduce((sum, col) => sum + col.width, 0);
    columns[columns.length - 1].width = tableWidth - widthUsed;

    function getCellValue(lead, key) {
        if (key === 'created_at') return formatLeadDate(lead.created_at);
        return String(lead[key] || '-');
    }

    function measureRowHeight(lead) {
        doc.font('Helvetica').fontSize(10);

        let maxCellHeight = 0;
        for (const column of columns) {
            const value = getCellValue(lead, column.key);
            const textHeight = doc.heightOfString(value, {
                width: column.width - (cellPaddingX * 2)
            });
            if (textHeight > maxCellHeight) {
                maxCellHeight = textHeight;
            }
        }

        return Math.max(24, maxCellHeight + (cellPaddingY * 2));
    }

    function drawHeader(y) {
        const headerHeight = 24;
        let x = tableStartX;

        doc.rect(tableStartX, y, tableWidth, headerHeight)
            .fillColor('#eef2ff')
            .fill();

        doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827');

        for (const column of columns) {
            doc.text(column.label, x + cellPaddingX, y + 7, {
                width: column.width - (cellPaddingX * 2),
                align: 'left'
            });
            x += column.width;
        }

        x = tableStartX;
        for (const column of columns) {
            doc.rect(x, y, column.width, headerHeight)
                .lineWidth(0.7)
                .strokeColor('#cbd5e1')
                .stroke();
            x += column.width;
        }

        return y + headerHeight;
    }

    let y = drawHeader(doc.y + 6);

    for (const lead of leads) {
        const rowHeight = measureRowHeight(lead);

        if (y + rowHeight > tableEndY) {
            doc.addPage();
            y = drawHeader(doc.page.margins.top);
        }

        let x = tableStartX;
        doc.font('Helvetica').fontSize(10).fillColor('#111827');

        for (const column of columns) {
            const value = getCellValue(lead, column.key);

            doc.text(value, x + cellPaddingX, y + cellPaddingY, {
                width: column.width - (cellPaddingX * 2),
                height: rowHeight - (cellPaddingY * 2),
                ellipsis: true
            });

            doc.rect(x, y, column.width, rowHeight)
                .lineWidth(0.5)
                .strokeColor('#d1d5db')
                .stroke();

            x += column.width;
        }

        y += rowHeight;
    }
}

async function getLeadById(tenantId, leadId) {
    const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', leadId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

router.use(verifyToken, requireTenant);
router.use(bustOnWrite());
router.use(cacheGet({ prefix: 'cache:http:leads:v1' }));

router.get('/leads', async (req, res) => {
    try {
        const { status, search } = req.query;
        const normalizedStatus = normalizeStatus(status);
        const term = String(search || '')
            .replace(/[^a-zA-Z0-9@._+\-\s]/g, ' ')
            .trim();

        let query = supabase
            .from('leads')
            .select('id,customer_id,name,phone,service,status,note,created_at')
            .eq('tenant_id', req.tenantId)
            .order('created_at', { ascending: false });

        if (normalizedStatus) {
            query = query.ilike('status', normalizedStatus);
        }

        if (term) {
            query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,service.ilike.%${term}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.json(data || []);
    } catch (error) {
        console.error('Get leads error:', error);
        return res.status(500).json({ error: 'Failed to load leads' });
    }
});

router.post(['/lead', '/leads'], async (req, res) => {
    try {
        const name = sanitizeLeadText(req.body.name, 120);
        const phone = sanitizeLeadText(req.body.phone, 30);
        const service = sanitizeLeadText(req.body.service, 120);
        const customerId = req.body.customer_id || req.body.customerId || null;

        if (!name || !phone || !service) {
            return res.status(400).json({ error: 'name, phone, and service are required' });
        }

        const { data, error } = await supabase
            .from('leads')
            .insert({
                tenant_id: req.tenantId,
                customer_id: customerId,
                name,
                phone,
                service,
                status: 'new',
                note: ''
            })
            .select('id,customer_id,name,phone,service,status,note,created_at')
            .single();

        if (error) throw error;

        return res.status(201).json({ success: true, lead: data });
    } catch (error) {
        console.error('Add lead error:', error);
        return res.status(500).json({ error: 'Failed to add lead' });
    }
});

router.put('/lead/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const leadId = req.params.id;
        const parsedStatus = parseLeadStatus(status);

        if (!parsedStatus) {
            return res.status(400).json({ error: 'Invalid lead status' });
        }

        const lead = await getLeadById(req.tenantId, leadId);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        const { error } = await supabase
            .from('leads')
            .update({ status: parsedStatus })
            .eq('tenant_id', req.tenantId)
            .eq('id', leadId);

        if (error) throw error;

        return res.json({ success: true });
    } catch (error) {
        console.error('Update lead error:', error);
        return res.status(500).json({ error: 'Failed to update lead' });
    }
});

router.put('/lead-note/:id', async (req, res) => {
    try {
        const note = sanitizeLeadText(req.body.note, 2000);
        const leadId = req.params.id;

        const lead = await getLeadById(req.tenantId, leadId);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        const { error } = await supabase
            .from('leads')
            .update({ note })
            .eq('tenant_id', req.tenantId)
            .eq('id', leadId);

        if (error) throw error;

        return res.json({ success: true });
    } catch (error) {
        console.error('Update lead note error:', error);
        return res.status(500).json({ error: 'Failed to update lead note' });
    }
});

router.put('/leads/:id', async (req, res) => {
    try {
        const leadId = req.params.id;
        const updates = {};

        if (req.body.status !== undefined) {
            const parsedStatus = parseLeadStatus(req.body.status);
            if (!parsedStatus) {
                return res.status(400).json({ error: 'Invalid lead status' });
            }
            updates.status = parsedStatus;
        }
        if (req.body.note !== undefined) {
            updates.note = sanitizeLeadText(req.body.note, 2000);
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No fields provided for update' });
        }

        const lead = await getLeadById(req.tenantId, leadId);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        const { data, error } = await supabase
            .from('leads')
            .update(updates)
            .eq('tenant_id', req.tenantId)
            .eq('id', leadId)
            .select('id,customer_id,name,phone,service,status,note,created_at')
            .maybeSingle();

        if (error) throw error;

        return res.json({ success: true, lead: data });
    } catch (error) {
        console.error('Update lead record error:', error);
        return res.status(500).json({ error: 'Failed to update lead' });
    }
});

router.delete(['/lead/:id', '/leads/:id'], async (req, res) => {
    try {
        const leadId = req.params.id;
        const lead = await getLeadById(req.tenantId, leadId);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('tenant_id', req.tenantId)
            .eq('id', leadId);

        if (error) throw error;
        return res.json({ success: true });
    } catch (error) {
        console.error('Delete lead error:', error);
        return res.status(500).json({ error: 'Failed to delete lead' });
    }
});

router.get('/leads/export', async (req, res) => {
    try {
        const { data: leads, error } = await supabase
            .from('leads')
            .select('id,name,phone,service,status,note,created_at')
            .eq('tenant_id', req.tenantId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(leads || []);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="leads_${Date.now()}.xlsx"`);
        return res.send(buffer);
    } catch (error) {
        console.error('Export leads error:', error);
        return res.status(500).json({ error: 'Failed to export leads' });
    }
});

router.get('/leads/export/pdf', async (req, res) => {
    try {
        const { status, fromDate, toDate } = req.query;
        const normalizedStatus = normalizeStatus(status);
        const fromBoundary = parseDateBoundary(fromDate, false);
        const toBoundary = parseDateBoundary(toDate, true);

        const [leadsResponse, tenantResponse] = await Promise.all([
            supabase
                .from('leads')
                .select('id,name,phone,service,status,note,created_at')
                .eq('tenant_id', req.tenantId)
                .order('created_at', { ascending: false }),
            supabase
                .from('tenants')
                .select('business_name')
                .eq('id', req.tenantId)
                .maybeSingle()
        ]);

        if (leadsResponse.error) throw leadsResponse.error;
        if (tenantResponse.error) throw tenantResponse.error;

        const allLeads = leadsResponse.data || [];
        const filteredLeads = allLeads.filter((lead) => {
            const leadStatus = normalizeStatus(lead.status);
            const leadDate = lead.created_at ? new Date(lead.created_at) : null;

            if (normalizedStatus && leadStatus !== normalizedStatus) return false;
            if (fromBoundary && (!leadDate || leadDate < fromBoundary)) return false;
            if (toBoundary && (!leadDate || leadDate > toBoundary)) return false;

            return true;
        });

        const statusLabel = normalizedStatus
            ? normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1)
            : 'All';

        const businessName = tenantResponse.data?.business_name || 'LeadFlow AI';

        const doc = new PDFDocument({
            margin: 40,
            size: 'A4'
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="leads_${Date.now()}.pdf"`);

        doc.pipe(res);

        doc.font('Helvetica-Bold').fontSize(20).fillColor('#111827').text(businessName, {
            align: 'center'
        });

        doc.moveDown(0.6);
        doc.font('Helvetica').fontSize(11).fillColor('#374151');
        doc.text(`Status: ${statusLabel}`);
        doc.text(`From: ${fromDate || 'Start'}`);
        doc.text(`To: ${toDate || 'Today'}`);
        doc.text(`Total Leads: ${filteredLeads.length}`);

        if (filteredLeads.length === 0) {
            doc.moveDown(2);
            doc.font('Helvetica-Bold').fontSize(13).fillColor('#6b7280').text('No leads found for this filter.', {
                align: 'center'
            });
        } else {
            drawLeadsTable(doc, filteredLeads);
        }

        doc.end();
    } catch (error) {
        console.error('PDF export error:', error);

        if (!res.headersSent) {
            return res.status(500).json({ error: 'Failed to export PDF' });
        }
    }
});

module.exports = router;
