const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'room_bookings' });
  console.log("RPC DATA:", data, "ERROR:", error);
  // fallback if rpc not exists
  if (error) {
     const { data: qData, error: qError } = await supabase.from('room_bookings').select('*').limit(1);
     console.log("Is Error a schema error?", qError);
  }
}

check();
