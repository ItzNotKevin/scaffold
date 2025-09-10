# Firebase Functions Email Notifications Setup

## Prerequisites

1. **Firebase CLI**: Install globally or use npx
2. **SendGrid Account**: Sign up at https://sendgrid.com
3. **Firebase Project**: Already configured

## Setup Steps

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Configure SendGrid

1. Go to SendGrid Dashboard
2. Navigate to Settings > API Keys
3. Create a new API key with "Mail Send" permissions
4. Copy the API key

### 3. Set Firebase Configuration

```bash
# Set SendGrid API key
firebase functions:config:set sendgrid.key="YOUR_SENDGRID_API_KEY"

# Set sender email (must be verified in SendGrid)
firebase functions:config:set sendgrid.sender="noreply@yourdomain.com"
```

### 4. Deploy Functions

```bash
# Build and deploy
npm run build
firebase deploy --only functions
```

### 5. Verify Sender Email

1. In SendGrid Dashboard, go to Settings > Sender Authentication
2. Verify your sender email address
3. Update the sender email in the functions code if needed

## Email Templates

The functions include HTML email templates for:
- **Project Created**: Sent when a new project is created
- **Phase Updated**: Sent when a project phase changes

## Testing

1. Create a new project in your app
2. Update a project phase
3. Check the Firebase Functions logs for email sending status

## Troubleshooting

- Check Firebase Functions logs: `firebase functions:log`
- Verify SendGrid API key is correct
- Ensure sender email is verified in SendGrid
- Check Firestore security rules allow function access
