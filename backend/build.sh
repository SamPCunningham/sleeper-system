#!/bin/bash
set -e

echo "Building Go application..."
go build -o bin/server cmd/server/main.go

echo "Build complete!"