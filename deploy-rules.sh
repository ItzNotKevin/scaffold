#!/bin/bash

echo "🚀 Deploying Firestore Rules..."

# Check if Firebase CLI is available
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing locally..."
    npm install firebase-tools --save-dev
fi

# Deploy Firestore rules
echo "📝 Deploying Firestore rules..."
npx firebase deploy --only firestore:rules

echo "✅ Firestore rules deployed successfully!"
echo ""
echo "📧 Next steps:"
echo "1. Test sign up and login functionality"
echo "2. Check if permission errors are resolved"
