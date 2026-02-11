/**
 * Database setup and initialization for the Vim scooter app.
 * Uses better-sqlite3 (synchronous API).
 */

const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DB_PATH || './data/vim.db';

let db;

/**
 * Get or create the database connection.
 * @returns {Database} The better-sqlite3 database instance
 */
function getDb() {
  if (!db) {
    const dbPath = path.resolve(DB_PATH);
    const dir = path.dirname(dbPath);

    // Ensure directory exists
    const fs = require('fs');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath);

    // Enable WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * Create all database tables if they don't exist.
 */
function createTables() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      balance REAL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scooters (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      model TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'in_use', 'charging', 'maintenance', 'disabled')),
      battery_level INTEGER NOT NULL DEFAULT 100 CHECK(battery_level >= 0 AND battery_level <= 100),
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      price_per_minute REAL NOT NULL DEFAULT 0.39,
      price_to_unlock REAL NOT NULL DEFAULT 1.00,
      last_maintenance TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rentals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      scooter_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
      start_latitude REAL,
      start_longitude REAL,
      end_latitude REAL,
      end_longitude REAL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_minutes REAL,
      distance_km REAL,
      unlock_fee REAL,
      per_minute_cost REAL,
      total_cost REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (scooter_id) REFERENCES scooters(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      rental_id TEXT,
      type TEXT NOT NULL CHECK(type IN ('charge', 'topup', 'refund')),
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
      description TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (rental_id) REFERENCES rentals(id)
    );

    CREATE INDEX IF NOT EXISTS idx_scooters_status ON scooters(status);
    CREATE INDEX IF NOT EXISTS idx_scooters_code ON scooters(code);
    CREATE INDEX IF NOT EXISTS idx_rentals_user_id ON rentals(user_id);
    CREATE INDEX IF NOT EXISTS idx_rentals_status ON rentals(status);
    CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
  `);
}

/**
 * Seed the database with scooters scattered around Southwest Florida.
 */
function seedScooters() {
  const database = getDb();

  // Check if scooters already exist
  const count = database.prepare('SELECT COUNT(*) as count FROM scooters').get();
  if (count.count > 0) {
    return; // Already seeded
  }

  const now = new Date().toISOString();

  // Realistic Southwest Florida locations across different areas
  const scooterData = [
    // Downtown Fort Myers / River District
    { lat: 26.6487, lng: -81.8723, model: 'Vim Pro', battery: 95, status: 'available' },
    { lat: 26.6462, lng: -81.8695, model: 'Vim Lite', battery: 82, status: 'available' },
    { lat: 26.6441, lng: -81.8751, model: 'Vim Max', battery: 68, status: 'available' },
    { lat: 26.6510, lng: -81.8680, model: 'Vim Pro', battery: 44, status: 'charging' },

    // Fort Myers Beach
    { lat: 26.4520, lng: -81.9500, model: 'Vim Pro', battery: 91, status: 'available' },
    { lat: 26.4480, lng: -81.9460, model: 'Vim Lite', battery: 76, status: 'available' },
    { lat: 26.4540, lng: -81.9530, model: 'Vim Max', battery: 55, status: 'available' },
    { lat: 26.4500, lng: -81.9485, model: 'Vim Lite', battery: 23, status: 'charging' },

    // Naples - 5th Avenue / Downtown
    { lat: 26.1420, lng: -81.7948, model: 'Vim Pro', battery: 88, status: 'available' },
    { lat: 26.1450, lng: -81.7980, model: 'Vim Lite', battery: 72, status: 'available' },
    { lat: 26.1395, lng: -81.7920, model: 'Vim Max', battery: 64, status: 'available' },
    { lat: 26.1475, lng: -81.8010, model: 'Vim Pro', battery: 35, status: 'maintenance' },

    // Cape Coral
    { lat: 26.5629, lng: -81.9495, model: 'Vim Lite', battery: 97, status: 'available' },
    { lat: 26.5680, lng: -81.9450, model: 'Vim Pro', battery: 81, status: 'available' },

    // Sanibel Island
    { lat: 26.4389, lng: -82.0210, model: 'Vim Max', battery: 93, status: 'available' },
    { lat: 26.4420, lng: -82.0150, model: 'Vim Pro', battery: 66, status: 'available' },
    { lat: 26.4350, lng: -82.0280, model: 'Vim Lite', battery: 48, status: 'available' },

    // Bonita Springs
    { lat: 26.3398, lng: -81.7787, model: 'Vim Pro', battery: 85, status: 'available' },
    { lat: 26.3450, lng: -81.7820, model: 'Vim Max', battery: 71, status: 'available' },

    // Estero
    { lat: 26.4381, lng: -81.8068, model: 'Vim Lite', battery: 58, status: 'available' },
    { lat: 26.4320, lng: -81.8100, model: 'Vim Pro', battery: 90, status: 'available' },

    // Marco Island
    { lat: 25.9410, lng: -81.7185, model: 'Vim Max', battery: 77, status: 'available' },
    { lat: 25.9380, lng: -81.7220, model: 'Vim Pro', battery: 42, status: 'charging' },

    // Captiva Island
    { lat: 26.5250, lng: -82.1880, model: 'Vim Lite', battery: 100, status: 'available' },
    { lat: 26.5210, lng: -82.1850, model: 'Vim Pro', battery: 86, status: 'available' },

    // Punta Gorda
    { lat: 26.9298, lng: -82.0454, model: 'Vim Max', battery: 74, status: 'available' },
    { lat: 26.9320, lng: -82.0420, model: 'Vim Pro', battery: 62, status: 'available' },
    { lat: 26.9280, lng: -82.0490, model: 'Vim Lite', battery: 29, status: 'maintenance' },

    // Lehigh Acres
    { lat: 26.6252, lng: -81.6247, model: 'Vim Pro', battery: 83, status: 'available' },
    { lat: 26.6280, lng: -81.6210, model: 'Vim Max', battery: 51, status: 'available' },

    // Pine Island
    { lat: 26.6350, lng: -82.1200, model: 'Vim Lite', battery: 69, status: 'available' },
    { lat: 26.6310, lng: -82.1170, model: 'Vim Pro', battery: 20, status: 'charging' },
  ];

  const insert = database.prepare(`
    INSERT INTO scooters (id, code, model, status, battery_level, latitude, longitude, price_per_minute, price_to_unlock, last_maintenance, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = database.transaction((scooters) => {
    scooters.forEach((scooter, index) => {
      const code = `VIM-${String(index + 1).padStart(4, '0')}`;
      const pricePerMinute = scooter.model === 'Vim Max' ? 0.49 : scooter.model === 'Vim Pro' ? 0.39 : 0.29;
      const priceToUnlock = scooter.model === 'Vim Max' ? 1.50 : 1.00;

      // Generate a random last maintenance date within the past 30 days
      const maintenanceDate = new Date();
      maintenanceDate.setDate(maintenanceDate.getDate() - Math.floor(Math.random() * 30));

      insert.run(
        uuidv4(),
        code,
        scooter.model,
        scooter.status,
        scooter.battery,
        scooter.lat,
        scooter.lng,
        pricePerMinute,
        priceToUnlock,
        maintenanceDate.toISOString(),
        now
      );
    });
  });

  insertMany(scooterData);
  console.log(`Seeded ${scooterData.length} scooters across Southwest Florida`);
}

/**
 * Initialize the database: create tables and seed data.
 */
function initializeDatabase() {
  createTables();
  seedScooters();
  console.log('Database initialized successfully');
}

module.exports = {
  getDb,
  initializeDatabase,
};
