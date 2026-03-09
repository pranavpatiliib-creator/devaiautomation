const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USER_FILE = path.join(DATA_DIR, 'users.json');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

// Initialize files if they don't exist
function initializeDataFiles() {
    if (!fs.existsSync(USER_FILE)) {
        fs.writeFileSync(USER_FILE, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(LEADS_FILE)) {
        fs.writeFileSync(LEADS_FILE, JSON.stringify([], null, 2));
    }
}

// Read all users
function readUsers() {
    try {
        if (!fs.existsSync(USER_FILE)) return [];
        const data = fs.readFileSync(USER_FILE, 'utf8');
        return JSON.parse(data) || [];
    } catch (err) {
        console.error('Error reading users:', err);
        return [];
    }
}

// Write all users
function writeUsers(users) {
    try {
        fs.writeFileSync(USER_FILE, JSON.stringify(users, null, 2));
    } catch (err) {
        console.error('Error writing users:', err);
    }
}

// Read all leads
function readLeads() {
    try {
        if (!fs.existsSync(LEADS_FILE)) return [];
        const data = fs.readFileSync(LEADS_FILE, 'utf8');
        return JSON.parse(data) || [];
    } catch (err) {
        console.error('Error reading leads:', err);
        return [];
    }
}

// Write all leads
function writeLeads(leads) {
    try {
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    } catch (err) {
        console.error('Error writing leads:', err);
    }
}

initializeDataFiles();

module.exports = {
    USER_FILE,
    LEADS_FILE,
    readUsers,
    writeUsers,
    readLeads,
    writeLeads
};
