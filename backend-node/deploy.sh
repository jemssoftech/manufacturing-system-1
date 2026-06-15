#!/bin/bash

# Textile ERP Full System (Backend & Frontend) VPS Deployment Script
echo "🚀 Starting Textile ERP Full System Deployment..."

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
FRONTEND_DIR="$SCRIPT_DIR/../frontend"

# 1. Install packages for backend
echo "📦 Installing npm dependencies for backend..."
cd "$SCRIPT_DIR"
npm install

# 2. Check and Create .env
if [ ! -f .env ]; then
  echo "📄 Creating default .env file..."
  cp .env.example .env
  echo "⚠️ Default .env created. Please update it with your MySQL password and details if needed."
fi

# 3. Seed Database
echo "🌱 Seeding Database in MySQL (auto-creation will be checked)..."
node scripts/seed.js

# 4. Check if pm2 is installed globally
if ! command -v pm2 &> /dev/null
then
    echo "⚠️ PM2 not found. Installing PM2 globally..."
    sudo npm install -g pm2
fi

# 5. Start Backend server in PM2
echo "⚡ Starting Express Backend server under PM2..."
pm2 delete textile-backend 2>/dev/null || true
pm2 start server.js --name "textile-backend"

# 6. Start Frontend server in PM2 (serving static HTML/JS files)
echo "🖥️ Starting Static Frontend server under PM2 on port 80..."
# Using PM2's built-in static file server
# Note: running on port 80 might require root/sudo permissions on the VPS
pm2 delete textile-frontend 2>/dev/null || true
pm2 serve "$FRONTEND_DIR" 80 --name "textile-frontend" --spa

pm2 save

echo "🎉 Full System Deployment Successful!"
echo "--------------------------------------------------------"
echo "🟢 Backend: Running on http://127.0.0.1:3000 (PM2: textile-backend)"
echo "🟢 Frontend: Running on http://127.0.0.1:80 (PM2: textile-frontend)"
echo "--------------------------------------------------------"
echo "💡 Note: If port 80 fails to start, ensure no other service (like Apache/Nginx) is using it, or run with sudo."
echo "--------------------------------------------------------"
