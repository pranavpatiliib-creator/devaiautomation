const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const express = require("express");
const cors = require("cors");
const fs = require("fs");

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

    const data = fs.readFileSync(USER_FILE);
    const users = JSON.parse(data);

    // check if user already exists
    const existingUser = users.find(u => u.email === email);

    if (existingUser) {
        return res.json({ error: "User already exists" });
    }

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
        website
    };

    users.push(newUser);

    fs.writeFileSync(USER_FILE, JSON.stringify(users, null, 2));

    res.json({ success: true });

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
        profession: user.profession
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

app.listen(5000, () => {

    console.log("🚀  Backend Server running on http://localhost:5000");

});