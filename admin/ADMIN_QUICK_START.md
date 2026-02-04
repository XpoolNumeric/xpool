# Admin Panel Quick Start

## 🚀 Start Admin Panel

```bash
cd c:/Users/abish/Downloads/xpool/admin
npm run dev
```

Opens at: **http://localhost:5173**

---

## 📝 First Time Setup

### 1. Create Admin Account
- Click "Need an admin account? Register"
- Fill in:
  - Name: Your name
  - Email: admin@xpool.com
  - Password: admin123 (min 6 chars)
- Click "Create Account"

### 2. You're In!
- Dashboard loads automatically
- Shows pending drivers (if any)

---

## ✅ Verify Driver Documents

### View Pending Drivers
1. Dashboard shows list of pending drivers
2. Click on any driver card

### Review Documents
You'll see:
- ✅ Personal details (name, phone, email, etc.)
- ✅ Vehicle info (number, type)
- ✅ 4 vehicle photos (front, back, left, right)
- ✅ 7+ document scans (DL, RC, ID, Insurance)

### Approve or Reject
- **Green "Approve"** button → Driver can accept rides
- **Red "Reject"** button → Driver must resubmit

---

## 🔧 Troubleshooting

### No pending drivers?
- Upload documents from main app first
- Refresh dashboard

### Images not loading?
- Check browser console for errors
- Verify storage policies (see FIX_STORAGE_POLICIES.sql)

### Can't login as admin?
- Go to Supabase → profiles table
- Set your user's `role` to `'admin'`

---

## 📊 What You Can Do

- **Dashboard**: View pending driver applications
- **Users**: Manage all users
- **Trips**: View all trips
- **Withdrawals**: Handle withdrawal requests
- **Driver Review**: Approve/reject drivers

---

## ✨ That's It!

Your admin panel is fully functional and connected to Supabase. Just create an account and start verifying drivers!
