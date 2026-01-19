#!/bin/bash

# React Native Sign Language Translation - Test Script
# This script runs all tests

set -e

echo "🧪 Running tests for React Native Sign Language Translation..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: TypeScript type check
echo -e "${YELLOW}🔍 Running TypeScript type check...${NC}"
yarn typescript

# Step 2: ESLint
echo -e "${YELLOW}🔍 Running ESLint...${NC}"
yarn lint

# Step 3: Run Jest tests
echo -e "${YELLOW}🧪 Running Jest tests...${NC}"
yarn test

echo ""
echo -e "${GREEN}✅ All tests passed!${NC}"
