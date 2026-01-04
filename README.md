# HMS 3.0 - Hospital Management System

## 🎯 Overview
HMS 3.0 is a clean, modular hospital management system built from scratch with modern web technologies. This version focuses on eliminating redundant code and establishing a solid foundation for future modules.

## ✨ Features (Admin Module - v3.0)

### Authentication
- ✅ Secure login system with session management
- ✅ Simple IP-based auto-blocking (5 attempts = 30 min block)
- ✅ Case-insensitive usernames
- ✅ Active session tracking

### Admin Dashboard
- ✅ Real-time statistics (users, sessions, patients)
- ✅ Recent activity feed
- ✅ Clean, modern UI with responsive design

### User Management
- ✅ Create, Read, Update, Delete users
- ✅ Role-based access control (7 roles)
- ✅ Activate/Deactivate accounts
- ✅ Password reset functionality
- ✅ Username validation (case-insensitive)

### Security
- ✅ Active session monitoring
- ✅ Force logout capability
- ✅ Login history (last 30 days)
- ✅ Session duration tracking

### Database Backup
- ✅ Manual backup (instant download)
- ✅ Automated daily backups
- ✅ Configurable retention period (default: 30 days)
- ✅ Backup scheduling (default: 11 PM)
- ✅ Enable/Disable auto-backup

## 📁 Project Structure

```
HMS-3.0/
├── backend/
│   ├── server.js                 # Main Express server
│   ├── config/
│   │   └── db.js                 # Database connection
│   ├── middleware/
│   │   └── auth.js               # Authentication middleware
│   ├── routes/
│   │   ├── auth.js               # Login/Logout routes
│   │   └── admin.js              # Admin API routes
│   └── utils/
│       └── backup.js             # Backup automation
│
├── frontend/
│   ├── shared/
│   │   ├── css/
│   │   │   ├── variables.css     # CSS variables
│   │   │   ├── layout.css        # Layout & reset
│   │   │   └── components.css    # Reusable components
│   │   └── js/
│   │       ├── api.js            # API wrapper
│   │       └── utils.js          # Utility functions
│   │
│   ├── admin/
│   │   ├── admin.html            # Admin panel
│   │   ├── css/
│   │   │   └── admin.css         # Admin styles
│   │   └── js/
│   │       ├── main.js           # Entry point
│   │       ├── navigation.js     # Tab navigation
│   │       ├── dashboard.js      # Dashboard logic
│   │       ├── users.js          # User management
│   │       ├── security.js       # Security features
│   │       └── backup.js         # Backup management
│   │
│   └── public/
│       └── login.html            # Login page
│
├── database/
│   ├── schema.sql                # Database schema
│   ├── hospital.db               # SQLite database
│   └── backups/                  # Auto-backup folder
│
├── package.json
└── .gitignore
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm

### Steps

1. **Navigate to project folder**
```bash
cd HMS-3.0
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the server**
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

4. **Access the application**
- Login: http://localhost:3000/login
- Admin Panel: http://localhost:3000/admin

### Default Credentials
- Username: `admin`
- Password: `admin123`

**⚠️ IMPORTANT: Change the default password immediately after first login!**

## 🗄️ Database Schema

### Users Table
```sql
- id (Primary Key)
- username (Unique, Case-insensitive)
- password (Plain text - TODO: Migrate to bcrypt)
- full_name
- role (admin, reception, doctor, nurse, lab, pharmacy, management)
- is_active (1/0)
- created_at, updated_at
```

### Active Sessions Table
```sql
- session_id (Primary Key)
- user_id, username, role
- ip_address, user_agent
- login_time, last_activity
```

### Login History Table
```sql
- id (Primary Key)
- user_id, username
- login_time, logout_time
- session_duration (seconds)
- ip_address, user_agent
- logout_reason
```

### System Settings Table
```sql
- key (Primary Key)
- value
- updated_at
```

## 🔐 Security Features

### Authentication
- Session-based authentication
- No session timeout (persistent until manual logout)
- Case-insensitive username matching

### Auto IP Blocking
- 5 failed login attempts = 30-minute block
- In-memory tracking (resets on server restart)
- Simple implementation for basic brute-force protection

### Password Policy
- Minimum 6 characters (basic for now)
- Plain text storage (⚠️ TODO: Migrate to bcrypt)

## 🎨 UI/UX Features

### Design System
- Modern, clean interface
- Consistent color palette
- Reusable CSS components
- Responsive layout
- Smooth transitions

### Components
- Cards, Buttons, Forms
- Tables with hover effects
- Modals for user actions
- Toast notifications
- Loading states
- Empty states

## 📝 API Endpoints

### Authentication
```
POST   /login              - User login
GET    /logout             - User logout
GET    /                   - Root redirect
```

### Admin Dashboard
```
GET    /api/admin/stats             - Get dashboard statistics
GET    /api/admin/activity          - Get recent activity
```

### User Management
```
GET    /api/admin/users             - Get all users
POST   /api/admin/users             - Create new user
PUT    /api/admin/users/:id         - Update user
DELETE /api/admin/users/:id         - Delete user
PUT    /api/admin/users/:id/password - Reset password
```

### Security
```
GET    /api/admin/sessions          - Get active sessions
DELETE /api/admin/sessions/:id      - Force logout session
GET    /api/admin/login-history     - Get login history
```

### Backup
```
GET    /api/admin/backup/settings   - Get backup settings
PUT    /api/admin/backup/settings   - Update backup settings
GET    /api/admin/backup/download   - Download database backup
GET    /api/admin/backup/list       - List available backups
```

## 🛣️ Roadmap

### Immediate (Next Session)
- [ ] Reception Module
  - Patient registration
  - Smart search
  - Queue management

### Future Modules
- [ ] Doctor Module (Consultation, Prescription)
- [ ] Nurse Station (Vitals, OP Register)
- [ ] Lab Module (Tests, Reports)
- [ ] Pharmacy Module (Dispensing)
- [ ] Management Module (Reports, Analytics)

### Security Enhancements
- [ ] Migrate to bcrypt password hashing
- [ ] Add password strength requirements
- [ ] Implement session timeout option
- [ ] Add 2FA support
- [ ] Database backup encryption

### Features
- [ ] SMS Integration
- [ ] Email notifications
- [ ] Audit logging
- [ ] Advanced reporting
- [ ] Data export/import

## 🧪 Testing

### Manual Testing Checklist
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (test IP blocking)
- [ ] Create new user
- [ ] Edit user
- [ ] Delete user
- [ ] Reset password
- [ ] View active sessions
- [ ] Force logout user
- [ ] Download backup
- [ ] Enable/disable auto-backup
- [ ] Navigate between tabs

## 🐛 Known Issues
None currently! 🎉

## 📄 License
MIT License - Free to use and modify

## 👨‍💻 Development Notes

### Code Style
- Use camelCase for JavaScript
- Use kebab-case for CSS classes
- Use snake_case for database columns
- Keep functions small and focused
- Comment only when necessary

### File Organization
- One module = One concern
- Shared code goes in `/shared`
- Module-specific code in module folder
- Keep server.js minimal

### Database
- SQLite for simplicity
- Easy migration to PostgreSQL/MySQL later
- Use transactions for critical operations
- Regular backups automated

## 🆘 Support
For issues or questions, refer to the code comments or create an issue in the repository.

---

**Built with ❤️ for Sri Venkateswara Children's Hospital**
