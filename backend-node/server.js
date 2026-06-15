const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDatabase } = require('./config/db');
const { sequelize } = require('./models');

// Import routes
const authRoutes = require('./routes/auth');
const procurementRoutes = require('./routes/procurement');
const inventoryRoutes = require('./routes/inventory');
const productionRoutes = require('./routes/production');
const qualityRoutes = require('./routes/quality');
const salesRoutes = require('./routes/sales');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
  'http://localhost',
  'http://127.0.0.1'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    return callback(null, true); // Allow all during dev transition
  },
  credentials: true
}));

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mounting API Routes (FastAPI prefixes matched exactly)
app.use('/api/auth', authRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/reports', reportsRoutes);

// Root redirect/fallback
app.get('/', (req, res) => {
  res.redirect('/health');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    database: 'connected',
    backend: 'Node.js (Express)'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ detail: err.message || 'Internal server error' });
});

// Database Initialization and Server Start
async function startServer() {
  try {
    // 1. Auto-create database and initialize Sequelize
    await initDatabase();

    // 2. Sync Sequelize models with MySQL
    await sequelize.sync();
    console.log('✅ All database tables synchronized successfully.');

    // 3. Start listening
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Node.js Backend Server is running on http://0.0.0.0:${PORT}`);
      console.log('💡 Press Ctrl+C to stop');
    });

  } catch (error) {
    console.error('❌ Failed to start the server:', error);
    process.exit(1);
  }
}

startServer();
