# GoAmaze Admin Portal ⚡

Standalone administrative dashboard, content management system, and back-office API suite for **GoAmaze**.

---

## 🚀 Features

- **🔐 Passwordless OTP Authentication**: Secure 6-digit numeric OTP sent via Resend with brute-force protection and inactivity auto-logout.
- **🛍️ Product Catalog Suite**: Full CRUD operations for products, multi-image Cloudinary gallery uploads, Amazon URL scraper, and badge management.
- **🎨 $0 Social Media Studio**: Client-side HTML5 canvas graphics generation (Pinterest 1000x1500 & Instagram 1080x1080), AI human model prompts, and PAS voiceover reels generator.
- **📝 Buying Guides Studio**: Full Markdown authoring studio with direct AI search summaries (AEO), geographic target settings (GEO), Schema.org FAQ generator, and product embedder.
- **🏷️ Categories Manager**: Custom category creation with icon and slug auto-generation.
- **📧 Newsletter Manager**: Real-time subscriber table with search, category segmentation, and CSV export.
- **⚡ Supabase Integration**: Real-time cloud persistence on PostgreSQL with fallback support.

---

## 🛠️ Quick Start

### 1. Install Dependencies

```bash
cd goamaze-admin
npm install
```

### 2. Environment Variables

Ensure `.env` or `.env.local` contains your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_32_plus_char_secret
ADMIN_EMAIL=salesgoamaze@gmail.com
ADMIN_PASSWORD=GoAmaze@2024!
RESEND_API_KEY=re_your_api_key_here
CLOUDINARY_CLOUD_NAME=dvegrvnzl
CLOUDINARY_UPLOAD_PRESET=zudl2v7z
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

> Note: `goamaze-admin` defaults to port `3001` so that `goamaze-store` (port `3000`) and `goamaze-admin` can run simultaneously.

---

## 🚢 Production Build

```bash
npm run build
npm run start
```

---

*GoAmaze Admin Portal — Version 1.0 (2026).*
