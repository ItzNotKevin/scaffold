#!/bin/bash

echo "🚀 Deploying Firestore Rules and Indexes..."

# Check if Firebase CLI is available
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing locally..."
    npm install firebase-tools --save-dev
fi

# Deploy Firestore rules and indexes
echo "📝 Deploying Firestore rules and indexes..."
npx firebase deploy --only firestore

echo "✅ Firestore rules and indexes deployed successfully!"
echo ""
echo "📧 Next steps:"
echo "1. Test sign up and login functionality"
echo "2. Check if permission errors are resolved"
echo "3. Wait 1-2 minutes for indexes to build"
