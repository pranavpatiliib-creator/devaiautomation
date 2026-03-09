const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const crypto = require('crypto');

const app = express();

app.use(cors());
app.use(express.json());

const USER_FILE = "users.json";
const FILE = "leads.json";

const SECRET = "mysecretkey";


// ================= JWT VERIFY MIDDLEWARE =================

function verifyToken(req, res, next) {

    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({ error: "Access denied. No token." });
    }

    try {

        const decoded = jwt.verify(token, SECRET);

        req.user = decoded;

        next();

    } catch (err) {

        res.status(401).json({ error: "Invalid token" });

    }

}



// ================= SIGNUP =================
app.post("/signup", async (req, res) => {

    try {

        const {
            name,
            email,
            password,
            profession,
            businessName,
            businessPhone,
            location,
            services,
            website
        } = req.body;

        // 1️⃣ Check empty fields
        if (
            !name ||
            !email ||
            !password ||
            !profession ||
            !businessName ||
            !businessPhone ||
            !location ||
            !services ||
            !website
        ) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // 2️⃣ Email validation
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }

        // 3️⃣ Phone validation (10 digits)
        const phonePattern = /^[0-9]{10}$/;

        if (!phonePattern.test(businessPhone)) {
            return res.status(400).json({ error: "Phone number must be 10 digits" });
        }

        // 4️⃣ Password strength
        const passwordPattern =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;

        if (!passwordPattern.test(password)) {
            return res.status(400).json({
                error: "Password must contain uppercase, lowercase, number and special character"
            });
        }

        // 5️⃣ Read users file safely
        let users = [];

        if (fs.existsSync(USER_FILE)) {
            const data = fs.readFileSync(USER_FILE);
            users = JSON.parse(data);
        }

        // 6️⃣ Check if email already exists
        const existingUser = users.find(u => u.email === email);

        if (existingUser) {
            return res.status(400).json({ error: "User already exists" });
        }

        // 7️⃣ Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            id: Date.now(),
            name,
            email,
            password: hashedPassword,
            profession,
            businessName,
            businessPhone,
            location,
            services,
            website,
            createdAt: new Date()
        };

        users.push(newUser);

        fs.writeFileSync(USER_FILE, JSON.stringify(users, null, 2));

        res.json({ success: true });

    } catch (err) {

        console.error("Signup error:", err);
        res.status(500).json({ error: "Server error" });

    }

});


// ================= LOGIN =================

app.post("/login", async (req, res) => {

    const { email, password } = req.body;

    const data = fs.readFileSync(USER_FILE);

    const users = JSON.parse(data);

    // check if user exists
    const user = users.find(u => u.email === email);

    if (!user) {
        return res.json({ error: "User not found" });
    }

    // compare password
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
        return res.json({ error: "Invalid password" });
    }

    // generate JWT token
    const token = jwt.sign({ id: user.id }, SECRET);

    res.json({
        success: true,
        token,
        profession: user.profession,
        businessName: user.businessName,
        
    });

});

// ================= GET LEADS =================

app.get("/leads", verifyToken, (req, res) => {

    const data = fs.readFileSync(FILE);

    const leads = JSON.parse(data);

    const userLeads = leads.filter(l => l.userId === req.user.id);

    res.json(userLeads);

});


// ================= ADD LEAD =================

app.post("/lead", verifyToken, (req, res) => {

    const { name, phone, service } = req.body;

    const data = fs.readFileSync(FILE);

    const leads = JSON.parse(data);
    const newLead = {
        id: Date.now(),
        userId: req.user.id,
        name,
        phone,
        service,
        status: "New",
        note: ""
    };

    leads.push(newLead);

    fs.writeFileSync(FILE, JSON.stringify(leads, null, 2));

    res.json({ success: true });

});


// ================= UPDATE STATUS =================

app.put("/lead/:id", verifyToken, (req, res) => {

    const id = parseInt(req.params.id);

    const { status } = req.body;

    const data = fs.readFileSync(FILE);

    const leads = JSON.parse(data);

    const lead = leads.find(l => l.id === id && l.userId === req.user.id);

    if (lead) {
        lead.status = status;
    }

    fs.writeFileSync(FILE, JSON.stringify(leads, null, 2));

    res.json({ success: true });

});


// ================= UPDATE NOTE =================

app.put("/lead-note/:id", verifyToken, (req, res) => {

    const id = parseInt(req.params.id);

    const { note } = req.body;

    const data = fs.readFileSync(FILE);

    const leads = JSON.parse(data);

    const lead = leads.find(l => l.id === id && l.userId === req.user.id);

    if (lead) {
        lead.note = note;
    }

    fs.writeFileSync(FILE, JSON.stringify(leads, null, 2));

    res.json({ success: true });

});

// Store reset tokens temporarily (in memory)
let resetTokens = {};

// ── Forgot Password ──────────────────────────────
app.post('/forgot-password', (req, res) => {
    const { email } = req.body;
    const users = readUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
        return res.status(404).json({ message: 'Email not found' });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes

    resetTokens[token] = { email, expiry };

    // In production, send email. For now return token directly.
    const resetLink = `reset-password.html?token=${token}`;

    res.json({ 
        message: 'Reset link generated', 
        resetLink  // remove this in production, send via email instead
    });
});

// ── Reset Password ───────────────────────────────
app.post('/reset-password', (req, res) => {
    const { token, newPassword } = req.body;
    const tokenData = resetTokens[token];

    if (!tokenData) {
        return res.status(400).json({ message: 'Invalid or expired token' });
    }

    if (Date.now() > tokenData.expiry) {
        delete resetTokens[token];
        return res.status(400).json({ message: 'Token expired. Please try again.' });
    }

    const users = readUsers();
    const userIndex = users.findIndex(u => u.email === tokenData.email);

    if (userIndex === -1) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Hash new password
    const bcrypt = require('bcryptjs');
    const hashed = bcrypt.hashSync(newPassword, 10);
    users[userIndex].password = hashed;
    writeUsers(users);

    delete resetTokens[token]; // token used, delete it
    res.json({ message: 'Password reset successful' });
});
// ================= PUBLIC LEAD FORM ====================

app.post("/lead-public", (req, res) => {

    const { userId, name, phone, service } = req.body;

    const data = fs.readFileSync(FILE);

    const leads = JSON.parse(data);

    const newLead = {
        id: Date.now(),
        userId: Number(userId),
        name,
        phone,
        service,
        status: "New",
        note: ""
    };

    leads.push(newLead);

    fs.writeFileSync(FILE, JSON.stringify(leads, null, 2));

    res.json({ success: true });

});


// ================= SERVER START =================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});