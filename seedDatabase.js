const fs = require('fs');
const path = require('path');
const db = require('./config/db');
require('dotenv').config();

async function runSQL(filePath) {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    // Split by semicolon to execute individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    const conn = await db.getConnection();
    
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed) {
        try {
          console.log(`Executing: ${trimmed.substring(0, 80)}...`);
          await conn.query(trimmed);
        } catch (err) {
          // Ignore duplicate entry errors
          if (err.code !== 'ER_DUP_ENTRY' && err.code !== 'ER_TABLE_EXISTS_ERROR') {
            console.error(`Error executing statement: ${err.message}`);
          } else {
            console.log(`Skipped: ${err.code}`);
          }
        }
      }
    }
    
    conn.release();
    console.log(`Successfully completed: ${filePath}`);
  } catch (err) {
    console.error(`Failed to execute ${filePath}:`, err.message);
  }
}

async function main() {
  try {
    console.log('Starting database seed...');
    await runSQL(path.join(__dirname, 'sql', 'schema.sql'));
    console.log('\nSchema created. Now inserting seed data...\n');
    await runSQL(path.join(__dirname, 'sql', 'seed.sql'));
    console.log('\nDatabase seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
