import { supabase } from '@/backend/lib/supabase';

/**
 * อัปโหลดไฟล์รูปภาพไปยัง Supabase Storage Bucket 'room-images'
 * พร้อมระบบ Fallback ผ่าน API Route หากพบข้อจำกัดเรื่องสิทธิ์ (RLS)
 * 
 * @param file ไฟล์รูปภาพที่เลือก
 * @param prefix คำนำหน้าชื่อไฟล์ เช่น 'room' หรือ 'room-type'
 * @returns publicUrl ของรูปภาพที่อัปโหลดสำเร็จ
 */
export async function uploadRoomImageToStorage(file: File, prefix = 'room'): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const cleanExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${cleanExt}`;

  // 1. ลองอัปโหลดผ่าน Supabase Client ฝั่ง Browser โดยตรง
  const { error: directError } = await supabase.storage
    .from('room-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (!directError) {
    const { data: publicUrlData } = supabase.storage
      .from('room-images')
      .getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  }

  // 2. หากมีข้อผิดพลาดเรื่อง RLS หรือนโยบายสิทธิ์ ให้ Fallback ไปยัง API Route ที่ใช้ Service Role
  console.warn('Direct upload failed, falling back to API route:', directError.message);
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileName', fileName);

  const res = await fetch('/api/upload-room-image', {
    method: 'POST',
    body: formData,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || directError.message || 'ไม่สามารถอัปโหลดรูปภาพได้');
  }

  return json.publicUrl;
}
