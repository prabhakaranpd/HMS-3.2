// Set timezone to Indian Standard Time
process.env.TZ = 'Asia/Kolkata';

const express = require('express');
const session = require('express-session');
const path = require('path');
const { initializeAutoBackup } = require('./utils/backup');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: 'hms-3.0-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true
  }
}));

// Static files - must come before routes
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
app.use('/shared', express.static(path.join(__dirname, '..', 'frontend', 'shared')));
app.use('/admin', express.static(path.join(__dirname, '..', 'frontend', 'admin')));
app.use('/reception', express.static(path.join(__dirname, '..', 'frontend', 'reception')));

// Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const receptionRoutes = require('./routes/reception');

app.use('/', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reception', receptionRoutes);

// Admin page route (must come after static files)
app.get('/admin-dashboard', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, '..', 'frontend', 'admin', 'admin.html'));
});

// Reception page route
app.get('/reception-dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  const allowedRoles = ['admin', 'reception'];
  if (!allowedRoles.includes(req.session.user.role)) {
    return res.status(403).send('Access denied');
  }
  
  res.sendFile(path.join(__dirname, '..', 'frontend', 'reception', 'reception.html'));
});

// Placeholder routes for other modules (to be implemented)
const moduleRedirect = (moduleName) => (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>HMS 3.0 - ${moduleName}</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        }
        .container {
          text-align: center;
          background: white;
          padding: 48px;
          border-radius: 16px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }
        h1 { color: #1e293b; margin: 0 0 16px 0; }
        p { color: #64748b; margin: 0 0 24px 0; }
        a {
          display: inline-block;
          padding: 12px 24px;
          background: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
        }
        a:hover { background: #1e40af; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${moduleName} Module</h1>
        <p>Coming soon in HMS 3.0</p>
        <a href="/logout">Logout</a>
      </div>
    </body>
    </html>
  `);
};

app.get('/reception', moduleRedirect('Reception'));
app.get('/doctor', moduleRedirect('Doctor'));
app.get('/nurse', moduleRedirect('Nurse'));
app.get('/lab', moduleRedirect('Lab'));
app.get('/pharmacy', moduleRedirect('Pharmacy'));
app.get('/management', moduleRedirect('Management'));

// 404 handler
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal server error');
});

// Start server
app.listen(PORT, () => {
  console.log(`\n✅ HMS 3.0 Server running on http://localhost:${PORT}`);
  console.log(`📊 Admin panel: http://localhost:${PORT}/admin-dashboard`);
  console.log(`🔐 Login: http://localhost:${PORT}/login\n`);
  
  // Initialize auto-backup
  initializeAutoBackup();
});
