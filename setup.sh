#!/bin/bash

# Anime Character Image Collection System - Setup Script
# This script automates the installation and setup process

set -e  # Exit on any error

echo "🎌 Anime Character Image Collection System - Setup"
echo "================================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
        exit 1
    fi
    
    print_success "Node.js $(node -v) detected"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    print_success "npm $(npm -v) detected"
    
    # Check Git (optional)
    if ! command -v git &> /dev/null; then
        print_warning "Git is not installed. Some features may not work."
    else
        print_success "Git $(git --version | cut -d ' ' -f 3) detected"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing Node.js dependencies..."
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Make sure you're in the correct directory."
        exit 1
    fi
    
    npm install
    
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Install Playwright browsers
install_playwright() {
    print_status "Installing Playwright browsers..."
    
    npx playwright install chromium
    
    if [ $? -eq 0 ]; then
        print_success "Playwright browsers installed successfully"
    else
        print_error "Failed to install Playwright browsers"
        exit 1
    fi
}

# Setup directories
setup_directories() {
    print_status "Setting up directory structure..."
    
    # Create required directories
    mkdir -p images/raw
    mkdir -p images/processed
    mkdir -p database
    mkdir -p logs
    
    # Set permissions
    chmod 755 images images/raw images/processed database logs
    
    print_success "Directories created successfully"
}

# Setup environment file
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f ".env" ] && [ -f ".env.example" ]; then
        cp .env.example .env
        print_success "Environment file created from template"
        print_warning "You can edit .env file to customize settings"
    else
        print_warning ".env file already exists or .env.example not found"
    fi
}

# Build project
build_project() {
    print_status "Building TypeScript project..."
    
    npm run build
    
    if [ $? -eq 0 ]; then
        print_success "Project built successfully"
    else
        print_error "Failed to build project"
        exit 1
    fi
}

# Test installation
test_installation() {
    print_status "Testing installation..."
    
    # Test basic functionality
    if [ -f "dist/index.js" ]; then
        print_success "Build files found"
    else
        print_error "Build files not found"
        exit 1
    fi
    
    # Test database creation (dry run)
    node -e "
        const { DatabaseManager } = require('./dist/DatabaseManager');
        const db = new DatabaseManager('./test_db.db');
        console.log('Database test successful');
        db.close();
        require('fs').unlinkSync('./test_db.db');
    " 2>/dev/null
    
    if [ $? -eq 0 ]; then
        print_success "Database initialization test passed"
    else
        print_warning "Database test failed - this may be normal if dependencies aren't fully installed"
    fi
}

# Display completion message
display_completion() {
    echo ""
    echo "🎉 Setup completed successfully!"
    echo "==============================="
    echo ""
    echo "Next steps:"
    echo "  1. Review configuration in .env file (optional)"
    echo "  2. Run the application:"
    echo "     npm start"
    echo ""
    echo "  Or run in development mode:"
    echo "     npm run dev"
    echo ""
    echo "Expected results:"
    echo "  - 3,000-5,000 anime character images"
    echo "  - Images resized to 500x500 pixels"
    echo "  - JPEG format, <50KB file size"
    echo "  - Complete metadata database"
    echo ""
    echo "For detailed usage instructions, see:"
    echo "  - README.md (comprehensive documentation)"
    echo "  - QUICKSTART.md (quick start guide)"
    echo ""
    echo "Troubleshooting:"
    echo "  - Check logs/ directory for error logs"
    echo "  - Run 'npm run lint' to check code issues"
    echo "  - Use 'npm run dev' for verbose output"
    echo ""
}

# Main execution
main() {
    echo "Starting setup process..."
    echo ""
    
    check_prerequisites
    install_dependencies
    install_playwright
    setup_directories
    setup_environment
    build_project
    test_installation
    display_completion
}

# Handle interruption
trap 'echo ""; print_error "Setup interrupted by user"; exit 1' INT

# Run main function
main

print_success "Setup script completed successfully!"