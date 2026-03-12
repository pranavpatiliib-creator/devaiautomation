const Lead = require('../models/Lead');
const PDFDocument = require('pdfkit');
class LeadsController {
    static async getLeads(req, res) {
        try {
            const userLeads = await Lead.findByUserId(req.user.id);
            res.json(userLeads);
        } catch (err) {
            console.error('Get leads error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }

    static async addLead(req, res) {
        try {
            const { name, phone, service } = req.body;

            // Validate required fields
            if (!name || !phone || !service) {
                return res.status(400).json({ error: 'name, phone, and service are required' });
            }

            const newLead = await Lead.create({
                userId: req.user.id,
                name,
                phone,
                service,
                status: 'New',
                note: ''
            });

            res.json({ success: true, lead: newLead });
        } catch (err) {
            console.error('Add lead error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }

    static async updateLead(req, res) {
        try {
            const id = parseInt(req.params.id);
            const { status } = req.body;

            const lead = await Lead.findById(id);
            if (!lead || Number(lead.userId) !== Number(req.user.id)) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            await Lead.update(id, { status });
            res.json({ success: true });
        } catch (err) {
            console.error('Update lead error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }

    static async updateLeadNote(req, res) {
        try {
            const id = parseInt(req.params.id);
            const { note } = req.body;

            const lead = await Lead.findById(id);
            if (!lead || Number(lead.userId) !== Number(req.user.id)) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            await Lead.update(id, { note });
            res.json({ success: true });
        } catch (err) {
            console.error('Update lead note error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }
    static async exportLeadsPDF(req, res) {
        try {

            const { status, fromDate, toDate } = req.query;

            let leads = await Lead.findByUserId(req.user.id);

            // Filter leads
            if (status) {
                leads = leads.filter(l => l.status === status);
            }

            if (fromDate) {
                leads = leads.filter(l => new Date(l.created_at) >= new Date(fromDate));
            }

            if (toDate) {
                leads = leads.filter(l => new Date(l.created_at) <= new Date(toDate));
            }

            const PDFDocument = require('pdfkit');
            const doc = new PDFDocument({ margin: 40 });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="leads-report.pdf"');

            doc.pipe(res);

            // Business name centered
            doc.fontSize(20).text(req.user.businessName || "Business", {
                align: 'center'
            });

            doc.moveDown();

            doc.fontSize(12).text(`Status: ${status || "All"}`);
            doc.text(`From: ${fromDate || "Start"}`);
            doc.text(`To: ${toDate || "Today"}`);

            doc.moveDown();

            if (leads.length === 0) {

                // Handle empty leads safely
                doc.fontSize(14).text("No leads found for this filter.", {
                    align: 'center'
                });

            } else {

                // Table header
                doc.fontSize(12).text("Name", 50);
                doc.text("Phone", 200);
                doc.text("Status", 350);
                doc.text("Date", 450);

                doc.moveDown();

                leads.forEach(lead => {
                    doc.text(lead.name || "-", 50);
                    doc.text(lead.phone || "-", 200);
                    doc.text(lead.status || "-", 350);
                    doc.text(
                        lead.created_at
                            ? new Date(lead.created_at).toLocaleDateString()
                            : "-",
                        450
                    );
                    doc.moveDown();
                });
            }

            doc.end();

        } catch (error) {
            console.error("PDF export error:", error);
            res.status(500).json({ error: "Failed to export PDF" });
        }
    }
    static async deleteLead(req, res) {
        try {
            const id = parseInt(req.params.id);

            const lead = await Lead.findById(id);
            if (!lead || Number(lead.userId) !== Number(req.user.id)) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            await Lead.delete(id);
            res.json({ success: true });
        } catch (err) {
            console.error('Delete lead error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    }
}

module.exports = LeadsController;
