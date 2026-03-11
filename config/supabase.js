const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env file');
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY in environment');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test connection
supabase.from('users').select('count').limit(1).then(
    ({ data, error }) => {
        if (error) {
            console.error('❌ Supabase connection failed:', error.message);
        } else {
            console.log('✓ Supabase connected successfully');
        }
    }
).catch(err => {
    console.error('❌ Supabase error:', err.message);
});

module.exports = supabase;
