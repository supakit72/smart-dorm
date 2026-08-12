"use server";

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function adminResetUserPassword(userId: string, tempPassword?: string) {
  try {
    if (!tempPassword) {
      throw new Error('No password provided');
    }

    // 1. Update password using admin api
    const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (updateError) throw updateError;

    // 2. Update users table to force password change
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({ force_password_change: true })
      .eq('user_uid', userId);

    if (dbError) throw dbError;

    return { success: true };
  } catch (err: any) {
    console.error('Admin Reset Password Error:', err);
    return { success: false, error: err.message };
  }
}
