#!/bin/bash

echo "🚀 Deploying Firebase Functions for Email Notifications..."

# Check if Firebase CLI is available
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing locally..."
    npm install firebase-tools --save-dev
fi

# Install functions dependencies
echo "📦 Installing functions dependencies..."
cd functions
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Deploy functions
echo "🚀 Deploying functions to Firebase..."
npx firebase deploy --only functions

echo "✅ Functions deployed successfully!"
echo ""
echo "📧 Next steps:"
echo "1. Set up SendGrid API key: firebase functions:config:set sendgrid.key=\"YOUR_API_KEY\""
echo "2. Verify sender email in SendGrid dashboard"
echo "3. Test by creating a new project or updating a phase"
