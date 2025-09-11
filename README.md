# Construction PM

A modern, mobile-first Progressive Web App (PWA) for construction project management with Firebase authentication and real-time data sync.

## 🚀 Features

- **🔐 Firebase Authentication** - Email/password and Google sign-in
- **📱 PWA Support** - Installable on iOS and Android devices
- **🏢 Multi-tenant Architecture** - Company-based project organization
- **📋 Project Management** - Create and manage construction projects
- **👷 Staff Check-in/out** - Track team member attendance
- **📊 Project Phases** - Sales, Contract, Materials, Construction, Completion
- **📱 Mobile-First Design** - Optimized for mobile devices
- **⚡ Real-time Updates** - Live data synchronization with Firestore
- **🔒 Protected Routes** - Secure access to private pages
- **📧 Email Notifications** - Project updates via SendGrid
- **🔔 Push Notifications** - FCM ready (disabled by default)

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Authentication + Firestore)
- **PWA**: Vite PWA Plugin + Workbox
- **Routing**: React Router v6
- **State Management**: React Context + Hooks

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase project with Authentication and Firestore enabled

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/ItzNotKevin/construction-pm.git
   cd construction-pm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Authentication (Email/Password + Google)
   - Enable Firestore Database
   - Get your Firebase config from Project Settings

4. **Set up environment variables**
   ```bash
   # Copy the example file
   cp .env.example .env.local
   
   # Edit .env.local with your Firebase config
   VITE_FIREBASE_API_KEY=your_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   - Local: `http://localhost:5173`
   - Mobile testing: `npm run dev -- --host` then access via your IP

## 📱 PWA Installation

### Desktop (Chrome/Edge)
- Look for the install icon in the address bar
- Or click the "Install App" button on the home page

### Mobile (iOS Safari)
- Tap the Share button → "Add to Home Screen"

### Mobile (Android Chrome)
- Tap the menu (⋮) → "Install app"
- Or use the "Install App" button on the home page

## 🏗️ Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Layout.tsx      # Main app layout
│   ├── ProtectedRoute.tsx # Route protection
│   └── TopBar.tsx      # Navigation header
├── lib/                # Utilities and configurations
│   ├── firebase.ts     # Firebase configuration
│   ├── firestore.ts    # Firestore helpers
│   ├── useAuth.tsx     # Authentication context
│   ├── usePWAInstall.tsx # PWA install hook
│   └── types.ts        # TypeScript type definitions
├── pages/              # Page components
│   ├── AuthPage.tsx    # Login/signup page
│   ├── Home.tsx        # Dashboard (company/projects)
│   └── ProjectPage.tsx # Individual project view
└── App.tsx             # Main app component with routing
```

## 🔥 Firebase Collections

- **`companies/{id}`** - Company information
- **`users/{uid}`** - User profiles with company association
- **`projects/{id}`** - Construction projects
- **`checkins/{id}`** - Staff check-in/out records

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm run build
# Upload dist/ folder to Netlify
```

### Firebase Hosting
```bash
npm install -g firebase-tools
npm run build
firebase init hosting
firebase deploy
```

## 🧪 Testing

### Local Development
```bash
npm run dev
```

### Mobile Testing
```bash
# Start with network access
npm run dev -- --host

# Find your IP address
ifconfig | grep "inet " | grep -v 127.0.0.1

# Access from mobile: http://YOUR_IP:5173
```

### PWA Testing
- Test install prompts on mobile browsers
- Verify offline functionality
- Check responsive design on various screen sizes

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/ItzNotKevin/construction-pm/issues) page
2. Create a new issue with detailed information
3. Include steps to reproduce the problem

## 🔗 Links

- [Live Demo](https://construction-pm.vercel.app) (when deployed)
- [Firebase Console](https://console.firebase.google.com)
- [React Documentation](https://reactjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Vite Documentation](https://vitejs.dev/guide)# Test GitHub Integration
