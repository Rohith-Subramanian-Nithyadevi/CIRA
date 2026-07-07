#!/bin/bash
set -e

echo "Building frontend-web..."
cd frontend-web
npm install
npm run build
cd ..

echo "Building backend-core..."
cd backend-core
npm install
npm run build
cd ..

echo "Preparing desktop client resources..."
rm -rf desktop-client/resources
mkdir -p desktop-client/resources/backend

# Copy necessary backend files
cp -r backend-core/dist desktop-client/resources/backend/
cp backend-core/package.json desktop-client/resources/backend/
if [ -f "backend-core/package-lock.json" ]; then
    cp backend-core/package-lock.json desktop-client/resources/backend/
fi
if [ -d "backend-core/prisma" ]; then
    cp -r backend-core/prisma desktop-client/resources/backend/
fi
if [ -f "backend-core/.env" ]; then
    cp backend-core/.env desktop-client/resources/backend/
fi

echo "Copying frontend build to backend public folder..."
mkdir -p desktop-client/resources/backend/dist/public
cp -r frontend-web/dist/* desktop-client/resources/backend/dist/public/

echo "Installing backend production dependencies..."
cd desktop-client/resources/backend
npm install --omit=dev
cd ../../../

echo "Build process complete. You can now build the desktop client by running 'npm run build' inside desktop-client directory."
