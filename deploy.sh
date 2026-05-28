#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "============================================="
echo "   DEPLOYING E-COMMERCE MERCHANDISE SHOP"
echo "============================================="

# 1. Navigate to target repository on the VM
cd /home/base-ubuntu/shop

# 2. Reset local changes and pull latest code from GitHub
echo "Pulling latest code..."
git reset --hard
git pull origin main

# 3. Build Backend
echo "Building backend..."
cd backend
npm install
npm run build

# 4. Run Migrations & Seeds
echo "Running migrations and database seeding..."
npx ts-node src/migrate.ts
cd ..

# 5. Build Frontend
echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

# 6. PM2 Deployment on Port 80
echo "Configuring network permissions..."
# Allow Node to bind to port 80 without root privileges
sudo setcap 'cap_net_bind_service=+ep' $(which node)

echo "Starting application under PM2 on port 80..."
# Remove old pm2 process if running
pm2 delete shop-app || true

# Start with PORT=80
PORT=80 pm2 start backend/dist/server.js --name "shop-app"

# Save pm2 process list to load on reboot
pm2 save

echo "============================================="
echo "   DEPLOYMENT SUCCEEDED AND APP IS LIVE!"
echo "============================================="
