const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const dbPath = path.join(__dirname, '..', '..', 'database', 'hospital.db');
const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
  }
  console.log('✅ Database connected:', dbPath);
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

/**
 * Initialize database schema
 */
function initializeDatabase() {
  if (!fs.existsSync(schemaPath)) {
    console.log('⚠️  Schema file not found, skipping initialization');
    return;
  }

  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  db.exec(schema, (err) => {
    if (err) {
      console.error('❌ Schema initialization failed:', err);
    } else {
      console.log('✅ Database schema initialized');
    }
  });
}

// Run on startup
initializeDatabase();

module.exports = db;
