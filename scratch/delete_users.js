import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eknbbuxiabijnaohzrph.supabase.co';

// ⚠️ IMPORTANT: Replace this with your SERVICE_ROLE key.
// You can find this in your Supabase Dashboard -> Project Settings -> API -> service_role secret
const supabaseServiceKey = 'YOUR_SERVICE_ROLE_KEY_HERE';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deleteAllUsers() {
    if (supabaseServiceKey === 'YOUR_SERVICE_ROLE_KEY_HERE') {
        console.error("Please add your service_role key to this script first!");
        return;
    }

    console.log("Fetching all users...");
    // Note: listUsers() retrieves up to 50 users by default. You can pass { perPage: 1000 } if you have more.
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
        console.error("Error fetching users:", error.message);
        return;
    }
    
    console.log(`Found ${users.length} users. Deleting...`);
    
    for (const user of users) {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (deleteError) {
            console.error(`Error deleting user ${user.id}:`, deleteError.message);
        } else {
            console.log(`Successfully deleted user: ${user.email} (${user.id})`);
        }
    }
    console.log("Done deleting users!");
}

deleteAllUsers();
