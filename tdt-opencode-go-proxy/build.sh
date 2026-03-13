#!/bin/bash
# Build script for OpenCode Go Proxy

set -e

usage() {
    echo "Usage: $0 [dev|prod|clean|linux|mac]"
    echo "  dev   - Build for development (with debug info)"
    echo "  prod  - Build for production (optimized)"
    echo "  clean - Clean build artifacts"
    echo "  linux - Build for Linux"
    echo "  mac   - Build for macOS"
    exit 1
}

if [ $# -eq 0 ]; then
    usage
fi

case "$1" in
    clean)
        echo "Cleaning build artifacts..."
        rm -f opencode-proxy opencode-proxy.exe opencode-proxy-linux opencode-proxy-mac
        echo "Clean complete!"
        ;;
    
    dev)
        echo "Building for development..."
        go build -o opencode-proxy .
        echo "Development build complete: opencode-proxy"
        ;;
    
    prod)
        echo "Building for production..."
        go build -ldflags="-s -w" -o opencode-proxy .
        echo "Production build complete: opencode-proxy"
        ls -lh opencode-proxy
        ;;
    
    linux)
        echo "Building for Linux..."
        GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o opencode-proxy-linux .
        echo "Linux build complete: opencode-proxy-linux"
        ;;
    
    mac)
        echo "Building for macOS..."
        GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o opencode-proxy-mac .
        echo "macOS build complete: opencode-proxy-mac"
        ;;
    
    *)
        echo "Unknown target: $1"
        usage
        ;;
esac
