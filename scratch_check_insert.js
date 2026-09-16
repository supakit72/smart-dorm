const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('query_columns', {}); // doesn't exist
  // Let's just insert an empty object to see what required columns are
  const { error: insertError } = await supabase.from('room_bookings').insert([{}]);
  console.log("INSERT ERROR:", insertError);
}

check();
