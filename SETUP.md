# HMS 3.0 - Quick Start Guide

## Step 1: Install Node.js
Download and install from: https://nodejs.org/
(Choose LTS version - currently v20.x)

## Step 2: Extract HMS 3.0
Extract the HMS-3.0 folder to your desired location (e.g., D:\HMS-3.0)

## Step 3: Install Dependencies
Open Command Prompt or Terminal in the HMS-3.0 folder:

```bash
cd path/to/HMS-3.0
npm install
```

This will install:
- express (web server)
- express-session (session management)
- sqlite3 (database)
- node-cron (backup scheduler)

## Step 4: Start the Server

For production:
```bash
npm start
```

For development (auto-restart on code changes):
```bash
npm run dev
```

You should see:
```
✅ Database connected
✅ Database schema initialized
✅ HMS 3.0 Server running on http://localhost:3000
📊 Admin panel: http://localhost:3000/admin
🔐 Login: http://localhost:3000/login
✅ Auto-backup scheduled: Daily at 23:00 (retention: 30 days)
```

## Step 5: Login
Open browser and go to: http://localhost:3000/login

Default credentials:
- Username: admin
- Password: admin123

## Step 6: Change Default Password
1. Go to User Management tab
2. Click "Reset Password" for admin user
3. Set a strong password
4. Save

## Step 7: Create Users
1. Go to User Management tab
2. Click "Add User"
3. Fill in details:
   - Username (will be case-insensitive)
   - Full Name (optional but recommended)
   - Password (minimum 6 characters)
   - Role (admin, reception, doctor, nurse, lab, pharmacy, management)
   - Active status
4. Click "Save User"

## Troubleshooting

### Port 3000 already in use
Edit backend/server.js and change:
```javascript
const PORT = process.env.PORT || 3000;
```
to
```javascript
const PORT = process.env.PORT || 3001; // or any other port
```

### Database not initializing
Delete database/hospital.db and restart the server.
It will recreate the database with the default admin user.

### Cannot login
Make sure:
1. Server is running (check terminal for errors)
2. Using correct credentials (username is case-insensitive)
3. Check browser console for errors (F12 → Console)

### Backup not working
Check that database/backups folder exists and has write permissions.

## Next Steps
Once the admin module is working:
1. Create users for different roles
2. Configure auto-backup settings
3. Familiarize yourself with the interface
4. Wait for Reception module (next session!)

## File Locations
- Database: database/hospital.db
- Backups: database/backups/
- Logs: Check terminal/console

## Server Commands
- Start: npm start
- Dev mode: npm run dev
- Stop: Ctrl+C in terminal

---

Need help? Check README.md for detailed documentation.
