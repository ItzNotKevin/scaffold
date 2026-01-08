# Construction PM

A modern, mobile-first Progressive Web App (PWA) for construction project management with Firebase authentication and real-time data sync.

## 🚀 Features

### Core Functionality
- **🔐 Firebase Authentication** - Email/password and Google sign-in
- **📱 PWA Support** - Installable on iOS and Android devices with auto-updates
- **🏢 Multi-tenant Architecture** - Company-based project organization
- **📋 Project Management** - Create and manage construction projects with budgets and tracking
- **📱 Mobile-First Design** - Optimized for mobile devices with touch-friendly UI
- **⚡ Real-time Updates** - Live data synchronization with Firestore
- **🔒 Protected Routes** - Secure access to private pages with role-based permissions

### Financial Management
- **💰 Expense Tracking** - Track project expenses with categories, subcategories, and vendors
- **💵 Income Management** - Record project income with categories and invoice tracking
- **📊 Budget Tracking** - Real-time project budget vs actual cost calculations
- **📈 Revenue Tracking** - Track project revenue, profit margins, and net profit
- **🧾 Receipt & Invoice Upload** - Photo uploads with compression and cloud storage

### Staff & Task Management
- **👷 Staff Management** - Add staff members with daily rates and payroll tracking
- **📋 Task Assignments** - Assign tasks to staff with daily rate calculations
- **✅ Task Templates** - Create reusable task templates for project standardization
- **💼 Payroll Calculation** - Automatic calculation of wages and reimbursements

### Activity & Documentation
- **📸 Photo Management** - Upload and organize project photos with activity log view
- **📝 Activity Logs** - Comprehensive activity tracking with filters and sorting
- **📅 Project Activity** - View all project activities (assignments, expenses, income, photos) in one place
- **🔍 Advanced Filtering** - Filter by type, staff, project, status, and date
- **📊 Monthly Grouping** - Activities organized by month for easy navigation

### Organization & Settings
- **📁 Category Management** - Organize expenses and income with categories and subcategories
- **🏪 Vendor Management** - Manage vendor list with quick selection in expense forms
- **⚙️ User Management** - Admin controls for user roles and permissions
- **🔔 Push Notifications** - FCM ready for real-time updates (configurable)

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
   git clone https://github.com/ItzNotKevin/scaffold.git
   cd scaffold
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
├── components/              # Reusable UI components
│   ├── Layout.tsx          # Main app layout
│   ├── ProtectedRoute.tsx  # Route protection
│   ├── TopBar.tsx          # Navigation header
│   ├── AdminDashboard.tsx  # Admin dashboard
│   ├── ExpenseManager.tsx  # Expense management with forms
│   ├── IncomeManager.tsx   # Income management with forms
│   ├── PhotoManager.tsx    # Photo management with activity log view
│   └── ui/                 # UI component library
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Input.tsx
│       └── CollapsibleSection.tsx
├── lib/                    # Utilities and configurations
│   ├── firebase.ts         # Firebase configuration
│   ├── useAuth.tsx         # Authentication context
│   ├── types.ts            # TypeScript type definitions
│   ├── projectCosts.ts     # Project cost calculation utilities
│   ├── projectRevenue.ts   # Project revenue calculation utilities
│   └── imageCompression.ts # Image compression utilities
├── pages/                  # Page components
│   ├── AuthPage.tsx        # Login/signup page
│   ├── Home.tsx            # Dashboard (company/projects)
│   ├── ProjectPage.tsx     # Individual project view with activity log
│   ├── ExpensePage.tsx     # Expense management page
│   ├── IncomePage.tsx      # Income management page
│   ├── PhotoPage.tsx       # Photo management page
│   ├── ActivityLogsPage.tsx # Global activity logs
│   ├── CategoryManagementPage.tsx # Categories, tasks, and vendors
│   └── ProfilePage.tsx     # User profile settings
└── App.tsx                 # Main app component with routing
```

## 🔥 Firebase Collections

### Core Collections
- **`companies/{id}`** - Company information
- **`users/{uid}`** - User profiles with company association and permissions
- **`projects/{id}`** - Construction projects with budget and revenue tracking
- **`staffMembers/{id}`** - Staff member profiles with daily rates

### Financial Collections
- **`reimbursements/{id}`** - Expense entries (expenses and reimbursements)
- **`incomes/{id}`** - Income entries with invoices
- **`expenseCategories/{id}`** - Expense category organization
- **`expenseSubcategories/{id}`** - Expense subcategories with usage tracking
- **`incomeCategories/{id}`** - Income category organization
- **`incomeSubcategories/{id}`** - Income subcategories with usage tracking
- **`vendors/{id}`** - Vendor list for expense tracking

### Task & Activity Collections
- **`taskAssignments/{id}`** - Task assignments with staff and daily rates
- **`tasks/{id}`** - Task templates and project tasks
- **`projectPhotos/{id}`** - Project photo entries with metadata
- **`dailyReports/{id}`** - Daily project reports (if used)

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

- `npm run dev` - Start development server on port 5173
- `npm run build` - Build for production (outputs to `dist/`)
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint for code quality checks

## 🎯 Key Features in Detail

### Expense Management
- Add expenses with categories, subcategories, and vendor selection
- Track receipts with photo uploads
- Link expenses to projects for budget tracking
- "Submit and Add Another" for quick entry of multiple expenses
- Inline vendor creation from expense form
- Filter and sort expenses by various criteria

### Income Management
- Record project income with categories and subcategories
- Upload invoice documents
- Track income status (pending, received, cancelled)
- Automatic revenue calculation per project

### Photo Management
- Upload multiple photos per entry (up to 9 photos)
- Activity log-style view with filtering and sorting
- Photo previews remain visible during edit mode
- Monthly grouping for easy navigation

### Activity Logs
- Unified view of all project activities
- Filter by type (assignment, expense, income, photo)
- Filter by staff, project, and status
- Sort by date, amount, staff, or project
- Click photos/receipts to view full size
- Inline editing with photo preview preservation

### Category & Vendor Management
- Organize expenses and income with hierarchical categories
- Quick subcategory creation from expense form
- Vendor management with dropdown selection
- Usage tracking for subcategories
- Task template management

### Project Financials
- Real-time budget tracking (budget vs actual cost)
- Revenue tracking with profit calculations
- Net profit and profit margin calculations
- Cost breakdown by category
- Revenue breakdown by category

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

1. Check the [Issues](https://github.com/ItzNotKevin/scaffold/issues) page
2. Create a new issue with detailed information
3. Include steps to reproduce the problem

## 🔗 Links

- [Live Demo](https://scaffold.vercel.app) (when deployed)
- [Firebase Console](https://console.firebase.google.com)
- [React Documentation](https://reactjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Vite Documentation](https://vitejs.dev/guide)
