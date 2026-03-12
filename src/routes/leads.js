const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const LeadsController = require('../controllers/leadsController');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
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

function getBusinessDisplayName(user, userId) {
    const businessName = (user?.businessName || '').trim();
    if (businessName) return businessName;

    const ownerName = (user?.name || '').trim();
    if (ownerName) return `${ownerName}'s Business`;

    return `Business ${userId}`;
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
        { key: 'createdAt', label: 'Date', width: tableWidth * 0.22 }
    ];

    // Keep table width exact after percentage rounding.
    const widthUsed = columns.slice(0, -1).reduce((sum, col) => sum + col.width, 0);
    columns[columns.length - 1].width = tableWidth - widthUsed;

    function getCellValue(lead, key) {
        if (key === 'createdAt') return formatLeadDate(lead.createdAt);
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


router.get('/leads', verifyToken, LeadsController.getLeads);
router.post('/lead', verifyToken, LeadsController.addLead);
router.put('/lead/:id', verifyToken, LeadsController.updateLead);
router.put('/lead-note/:id', verifyToken, LeadsController.updateLeadNote);
router.delete('/lead/:id', verifyToken, LeadsController.deleteLead);

// Export leads to Excel - accessible at /api/leads/export
router.get('/leads/export', verifyToken, async (req, res) => {
    try {
        const leads = await Lead.findByUserId(req.user.id);

        // Create workbook
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(leads);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Send file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="leads_${Date.now()}.xlsx"`);
        res.send(buffer);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export leads', message: error.message });
    }
});
router.get('/leads/export/pdf', verifyToken, async (req, res) => {
    try {
        const { status, fromDate, toDate } = req.query;
        const normalizedStatus = normalizeStatus(status);
        const fromBoundary = parseDateBoundary(fromDate, false);
        const toBoundary = parseDateBoundary(toDate, true);

        const [leads, user] = await Promise.all([
            Lead.findByUserId(req.user.id),
            User.findById(req.user.id)
        ]);

        const filteredLeads = leads.filter((lead) => {
            const leadStatus = normalizeStatus(lead.status);
            const leadDate = lead.createdAt ? new Date(lead.createdAt) : null;

            if (normalizedStatus && leadStatus !== normalizedStatus) return false;
            if (fromBoundary && (!leadDate || leadDate < fromBoundary)) return false;
            if (toBoundary && (!leadDate || leadDate > toBoundary)) return false;

            return true;
        });

        const businessName = getBusinessDisplayName(user, req.user.id);
        const statusLabel = normalizedStatus
            ? normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1)
            : 'All';

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
            res.status(500).json({ error: 'Failed to export PDF' });
        }
    }
});

module.exports = router;
