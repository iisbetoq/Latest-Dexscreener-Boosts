# Latest Dexscreener Boosts

Browser viewer ringan untuk mengecek boost Solana terbaru dari Dexscreener.

## Jalankan

```bash
npm run dev
```

Lalu buka:

http://localhost:3000

## Step By Step

1. Install Node.js kalau belum ada.
2. Jalankan `npm install` di folder project.
3. Jalankan `npm run dev`.
4. Buka `http://localhost:3000`.
5. Lihat boost Solana terbaru, urut dari `Sisa` paling kecil.

## Catatan

Halaman ini hanya menampilkan chain `solana`.
Data diambil dari `token-boosts/latest/v1`, lalu difilter ke boost dengan `paymentTimestamp` dalam window `<= 24 jam`.
Baris diurutkan berdasarkan `Sisa` paling kecil di atas.
Kolom token menampilkan badge `fresh` untuk token baru dan `old` untuk token berumur lebih dari 1 tahun.
Link `DEX` dan `GMGN` ada di kolom paling kanan.

## Copyright

Copyright (c) 2026 Codex
