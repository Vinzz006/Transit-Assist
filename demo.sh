#!/usr/bin/env bash
# Transit Assist India — Live CLI Demonstration Script (Bash)
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

if command -v python3 &>/dev/null; then
    python3 demo.py
elif command -v python &>/dev/null; then
    python demo.py
else
    echo "Python is required to run the automated demo script."
    echo "Please visit http://localhost:5174 for the interactive Web App,"
    echo "or http://localhost:8000/docs for the interactive Swagger documentation."
    exit 1
fi
