#!/bin/bash

# Script to push OTA updates to all channels (development, preview, production)
# Usage: ./scripts/push-ota-all.sh "Your update message"
# 
# For CI/CD (GitHub Actions), this script uses --non-interactive flag

MESSAGE=${1:-"OTA Update"}
NON_INTERACTIVE=${2:-"--non-interactive"}

echo "=========================================="
echo "🚀 Pushing OTA updates to all channels..."
echo "=========================================="
echo "📝 Message: $MESSAGE"
echo ""

echo "📦 Pushing to DEVELOPMENT channel..."
eas update --channel development $NON_INTERACTIVE --message "$MESSAGE"
if [ $? -eq 0 ]; then
  echo "✅ Development channel updated!"
else
  echo "❌ Failed to update development channel"
  exit 1
fi
echo ""

echo "📦 Pushing to PREVIEW channel..."
eas update --channel preview $NON_INTERACTIVE --message "$MESSAGE"
if [ $? -eq 0 ]; then
  echo "✅ Preview channel updated!"
else
  echo "❌ Failed to update preview channel"
  exit 1
fi
echo ""

echo "📦 Pushing to PRODUCTION channel..."
eas update --channel production $NON_INTERACTIVE --message "$MESSAGE"
if [ $? -eq 0 ]; then
  echo "✅ Production channel updated!"
else
  echo "❌ Failed to update production channel"
  exit 1
fi
echo ""

echo "=========================================="
echo "✅ OTA updates pushed to all channels!"
echo "=========================================="

