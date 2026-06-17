import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

async function getUserIdFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId;
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const userId = await getUserIdFromToken();
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('avatar');
    if (!file) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validasi tipe file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: 'File harus gambar (JPEG, PNG, WEBP)' }, { status: 400 });
    }

    // Maksimal 2MB
    if (file.size > 2 * 1024 * 1024) {
      return Response.json({ error: 'File maksimal 2MB' }, { status: 400 });
    }

    // Konversi file ke buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Nama file unik
    const ext = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${ext}`;
    const filePath = `${fileName}`;

    // Upload ke Supabase Storage bucket 'avatars'
    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return Response.json({ error: 'Gagal upload foto' }, { status: 500 });
    }

    // Dapatkan public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    // Update foto_url di tabel users
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ foto_url: publicUrl })
      .eq('id', userId);

    if (updateError) {
      console.error('Update error:', updateError);
      return Response.json({ error: 'Gagal update foto profil' }, { status: 500 });
    }

    // (Opsional) Hapus foto lama jika ada - bisa diimplementasikan nanti

    return Response.json({ success: true, fotoUrl: publicUrl });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}