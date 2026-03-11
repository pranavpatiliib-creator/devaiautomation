class PublicController {
    static async submitForm(req, res) {
        try {
            const data = req.body;
            console.log("Form submission:", data);
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Server error" });
        }
    }
}

module.exports = PublicController;