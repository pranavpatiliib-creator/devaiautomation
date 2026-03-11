const express = require("express");
const router = express.Router();
const XLSX = require("xlsx");
const Lead = require("../../models/Lead");

// Test route to verify router loads
router.get("/test", (req, res) => {
    res.json({
        message: "Lead routes test endpoint working",
        status: "OK"
    });
});

// Export route - generates Excel file
router.get("/export", async (req, res) => {
    try {
        const leads = await Lead.getAll();

        // Create a new workbook
        const workbook = XLSX.utils.book_new();

        // Convert leads to worksheet
        const worksheet = XLSX.utils.json_to_sheet(leads);

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

        // Write to buffer
        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        // Set response headers for file download
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="leads_${Date.now()}.xlsx"`);
        res.setHeader("Content-Length", buffer.length);

        // Send file
        res.send(buffer);
    } catch (error) {
        console.error("Export error:", error);
        res.status(500).json({
            error: "Failed to export leads",
            message: error.message
        });
    }
});

module.exports = router;
