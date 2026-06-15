const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = process.env.DB_PORT || 3306;
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || 'textile_erp';

// Initialize a null sequelize variable
let sequelize;

async function initDatabase() {
  try {
    // 1. Create database if it doesn't exist
    const connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.end();
    console.log(`✅ Database "${dbName}" checked/created successfully.`);

    // 2. Initialize Sequelize instance
    sequelize = new Sequelize(dbName, dbUser, dbPassword, {
      host: dbHost,
      port: dbPort,
      dialect: 'mysql',
      dialectOptions: {
        decimalNumbers: true
      },
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    });

    // 3. Test connection
    await sequelize.authenticate();
    console.log('✅ Connection to database has been established successfully.');
    return sequelize;
  } catch (error) {
    console.error('❌ Unable to connect/create the database:', error);
    throw error;
  }
}

// Lazy initialization getter for sequelize
function getSequelize() {
  if (!sequelize) {
    sequelize = new Sequelize(dbName, dbUser, dbPassword, {
      host: dbHost,
      port: dbPort,
      dialect: 'mysql',
      dialectOptions: {
        decimalNumbers: true
      },
      logging: process.env.NODE_ENV === 'development' ? console.log : false
    });
  }
  return sequelize;
}

module.exports = {
  initDatabase,
  getSequelize,
  // We can also export a helper to get sequelize once initialized
  get db() {
    return getSequelize();
  }
};
