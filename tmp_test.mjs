import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bsmlnpdplnbwtoxvbgdu.supabase.co';
const supabaseKey = 'sb_publishable_PSb19so44AfrgMfUFdoj2Q_iRyhSR40';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('Testing connection to Supabase...');
    try {
        const { data, error } = await supabase.from('profiles').select('id').limit(1);
        if (error) {
            console.error('Error:', error);
        } else {
            console.log('Success! Connected and fetched profiles data.');
        }
    } catch (err) {
        console.error('Fetch exception:', err);
    }
}

test();
