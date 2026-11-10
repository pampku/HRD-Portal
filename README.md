# HRD Portal v2

Portal HRD + portal karyawan (self-service) untuk cuti & izin, dengan alur request → review → approval, saldo cuti, dan pembaruan otomatis tiap tahun masa kerja.

## Struktur

| File | Isi |
|---|---|
| `index.html`, `styles.css` | Tampilan |
| `app.js` | Logika layar & interaksi |
| `logic.js` | Aturan bisnis murni (hitung hari, renewal, lock, alur approval) — diuji otomatis |
| `company.js` | Aturan multi-PT (siapa melihat PT mana) dan kalender libur — diuji otomatis |
| `firebase.js` | Koneksi Firebase (**isi config di sini**) |
| `firestore.rules` | Aturan keamanan database |
| `tests/` | Tes otomatis (`npm test`) |

## Setup Firebase baru (sekali saja)

1. Buka <https://console.firebase.google.com> → **Add project**.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**.
3. **Build → Firestore Database → Create database** (production mode, pilih region `asia-southeast2` Jakarta).
4. **Firestore → Rules**: tempel seluruh isi `firestore.rules` → **Publish**.
5. **Project settings → Your apps → Web (`</>`)** → salin `firebaseConfig` ke `firebase.js`.
6. Upload semua file ke GitHub repo akun baru, aktifkan **Settings → Pages** (branch `main`, folder `/`).
7. **Authentication → Settings → Authorized domains** → tambahkan domain GitHub Pages Anda (`namaakun.github.io`).
8. Buka situs. Layar **Setup awal** akan muncul: buat akun Superuser pertama. Lakukan segera setelah deploy — setelah itu layar ini tertutup selamanya.

## Cara kerja singkat

- **Login**: username (otomatis menjadi `username@hrd.portal`) atau email asli. Password disimpan oleh Firebase Authentication, tidak lagi di database.
- **Alur cuti**: Staff → review Staff HRD → persetujuan Kepala HRD. Staff HRD → review Staff HRD lain → Kepala HRD. Kepala HRD → Direktur. Tidak ada yang bisa memproses ajuannya sendiri.
- **Jenis**: hanya *Cuti Tahunan, Cuti Besar, Cuti Mendesak, Cuti Wajib, Lainnya* yang memotong saldo. Cuti sakit/khusus dan izin tercatat tanpa memotong saldo (ubah di `LEAVE_TYPES` pada `logic.js` jika kebijakan Anda berbeda).
- **Auto renewal**: tiap kali karyawan genap 1, 2, 3, … tahun masa kerja, saldo diperbarui: sisa positif dibawa maksimal `maxCarryOver` (default 0), hutang dipotong dari jatah baru (default 12 hari). Pengaturan ada di menu **Pengaturan** (Superuser). Pembaruan dijalankan otomatis saat Staff HRD / Kepala HRD / Superuser membuka portal.
- **Lock bulan**: lewat tanggal 10, pengajuan untuk bulan lalu dan sebelumnya dikunci.

## Multi-PT (beberapa perusahaan)

- **Owner** = akun Superuser yang dibuat di layar Setup awal. Owner selalu melihat semua PT dan satu-satunya yang bisa menambah PT (menu **Perusahaan**).
- Setiap akun punya **PT utama**. Role selain owner hanya melihat karyawan, pengajuan, mutasi, dan laporan di PT yang boleh diaksesnya. Contoh: Kepala HRD PT A hanya melihat PT A.
- **Akses lebih dari satu PT** bisa diberikan ke role apa pun (mis. Kepala HRD dengan PT A dan PT B dicentang). Yang boleh menentukannya hanya **owner, Direktur, dan Komisaris**, lewat tombol **Akses PT** di menu Karyawan/Akun atau kotak centang saat owner membuat akun. Direktur/Komisaris hanya bisa membagikan PT yang ia miliki sendiri. Staff HRD yang membuat akun tidak bisa memberi akses PT lain.
- Akun dengan akses beberapa PT mendapat pemilih **Perusahaan** di bagian atas untuk menyaring tampilan. Perubahan akses berlaku saat akun itu login berikutnya.
- Staff HRD membuat akun hanya di PT miliknya dan hanya Staff Biasa / Staff HRD.

## Kalender libur (tanggal merah)

- Menu **Libur**. Hanya **Kepala HRD** yang bisa mengajukan: klik tanggal awal dan tanggal akhir di kalender (bebas, boleh melewati akhir pekan), beri nama, lalu ajukan.
- Hanya **Direktur** yang bisa menyetujui, menolak, atau mencabut libur. Pengaju bisa membatalkan pengajuan yang masih menunggu.
- Setelah disetujui, tanggal diwarnai merah dan **tidak memotong jatah cuti**. Penghitungan memakai tanggal merah yang berlaku **saat persetujuan akhir cuti**, jadi pengajuan yang sudah menunggu ikut dikoreksi (mis. diajukan 7 hari, 3 hari tanggal merah → dipotong 4 hari, tercatat di mutasi).
- Satu kalender untuk semua PT, dan satu pengaturan jatah cuti untuk semua PT (sesuai keputusan Anda).

## Memulai dari database bersih (setelah pembaruan multi-PT)

Data uji lama tidak memiliki PT, jadi kosongkan dulu:
1. Firebase Console → **Authentication → Users**: hapus semua pengguna.
2. **Firestore Database**: hapus semua koleksi (`users`, `usernames`, `employees`, `ledger`, `requests`, `adjustments`, `meta`, `settings`).
3. **Firestore → Rules**: tempel `firestore.rules` yang baru, **Publish**. (Aturan lama tidak mengenal PT dan akan menolak akses.)
4. Deploy ulang semua file ke Netlify.
5. Buka situs → layar Setup awal → buat akun owner → menu **Perusahaan** → tambah PT → menu **Akun** → buat akun per PT.

## Yang perlu diketahui tentang aturan keamanan

`firestore.rules` membatasi akses data per PT di sisi server, tetapi belum bisa saya uji di Firebase Emulator. Uji satu putaran di situs sungguhan (login sebagai Kepala HRD PT A, pastikan karyawan PT B tidak terlihat). Alur persetujuan (urutan status) dijaga oleh kode aplikasi, belum sepenuhnya oleh aturan; Staff HRD, Kepala HRD, dan Direktur di PT-nya masih bisa mengubah saldo karyawan lewat konsol. Libur yang disetujui Direktur berlaku untuk semua PT, sehingga Direktur PT mana pun bisa menyetujui.

## Menjalankan tes

```
npm test        # tes logika bisnis
npm run check   # cek sintaks semua file JS
node tests/e2e/e2e.cjs   # tes browser end-to-end (Playwright + Firebase tiruan di memori)
```

Tes e2e menjalankan portal sungguhan di Chromium dan menyetir layar: setup owner → buat PT dan akun → ajukan cuti → review → approval → saldo berkurang, termasuk penolakan, hutang cuti, penyesuaian saldo, auto renewal, ganti password, isolasi antar-PT, akses multi-PT, kalender libur, dan tampilan ponsel. Yang **belum** teruji: koneksi ke Firebase asli dan `firestore.rules` (butuh Firebase Emulator / project sungguhan).
