import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eknbbuxiabijnaohzrph.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrbmJidXhpYWJpam5hb2h6cnBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Mzc0NzgsImV4cCI6MjA5MjQxMzQ3OH0.h_aNVdzqGZBCpJB8RCxw0R6tP3cu9i6Q5F0koMms258';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
    const tables = ['liked_songs', 'usernames', 'users_metadata'];
    
    for (const table of tables) {
        const { data, count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact' });
            
        if (error) {
            console.error(`Error fetching from ${table}:`, error.message);
        } else {
            console.log(`Table ${table} has ${count} rows.`);
        }
    }
}

checkData();
