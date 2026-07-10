# Admin Login Issue - Quick Fix

## The Problem

You're getting "Invalid credentials" because you're trying to **LOGIN** but you haven't **CREATED AN ACCOUNT** yet.

---

## Solution: Create Admin Account First

### Step 1: Set Up Database (One-Time Setup)

1. **Go to Supabase SQL Editor**: https://supabase.com/dashboard/project/zuppuxrammhisswduryw/sql/new

2. **Copy and run** the entire `SETUP_ADMIN_AUTH.sql` file

3. **Click "Run"**

This creates:
- ✅ `profiles` table to store user roles
- ✅ Automatic profile creation on signup
- ✅ Proper RLS policies

---

### Step 2: Create Your First Admin Account

1. **Open admin panel**: http://localhost:5174

2. **Click** "Need an admin account? Register"

3. **Fill in the form**:
   - Full Name: `Admin User` (or your name)
   - Email: `admin@xpool.com`
   - Password: `admin123` (min 6 characters)

4. **Click "Create Account"**

5. **You're in!** Dashboard should load

---

## Understanding the Flow

### First Time (Signup):
```
1. Click "Register" tab
2. Enter email + password + name
3. Account created in Supabase Auth
4. Profile created with role='admin'
5. Redirected to dashboard ✅
```

### After That (Login):
```
1. Use "Login" tab
2. Enter same email + password
3. System checks if role='admin'
4. If yes → Dashboard ✅
5. If no → "Access denied" ❌
```

---

## What Tables Are Needed?

### 1. `auth.users` (Built-in by Supabase)
- Stores email, password (hashed)
- Created automatically when you signup
- You don't need to create this

### 2. `profiles` (Custom table - YOU create this)
- Stores user metadata (name, role, etc.)
- Links to `auth.users` via `id`
- **Run SETUP_ADMIN_AUTH.sql to create**

### 3. `drivers` (Already exists)
- Stores driver documents
- You already have this

---

## Common Errors

### "Invalid credentials"
**Cause**: No account exists with that email  
**Fix**: Use "Register" tab first, not "Login"

### "Access denied: Not an administrator"
**Cause**: Account exists but `role` is not 'admin'  
**Fix**: 
1. Go to Supabase → Table Editor → profiles
2. Find your user
3. Change `role` to `'admin'`

### "Email already registered"
**Cause**: Account already exists  
**Fix**: Use "Login" tab instead of "Register"

---

## Quick Test

After running the SQL:

1. **Register** with: admin@xpool.com / admin123
2. **Should redirect** to dashboard
3. **If not**, check browser console for errors
4. **If "Access denied"**, manually set role to 'admin' in Supabase

---

## Next Steps

1. ✅ Run `SETUP_ADMIN_AUTH.sql` in Supabase
2. ✅ Create admin account via "Register"
3. ✅ Login and view pending drivers
4. ✅ Approve/reject driver applications
