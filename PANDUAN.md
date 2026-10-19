# Panduan Pemasangan — PTSL & Letter C Desa Kadakajaya (online)

Isi folder `repo/` ini diunggah ke GitHub. Folder `data-awal-JANGAN-DIUNGGAH/` berisi data asli (NIK, nama) — **jangan pernah diunggah ke GitHub**.

## 1. Buat proyek Supabase
1. Daftar di supabase.com → **New project** (region Singapore; catat database password).
2. Buka **SQL Editor** → tempel seluruh isi `schema.sql` → **Run**. (Aman dijalankan ulang.)
3. **Project Settings → API**: salin **Project URL** dan **anon public key**. *Jangan* memakai `service_role`.
4. **Authentication → Providers → Email**: aktifkan. Agar mudah, matikan "Confirm email" (atau biarkan aktif bila ingin verifikasi email).
5. **Authentication → URL Configuration**: isi **Site URL** dengan alamat GitHub Pages Anda (langkah 3).

## 2. Isi `config.js`
```js
window.SB_CONFIG={ url:'https://XXXX.supabase.co', anonKey:'eyJ...', links:{ptsl:'ptsl.html',letterc:'letter-c.html',home:'index.html'} };
```

## 3. Publikasikan ke GitHub Pages
1. Buat repository GitHub baru, unggah seluruh isi `repo/` (index.html, ptsl.html, letter-c.html, sb-core.js, config.js, schema.sql, .gitignore).
2. **Settings → Pages → Branch: main / (root)** → Save. Alamat: `https://USERNAME.github.io/NAMA-REPO/`.

## 4. Pengguna pertama = admin
1. Buka situs → **Daftar** dengan email Anda. Pendaftar **pertama** otomatis menjadi **admin** aktif.
2. Petugas lain mendaftar sendiri; akun mereka **tidak aktif** sampai admin membukanya di **👥 Kelola Pengguna** (pojok kanan bawah): aktifkan, pilih peran, dan atur hak per modul — Pengajuan PTSL, Pemberkasan, Letter C — masing-masing *tidak / baca / tulis*.

## 5. Impor data lama (sekali, oleh admin)
- **PTSL:** di aplikasi lama klik **Ekspor DB** (JSON berisi status & berkas Anda). Di `ptsl.html` klik **Impor DB**. Bila tidak punya ekspor, pakai `data-awal-JANGAN-DIUNGGAH/data-awal-ptsl.json` (968 pengajuan, 4.024 penduduk, 3.275 DHKP; semua status "Pendaftaran").
- **Letter C:** di aplikasi lama **Backup JSON**; di `letter-c.html` menu Backup → **Restore**.
- Impor ±8.000 baris butuh beberapa detik; tunggu status "✔ Tersinkron".

## Cara kerja multi-pengguna
- Perubahan satu pengguna tampil langsung di layar pengguna lain.
- Tiap data punya nomor versi: bila dua orang mengubah data yang sama bersamaan, yang menyimpan belakangan diberi peringatan dan layarnya dimuat ulang dari server (tidak ada yang tertimpa diam-diam).
- **Pemberkasan → Hubungkan Letter C** mengambil nomor C, persil, luas, dan riwayat/mutasi dari data Letter C yang sama.
- Admin dapat melihat **Log aktivitas** (siapa menambah/mengubah/menghapus apa).

## Keamanan
- Halaman GitHub Pages bersifat publik, tetapi **data hanya terbaca setelah login**, dijaga RLS di database. `anon key` boleh terlihat; `service_role key` tidak boleh ada di berkas mana pun.
- Jangan menaruh JSON ekspor/backup di repository (`.gitignore` sudah memblokir `*.json`).
- Paket gratis Supabase: proyek dijeda bila 1 minggu tidak aktif dan **tidak ada backup otomatis**. Unduh **Ekspor DB / Backup JSON** berkala.
- Pengguna berhak *baca* tetap melihat tombol edit, tetapi perubahannya ditolak server dan dikembalikan.
- Kalibrasi cetak (geser mm, ukuran huruf) disimpan per perangkat.

## Uji cepat setelah terpasang
1. Login admin → tambah entri Letter C → buka `ptsl.html` di perangkat lain → Pemberkasan → Hubungkan Letter C.
2. Daftar akun kedua → awalnya ditolak ("belum diaktifkan") → aktifkan sebagai *baca* → coba ubah data → harus ditolak.
