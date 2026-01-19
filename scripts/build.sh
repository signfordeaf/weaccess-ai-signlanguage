#!/bin/bash

# React Native Sign Language Translation - Build Script
# This script builds and prepares the package for publishing

set -e

echo "🚀 Building React Native Sign Language Translation..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Clean previous builds
echo -e "${YELLOW}📦 Cleaning previous builds...${NC}"
rm -rf lib/
rm -rf node_modules/.cache

# Step 2: Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
yarn install

# Step 3: Type checking
echo -e "${YELLOW}🔍 Running TypeScript type check...${NC}"
yarn typescript

# Step 4: Linting
echo -e "${YELLOW}🔍 Running ESLint...${NC}"
yarn lint

# Step 5: Build TypeScript
echo -e "${YELLOW}🔨 Building TypeScript...${NC}"
yarn prepare

# Step 6: Verify build output
echo -e "${YELLOW}✅ Verifying build output...${NC}"
if [ -d "lib" ]; then
    echo -e "${GREEN}✅ Build successful! Output in lib/ directory${NC}"
    ls -la lib/
else
    echo -e "${RED}❌ Build failed - lib/ directory not found${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Build complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Test the example app: cd example && yarn && yarn ios"
echo "  2. Publish to npm: npm publish"
