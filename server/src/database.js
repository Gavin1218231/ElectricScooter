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
 * Seed the database with scooters scattered around San Francisco.
 */
function seedScooters() {
  const database = getDb();

  // Check if scooters already exist
  const count = database.prepare('SELECT COUNT(*) as count FROM scooters').get();
  if (count.count > 0) {
    return; // Already seeded
  }

  const now = new Date().toISOString();

  // Realistic San Francisco locations across different neighborhoods
  const scooterData = [
    // Downtown / Financial District
    { lat: 37.7897, lng: -122.4009, model: 'Vim Pro', battery: 95, status: 'available' },
    { lat: 37.7905, lng: -122.3988, model: 'Vim Lite', battery: 82, status: 'available' },
    { lat: 37.7879, lng: -122.4074, model: 'Vim Max', battery: 68, status: 'available' },
    { lat: 37.7893, lng: -122.4015, model: 'Vim Pro', battery: 44, status: 'charging' },

    // SOMA (South of Market)
    { lat: 37.7785, lng: -122.3948, model: 'Vim Pro', battery: 91, status: 'available' },
    { lat: 37.7749, lng: -122.3973, model: 'Vim Lite', battery: 76, status: 'available' },
    { lat: 37.7762, lng: -122.3912, model: 'Vim Max', battery: 55, status: 'available' },
    { lat: 37.7801, lng: -122.3935, model: 'Vim Lite', battery: 23, status: 'charging' },

    // Mission District
    { lat: 37.7599, lng: -122.4148, model: 'Vim Pro', battery: 88, status: 'available' },
    { lat: 37.7632, lng: -122.4191, model: 'Vim Lite', battery: 72, status: 'available' },
    { lat: 37.7571, lng: -122.4177, model: 'Vim Max', battery: 64, status: 'available' },
    { lat: 37.7618, lng: -122.4213, model: 'Vim Pro', battery: 35, status: 'maintenance' },

    // Castro
    { lat: 37.7609, lng: -122.4350, model: 'Vim Lite', battery: 97, status: 'available' },
    { lat: 37.7625, lng: -122.4369, model: 'Vim Pro', battery: 81, status: 'available' },

    // Marina District
    { lat: 37.8015, lng: -122.4368, model: 'Vim Max', battery: 93, status: 'available' },
    { lat: 37.8002, lng: -122.4325, model: 'Vim Pro', battery: 66, status: 'available' },
    { lat: 37.8028, lng: -122.4401, model: 'Vim Lite', battery: 48, status: 'available' },

    // North Beach
    { lat: 37.8003, lng: -122.4091, model: 'Vim Pro', battery: 85, status: 'available' },
    { lat: 37.7987, lng: -122.4067, model: 'Vim Max', battery: 71, status: 'available' },

    // Haight-Ashbury
    { lat: 37.7692, lng: -122.4481, model: 'Vim Lite', battery: 58, status: 'available' },
    { lat: 37.7710, lng: -122.4508, model: 'Vim Pro', battery: 90, status: 'available' },

    // Nob Hill
    { lat: 37.7930, lng: -122.4161, model: 'Vim Max', battery: 77, status: 'available' },
    { lat: 37.7919, lng: -122.4139, model: 'Vim Pro', battery: 42, status: 'charging' },

    // Pacific Heights
    { lat: 37.7925, lng: -122.4352, model: 'Vim Lite', battery: 100, status: 'available' },
    { lat: 37.7938, lng: -122.4310, model: 'Vim Pro', battery: 86, status: 'available' },

    // Embarcadero / Waterfront
    { lat: 37.7955, lng: -122.3933, model: 'Vim Max', battery: 74, status: 'available' },
    { lat: 37.7935, lng: -122.3917, model: 'Vim Pro', battery: 62, status: 'available' },
    { lat: 37.7968, lng: -122.3945, model: 'Vim Lite', battery: 29, status: 'maintenance' },

    // Civic Center
    { lat: 37.7793, lng: -122.4193, model: 'Vim Pro', battery: 83, status: 'available' },
    { lat: 37.7810, lng: -122.4157, model: 'Vim Max', battery: 51, status: 'available' },

    // Potrero Hill
    { lat: 37.7604, lng: -122.3930, model: 'Vim Lite', battery: 69, status: 'available' },
    { lat: 37.7582, lng: -122.3958, model: 'Vim Pro', battery: 20, status: 'charging' },
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
  console.log(`Seeded ${scooterData.length} scooters across San Francisco`);
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
