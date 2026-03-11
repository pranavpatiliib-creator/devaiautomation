const supabase = require('../config/supabase');

const LEADS_TABLE = 'leads';

function mapLeadRow(row) {
    if (!row) return null;

    return {
        id: Number(row.id),
        userId: Number(row.user_id),
        name: row.name,
        phone: row.phone,
        service: row.service,
        status: row.status,
        note: row.note || '',
        createdAt: row.created_at
    };
}

function mapLeadInsert(leadData) {
    return {
        user_id: Number(leadData.userId),
        name: leadData.name,
        phone: leadData.phone,
        service: leadData.service,
        status: leadData.status || 'New',
        note: leadData.note || ''
    };
}

function mapLeadUpdates(updates) {
    const mapped = {};

    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.phone !== undefined) mapped.phone = updates.phone;
    if (updates.service !== undefined) mapped.service = updates.service;
    if (updates.status !== undefined) mapped.status = updates.status;
    if (updates.note !== undefined) mapped.note = updates.note;
    if (updates.userId !== undefined) mapped.user_id = Number(updates.userId);

    return mapped;
}

class Lead {
    static async findByUserId(userId) {
        const { data, error } = await supabase
            .from(LEADS_TABLE)
            .select('*')
            .eq('user_id', Number(userId))
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapLeadRow);
    }

    static async findById(id) {
        const { data, error } = await supabase
            .from(LEADS_TABLE)
            .select('*')
            .eq('id', Number(id))
            .limit(1);

        if (error) throw error;
        return mapLeadRow(data?.[0]);
    }

    static async create(leadData) {
        const row = mapLeadInsert(leadData);

        const { data, error } = await supabase
            .from(LEADS_TABLE)
            .insert(row)
            .select('*')
            .single();

        if (error) throw error;
        return mapLeadRow(data);
    }

    static async update(id, updates) {
        const mappedUpdates = mapLeadUpdates(updates);
        if (Object.keys(mappedUpdates).length === 0) {
            return this.findById(id);
        }

        const { data, error } = await supabase
            .from(LEADS_TABLE)
            .update(mappedUpdates)
            .eq('id', Number(id))
            .select('*')
            .maybeSingle();

        if (error) throw error;
        return mapLeadRow(data);
    }

    static async delete(id) {
        const { error } = await supabase
            .from(LEADS_TABLE)
            .delete()
            .eq('id', Number(id));

        if (error) throw error;
        return true;
    }

    static async getAll() {
        const { data, error } = await supabase
            .from(LEADS_TABLE)
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapLeadRow);
    }
}

module.exports = Lead;
