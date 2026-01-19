#!/bin/bash

# React Native Sign Language Translation - Bootstrap Script
# This script sets up the development environment

set -e

echo "🚀 Setting up React Native Sign Language Translation development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Install root dependencies
echo -e "${YELLOW}📦 Installing root dependencies...${NC}"
yarn install

# Step 2: Build the library
echo -e "${YELLOW}🔨 Building the library...${NC}"
yarn prepare

# Step 3: Setup example app
echo -e "${YELLOW}📱 Setting up example app...${NC}"
cd example

# Install example dependencies
echo -e "${YELLOW}📦 Installing example dependencies...${NC}"
yarn install

# iOS specific setup
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${YELLOW}🍎 Setting up iOS...${NC}"
    cd ios
    pod install
    cd ..
fi

cd ..

echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo "To run the example app:"
echo "  cd example"
echo "  yarn ios     # For iOS"
echo "  yarn android # For Android"
