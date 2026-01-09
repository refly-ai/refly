#!/bin/bash

# Sandbox Agent Setup Verification Script
# This script verifies that the project is properly set up

echo "🔍 Verifying Sandbox Agent Setup..."
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js version
echo "📦 Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js is installed: $NODE_VERSION"
    
    # Check if version is >= 18
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -ge 18 ]; then
        echo -e "${GREEN}✓${NC} Node.js version is compatible (>= 18)"
    else
        echo -e "${RED}✗${NC} Node.js version is too old. Please upgrade to >= 18.0.0"
    fi
else
    echo -e "${RED}✗${NC} Node.js is not installed"
fi
echo ""

# Check npm
echo "📦 Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm is installed: $NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm is not installed"
fi
echo ""

# Check if node_modules exists
echo "📚 Checking dependencies..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules directory exists"
    
    # Count packages
    PACKAGE_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
    echo -e "${GREEN}✓${NC} Found approximately $PACKAGE_COUNT packages"
else
    echo -e "${YELLOW}⚠${NC} node_modules not found. Run: npm install"
fi
echo ""

# Check .env file
echo "🔐 Checking environment configuration..."
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
    
    # Check for API keys (without showing them)
    if grep -q "OPENAI_API_KEY=sk-" .env; then
        echo -e "${GREEN}✓${NC} OpenAI API key appears to be set"
    elif grep -q "ANTHROPIC_API_KEY=sk-ant-" .env; then
        echo -e "${GREEN}✓${NC} Anthropic API key appears to be set"
    elif grep -q "AZURE_OPENAI_API_KEY=" .env && [ -n "$(grep 'AZURE_OPENAI_API_KEY=' .env | cut -d'=' -f2)" ]; then
        echo -e "${GREEN}✓${NC} Azure OpenAI API key appears to be set"
    else
        echo -e "${YELLOW}⚠${NC} No API key detected in .env file"
        echo "  Please add at least one API key (OPENAI_API_KEY, ANTHROPIC_API_KEY, or AZURE_OPENAI_API_KEY)"
    fi
else
    echo -e "${YELLOW}⚠${NC} .env file not found"
    echo "  Run: cp env.example .env"
    echo "  Then edit .env to add your API keys"
fi
echo ""

# Check TypeScript
echo "🔷 Checking TypeScript..."
if [ -f "node_modules/.bin/tsc" ]; then
    TSC_VERSION=$(node_modules/.bin/tsc --version)
    echo -e "${GREEN}✓${NC} TypeScript is installed: $TSC_VERSION"
else
    echo -e "${YELLOW}⚠${NC} TypeScript not found. Run: npm install"
fi
echo ""

# Check core files
echo "📄 Checking core files..."
FILES=("session.ts" "schema.ts" "config.ts" "chains.ts" "index.ts" "example.ts")
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file exists"
    else
        echo -e "${RED}✗${NC} $file is missing"
    fi
done
echo ""

# Check configuration files
echo "⚙️  Checking configuration files..."
CONFIG_FILES=("package.json" "tsconfig.json" "jest.config.js" ".eslintrc.json" ".prettierrc")
for file in "${CONFIG_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file exists"
    else
        echo -e "${RED}✗${NC} $file is missing"
    fi
done
echo ""

# Check documentation
echo "📖 Checking documentation..."
DOC_FILES=("README.md" "QUICKSTART.md" "SETUP.md" "CONTRIBUTING.md" "LICENSE")
for file in "${DOC_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file exists"
    else
        echo -e "${RED}✗${NC} $file is missing"
    fi
done
echo ""

# Try to compile TypeScript
echo "🔨 Testing TypeScript compilation..."
if [ -f "node_modules/.bin/tsc" ]; then
    if node_modules/.bin/tsc --noEmit; then
        echo -e "${GREEN}✓${NC} TypeScript compilation check passed"
    else
        echo -e "${YELLOW}⚠${NC} TypeScript compilation has errors"
        echo "  Note: This is expected if dependencies are not installed yet"
    fi
else
    echo -e "${YELLOW}⚠${NC} TypeScript not available. Run: npm install"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Setup Verification Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -d "node_modules" ]; then
    echo "🚀 Next Steps:"
    echo "  1. Run: npm install"
    echo "  2. Run: cp env.example .env"
    echo "  3. Edit .env to add your API key"
    echo "  4. Run: npx tsx example.ts"
elif [ ! -f ".env" ]; then
    echo "🚀 Next Steps:"
    echo "  1. Run: cp env.example .env"
    echo "  2. Edit .env to add your API key"
    echo "  3. Run: npx tsx example.ts"
else
    echo "✨ Setup looks good!"
    echo ""
    echo "🚀 Try running:"
    echo "  npx tsx example.ts"
    echo ""
    echo "📚 For more information:"
    echo "  - Quick start: cat QUICKSTART.md"
    echo "  - Full guide: cat README.md"
    echo "  - Setup help: cat SETUP.md"
fi

echo ""

