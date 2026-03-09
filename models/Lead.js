const db = require('../config/database');

class Lead {
    static findByUserId(userId) {
        const leads = db.readLeads();
        return leads.filter(l => l.userId === userId);
    }

    static findById(id) {
        const leads = db.readLeads();
        return leads.find(l => l.id === id);
    }

    static create(leadData) {
        const leads = db.readLeads();
        const newLead = {
            id: Date.now(),
            ...leadData,
            createdAt: new Date()
        };
        leads.push(newLead);
        db.writeLeads(leads);
        return newLead;
    }

    static update(id, updates) {
        const leads = db.readLeads();
        const leadIndex = leads.findIndex(l => l.id === id);
        if (leadIndex !== -1) {
            leads[leadIndex] = { ...leads[leadIndex], ...updates };
            db.writeLeads(leads);
            return leads[leadIndex];
        }
        return null;
    }

    static delete(id) {
        const leads = db.readLeads();
        const filteredLeads = leads.filter(l => l.id !== id);
        db.writeLeads(filteredLeads);
        return true;
    }

    static getAll() {
        return db.readLeads();
    }
}

module.exports = Lead;
