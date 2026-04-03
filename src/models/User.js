const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');

const USERS_TABLE = 'users';

function mapUserRow(row) {
    if (!row) return null;

    return {
        id: row.id,
        name: row.name,
        email: row.email,
        password: row.password,
        profession: row.profession,
        businessName: row.business_name,
        businessPhone: row.business_phone,
        location: row.location,
        services: row.services,
        website: row.website,
        createdAt: row.created_at
    };
}

function mapUserInsert(userData) {
    const row = {
        name: userData.name,
        email: String(userData.email || '').trim().toLowerCase(),
        password: userData.password,
        profession: userData.profession || null,
        business_name: userData.businessName || null,
        business_phone: userData.businessPhone || null,
        location: userData.location || null,
        services: userData.services || null,
        website: userData.website || null
    };

    if (userData.id) {
        row.id = userData.id;
    }

    return row;
}

function mapUserUpdates(updates) {
    const mapped = {};

    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.email !== undefined) mapped.email = String(updates.email).trim().toLowerCase();
    if (updates.password !== undefined) mapped.password = updates.password;
    if (updates.profession !== undefined) mapped.profession = updates.profession;
    if (updates.businessName !== undefined) mapped.business_name = updates.businessName;
    if (updates.businessPhone !== undefined) mapped.business_phone = updates.businessPhone;
    if (updates.location !== undefined) mapped.location = updates.location;
    if (updates.services !== undefined) mapped.services = updates.services;
    if (updates.website !== undefined) mapped.website = updates.website;

    return mapped;
}

class User {
    static async findByEmail(email) {
        const normalizedEmail = String(email || '').trim().toLowerCase();

        const { data, error } = await supabase
            .from(USERS_TABLE)
            .select('*')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (error) throw error;
        return mapUserRow(data);
    }

    static async findById(id) {
        const { data, error } = await supabase
            .from(USERS_TABLE)
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        return mapUserRow(data);
    }

    static async create(userData) {
        const row = mapUserInsert(userData);

        const { data, error } = await supabase
            .from(USERS_TABLE)
            .insert(row)
            .select('*')
            .single();

        if (error) throw error;
        return mapUserRow(data);
    }

    static async update(id, updates) {
        const mappedUpdates = mapUserUpdates(updates);
        if (Object.keys(mappedUpdates).length === 0) {
            return this.findById(id);
        }

        const { data, error } = await supabase
            .from(USERS_TABLE)
            .update(mappedUpdates)
            .eq('id', id)
            .select('*')
            .maybeSingle();

        if (error) throw error;
        return mapUserRow(data);
    }

    static validatePassword(plainPassword, hashedPassword) {
        return bcrypt.compareSync(plainPassword, hashedPassword);
    }

    static hashPassword(password) {
        return bcrypt.hashSync(password, 10);
    }
}

module.exports = User;
