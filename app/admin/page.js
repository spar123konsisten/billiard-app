import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function AdminPage() {
  // Ambil semua user yang belum verifikasi
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id, username, no_wa, kota, created_at, verified')
    .eq('verified', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return <div style={{ padding: '24px', color: 'red' }}>Gagal mengambil data user</div>;
  }

  // Untuk setiap user, ambil token verifikasi yang masih valid
  const usersWithToken = await Promise.all(
    users.map(async (user) => {
      const { data: tokenData } = await supabaseAdmin
        .from('verification_tokens')
        .select('token')
        .eq('user_id', user.id)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      return { ...user, token: tokenData?.token || null };
    })
  );

  // Base URL untuk link verifikasi (ubah sesuai domain Anda)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px' }}>Admin Dashboard</h1>
      <p style={{ marginBottom: '16px', color: '#666' }}>User menunggu verifikasi: {usersWithToken.length}</p>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Nama</th>
            <th style={{ padding: '8px' }}>No WA</th>
            <th style={{ padding: '8px' }}>Tanggal Daftar</th>
            <th style={{ padding: '8px' }}>Status</th>
            <th style={{ padding: '8px' }}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {usersWithToken.map((user) => {
            const waLink = user.token
              ? `https://wa.me/${user.no_wa}?text=Klik%20link%20ini%20untuk%20verifikasi%20akun:%20${baseUrl}/verify?token=${user.token}`
              : '#';
            return (
              <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{user.username}</td>
                <td style={{ padding: '8px' }}>{user.no_wa}</td>
                <td style={{ padding: '8px' }}>{new Date(user.created_at).toLocaleDateString('id-ID')}</td>
                <td style={{ padding: '8px' }}>{user.verified ? '✅ Sudah' : '❌ Belum'}</td>
                <td style={{ padding: '8px' }}>
                  {user.token ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '6px 12px',
                        background: '#25D366',
                        color: '#fff',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        display: 'inline-block',
                        fontSize: '13px',
                      }}
                    >
                      Kirim WA
                    </a>
                  ) : (
                    <span style={{ color: '#999', fontSize: '12px' }}>Token tidak tersedia</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}