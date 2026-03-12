const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

router.post("/public/lead", async (req, res) => {
    try {
        const { user_id, name, phone, service } = req.body;

        console.log("Incoming lead:", user_id, name, phone, service);

        if (!user_id || !name || !phone || !service) {
            return res.status(400).json({
                success: false,
                error: "user_id, name, phone, and service are required"
            });
        }

        const { data, error } = await supabase
            .from("leads")
            .insert([{ user_id, name, phone, service }])
            .select();

        if (error) {
            console.error("Supabase insert error:", error);
            return res.status(500).json({
                success: false,
                error: error.message || "Failed to insert lead"
            });
        }

        return res.status(201).json({
            success: true,
            data
        });
    } catch (err) {
        console.error("Unexpected error in /public/lead:", err);
        return res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
});

module.exports = router;
