#!/bin/bash

# Build script for different deployment targets
# Usage: ./build.sh demo-test

TARGET=${1:-demo}

case $TARGET in
  demo)
    echo "Building for /demo..."
    NEXT_PUBLIC_BASE_PATH=/demo npm run build
    ;;
  demo-test)
    echo "Building for /demo-test..."
    NEXT_PUBLIC_BASE_PATH=/demo-test npm run build
    ;;
  *)
    echo "Usage: $0 {demo|demo-test}"
    exit 1
    ;;
esac

if [ $? -eq 0 ]; then
  echo "Build completed successfully!"
else
  echo "Build failed!"
  exit 1
fi
