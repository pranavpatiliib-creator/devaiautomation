const db = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
    static findByEmail(email) {
        const users = db.readUsers();
        return users.find(u => u.email === email);
    }

    static findById(id) {
        const users = db.readUsers();
        return users.find(u => u.id === id);
    }

    static create(userData) {
        const users = db.readUsers();
        const newUser = {
            id: Date.now(),
            ...userData,
            createdAt: new Date()
        };
        users.push(newUser);
        db.writeUsers(users);
        return newUser;
    }

    static update(id, updates) {
        const users = db.readUsers();
        const userIndex = users.findIndex(u => u.id === id);
        if (userIndex !== -1) {
            users[userIndex] = { ...users[userIndex], ...updates };
            db.writeUsers(users);
            return users[userIndex];
        }
        return null;
    }

    static validatePassword(plainPassword, hashedPassword) {
        return bcrypt.compareSync(plainPassword, hashedPassword);
    }

    static hashPassword(password) {
        return bcrypt.hashSync(password, 10);
    }
}

module.exports = User;
