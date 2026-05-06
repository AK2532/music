import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eknbbuxiabijnaohzrph.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrbmJidXhpYWJpam5hb2h6cnBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Mzc0NzgsImV4cCI6MjA5MjQxMzQ3OH0.h_aNVdzqGZBCpJB8RCxw0R6tP3cu9i6Q5F0koMms258';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function wipeDatabase() {
    console.log("Attempting to wipe tables...");
    
    const tables = ['liked_songs', 'usernames', 'users_metadata'];
    const dummyUuid = '00000000-0000-0000-0000-000000000000';
    
    for (const table of tables) {
        console.log(`Deleting all rows from ${table}...`);
        const { data, error } = await supabase
            .from(table)
            .delete()
            .neq('user_id', dummyUuid);
            
        if (error) {
            console.error(`Error deleting from ${table}:`, error.message);
        } else {
            console.log(`Successfully deleted data from ${table}`);
        }
    }
}

wipeDatabase();
