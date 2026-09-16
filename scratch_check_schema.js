const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: bookingsData } = await supabase.from('room_bookings').select('*').limit(1);
  console.log("BOOKINGS SCHEMA:", bookingsData);
  
  const { data: roomsData } = await supabase.from('rooms').select('*').limit(1);
  console.log("ROOMS SCHEMA:", roomsData);
}

check();
