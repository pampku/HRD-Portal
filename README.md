# HRD Portal v2

Portal HRD + portal karyawan (self-service) untuk cuti & izin, dengan alur request → review → approval, saldo cuti, dan pembaruan otomatis tiap tahun masa kerja.

## Struktur

| File | Isi |
|---|---|
| `index.html`, `styles.css` | Tampilan |
| `app.js` | Logika layar & interaksi |
| `logic.js` | Aturan bisnis murni (hitung hari, renewal, lock, alur approval) — diuji otomatis |
| `company.js` | Aturan multi-PT (siapa melihat PT mana) dan hitung hari libur — diuji otomatis |
| `kinds.js` | Katalog jenis pengajuan dan aturannya — diuji otomatis |
| `workcal.js`, `report.js` | Kalender Kerja dan laporan absensi — diuji otomatis |
| `xlsx.js`, `pdf.js` | Penulis file Excel dan PDF tanpa library |
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
- **Jenis**: lihat bagian *Jenis pengajuan* di bawah. Hanya kelompok Cuti yang memotong saldo.
- **Auto renewal**: tiap kali karyawan genap 1, 2, 3, … tahun masa kerja, saldo diperbarui: sisa positif dibawa maksimal `maxCarryOver` (default 0), hutang dipotong dari jatah baru (default 12 hari). Pengaturan ada di menu **Pengaturan** (Superuser). Pembaruan dijalankan otomatis saat Staff HRD / Kepala HRD / Superuser membuka portal.
- **Lock bulan**: lewat tanggal 10, pengajuan untuk bulan lalu dan sebelumnya dikunci.

## Multi-PT (beberapa perusahaan)

- **Owner** = akun Superuser yang dibuat di layar Setup awal. Owner selalu melihat semua PT dan satu-satunya yang bisa menambah PT (menu **Perusahaan**).
- Setiap akun punya **PT utama**. Role selain owner hanya melihat karyawan, pengajuan, mutasi, dan laporan di PT yang boleh diaksesnya. Contoh: Kepala HRD PT A hanya melihat PT A.
- **Akses lebih dari satu PT** bisa diberikan ke role apa pun (mis. Kepala HRD dengan PT A dan PT B dicentang). Yang boleh menentukannya hanya **owner, Direktur, dan Komisaris**, lewat tombol **Akses PT** di menu Karyawan/Akun atau kotak centang saat owner membuat akun. Direktur/Komisaris hanya bisa membagikan PT yang ia miliki sendiri. Staff HRD yang membuat akun tidak bisa memberi akses PT lain.
- Akun dengan akses beberapa PT mendapat pemilih **Perusahaan** di bagian atas untuk menyaring tampilan. Perubahan akses berlaku saat akun itu login berikutnya.
- Staff HRD membuat akun hanya di PT miliknya dan hanya Staff Biasa / Staff HRD.

## Jenis pengajuan (menu Ajukan)

Aturan ada di `kinds.js` (diuji otomatis). Lampiran berupa **foto** yang dikompres di browser (maks 3 foto, tiap foto sekitar 230 KB) dan disimpan di Firestore, tanpa Firebase Storage.

| Kelompok | Jenis | Aturan |
|---|---|---|
| **Cuti** (memotong jatah) | Mendesak, Acara Keluarga, Liburan | Keterangan opsional |
| | Lainnya | Wajib keterangan jelas (min. 10 karakter) |
| **Izin** (tidak memotong) | Sakit | 1 hari boleh tanpa surat; lebih dari 1 hari wajib foto surat dokter |
| | Keluarga Inti Sakit | Pilih keluarga (dropdown); 1 hari tanpa surat; lebih dari 1 hari wajib surat dokter, maks 3 hari |
| | Lainnya | Hanya 1 hari, wajib keterangan |
| | Datang Terlambat / Pulang Terlambat | 1 hari, wajib alasan, **disetujui otomatis** tapi tetap muncul di riwayat, maks 3x per bulan (dihitung terpisah untuk tiap jenis) |
| **Cuti Khusus** (tidak memotong) | Melahirkan | Maks 90 hari kalender (tidak terkait Sabtu/Minggu/tanggal merah), wajib foto HPL |
| | Keguguran | Maks 2 hari, wajib surat dokter |
| | Pernikahan | Maks 3 hari, wajib foto undangan. Setelah disetujui (Kepala HRD bila diajukan staff) tampil ucapan "Selamat atas pernikahan ..." + foto undangan di beranda seluruh karyawan PT itu sampai masa cuti habis |
| | Kematian Keluarga Inti | Maks 3 hari, pilih keluarga (dropdown) |
| | Istri Melahirkan | Maks 7 hari |

- **Hari dihitung = hari kerja**: Sabtu, Minggu, dan tanggal merah tidak dihitung (kecuali Cuti Melahirkan yang memakai hari kalender).
- **Peringatan izin berlebih**: bila izin (Sakit, Keluarga Inti Sakit, Izin Lainnya; terlambat tidak dihitung) mencapai **3x dalam sebulan** (bisa diubah owner di Pengaturan), muncul tanda di antrian dan kartu peringatan untuk Staff HRD, Kepala HRD, dan Direktur.

## Kalender Kerja

- Menu **Kalender Kerja** (dulu Libur). **Sabtu dan Minggu selalu libur.**
- Kepala HRD mengubah tanggal merah lewat tombol **Add** di bawah kalender (satu tanggal atau rentang + keterangan), bisa Add berkali-kali, lalu **Ajukan**. Pengajuan **per bulan** dan harus berada di dalam bulan yang sedang dibuka. Menghapus tanggal merah yang sudah berlaku juga lewat draf yang sama.
- Hanya **Direktur** yang menyetujui atau menolak. Setelah disetujui, tanggal merah tidak memotong jatah cuti; pengajuan yang masih menunggu dihitung ulang saat persetujuan akhir.
- Daftar "libur yang berlaku" hanya menampilkan bulan yang sedang dibuka.
- **Khusus owner (Superuser)**: kartu **Riwayat perubahan** per bulan, berisi penambahan/perubahan, siapa yang menyetujui/menolak, dan waktunya sampai **jam:menit:detik**.
- Satu kalender untuk semua PT.

## Laporan Absensi

- Menu **Absensi** untuk Staff HRD, Kepala HRD, Direktur, dan Superuser. Isinya mengikuti PT yang diberi akses (gunakan pemilih Perusahaan bila punya lebih dari satu).
- Rekap per karyawan, matriks harian (H hadir, C cuti, S sakit, I izin, K cuti khusus, T datang terlambat, P pulang terlambat, L libur), dan rincian pengajuan disetujui.
- **Unduh Excel** (.xlsx, 3 sheet) dan **Unduh PDF** (A4 landscape) langsung dari browser.
- Catatan: "Hadir" dihitung dari hari kerja dikurangi cuti/izin/sakit yang disetujui. Portal tidak membaca mesin absen.

## Karyawan baru dan banyak Superuser

- **Staff HRD** dan **Kepala HRD** tidak membuat akun langsung, melainkan menu **Karyawan Baru**: ajukan (nama, username, PT, role, tanggal bergabung). Pengajuan Staff HRD disetujui **Kepala HRD**; pengajuan Kepala HRD disetujui **Direktur**.
- Setelah disetujui, **Kepala HRD membuat akunnya** dan mengisi password awal. Password tidak pernah disimpan di pengajuan.
- Kepala HRD dengan akses beberapa PT memilih PT karyawan; bila hanya satu PT, otomatis PT-nya.
- **Superuser boleh lebih dari satu.** Hanya Superuser yang bisa menambahkannya (menu **Akun**, role Superuser).

## Memulai dari database bersih (setelah pembaruan multi-PT)

Data uji lama tidak memiliki PT, jadi kosongkan dulu:
1. Firebase Console → **Authentication → Users**: hapus semua pengguna.
2. **Firestore Database**: hapus semua koleksi (`users`, `usernames`, `employees`, `ledger`, `requests`, `adjustments`, `attachments`, `announcements`, `employeeRequests`, `holidayBatches`, `calendar`, `calendarLog`, `counters`, `meta`, `settings`).
3. **Firestore → Rules**: tempel `firestore.rules` yang baru, **Publish**. (Aturan lama tidak mengenal PT dan akan menolak akses.)
4. Deploy ulang semua file ke Netlify.
5. Buka situs → layar Setup awal → buat akun owner → menu **Perusahaan** → tambah PT → menu **Akun** → buat akun per PT.

## Yang perlu diketahui tentang aturan keamanan

`firestore.rules` membatasi akses data per PT di sisi server, tetapi belum bisa saya uji di Firebase Emulator. Uji satu putaran di situs sungguhan (login sebagai Kepala HRD PT A, pastikan karyawan PT B tidak terlihat). Alur persetujuan (urutan status) dijaga oleh kode aplikasi, belum sepenuhnya oleh aturan; Staff HRD, Kepala HRD, dan Direktur di PT-nya masih bisa mengubah saldo karyawan lewat konsol. Kalender Kerja berlaku untuk semua PT, sehingga Direktur PT mana pun bisa menyetujuinya.

## Menjalankan tes

```
npm test        # tes logika bisnis
npm run check   # cek sintaks semua file JS
node tests/e2e/e2e.cjs   # tes browser end-to-end (Playwright + Firebase tiruan di memori)
```

Tes e2e menjalankan portal sungguhan di Chromium dan menyetir layar: setup owner → buat PT dan akun → ajukan cuti → review → approval → saldo berkurang, termasuk penolakan, hutang cuti, penyesuaian saldo, auto renewal, ganti password, isolasi antar-PT, akses multi-PT, kalender libur, dan tampilan ponsel. Yang **belum** teruji: koneksi ke Firebase asli dan `firestore.rules` (butuh Firebase Emulator / project sungguhan).
