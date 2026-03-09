# Devai Automation - Lead Management System

A full-stack lead management application that enables businesses to capture, track, and manage customer leads efficiently.

## 🚀 Features

### For Businesses
- **User Registration**: Create an account with business details (name, profession, contact info)
- **Secure Login**: JWT-based authentication with password hashing
- **Lead Dashboard**: View all leads with analytics (total, today, converted)
- **Lead Management**: Add leads manually, update status, and add notes
- **Lead Form Generation**: Generate shareable public lead form links
- **Professional Types**: Support for Gym, Salon, Clinic, Real Estate businesses

### For Customers
- **Public Lead Form**: Easy-to-use form for submitting inquiries
- **No Account Required**: Customers can submit leads without logging in

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Authentication**: JSON Web Token (JWT)
- **Password Hashing**: bcryptjs
- **Data Storage**: JSON files (users.json, leads.json)

### Frontend
- **Languages**: HTML, CSS, JavaScript
- **No Framework**: Pure vanilla JS
- **Responsive Design**: Mobile-friendly UI

## 📁 Project Structure

```
startup/
├── backend/
│   ├── server.js          # Express server with all API endpoints
│   ├── package.json       # Node.js dependencies
│   ├── users.json         # User data storage
│   └── leads.json         # Lead data storage
├── frontend/
│   ├── index.html         # Landing page (LeadFlow AI)
│   ├── login.html         # Login page
│   ├── signup.html        # Registration page
│   ├── dashboard.html    # Lead management dashboard
│   ├── form.html         # Public lead submission form
│   ├── script.js         # Frontend JavaScript logic
│   ├── index.css         # Landing page styles
│   ├── login.css         # Login page styles
│   ├── form.css          # Form page styles
│   └── dashboard.css     # Dashboard styles
├── database/
│   └── schema.sql        # Database schema (for future use)
└── README.md             # This file
```

## ⚡ Quick Start

### Prerequisites
- Node.js installed (v14 or higher)
- npm (Node Package Manager)

### Installation

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

   The server will run on `http://localhost:5000`

4. **Open the frontend:**
   - Simply open `frontend/index.html` in your browser
   - Or use a local server (e.g., VS Code Live Server)

## 📖 Usage Guide

### For Businesses

1. **Sign Up**: Visit `signup.html` and create an account
   - Enter your name, email, password
   - Select your profession (Gym, Salon, Clinic, Real Estate)
   - Fill in business details (name, phone, location, services, website)

2. **Login**: Use your email and password to login at `login.html`

3. **Dashboard**: Access your dashboard to:
   - View lead statistics (total, today's leads, converted)
   - Generate a public lead form link to share with customers
   - View and manage all your leads
   - Update lead status (New, Contacted, Converted, Lost)
   - Add notes to leads

4. **Share Form**: Click "Generate Form Link" to create a shareable URL for customers to submit leads

### For Customers

1. **Submit Lead**: Visit the business's lead form link
   - Enter your name, phone, and the service you're interested in
   - No account required!

## 🔌 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/signup` | Register a new user |
| POST | `/login` | Login and get JWT token |

### Leads (Protected - Requires JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/leads` | Get all leads for logged-in user |
| POST | `/lead` | Add a new lead |
| PUT | `/lead/:id` | Update lead status |
| PUT | `/lead-note/:id` | Add/update lead note |

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/lead-public` | Submit lead without auth |

## 🔐 Security Features

- Password hashing with bcryptjs (10 salt rounds)
- JWT token-based authentication
- Token verification middleware
- Password strength validation (8+ chars, uppercase, lowercase, number, special char)
- Email format validation
- Phone number validation (10 digits)

## 📝 Environment Variables

The server runs on port 5000 by default. You can override it:

```bash
PORT=3000 npm start
```

## 🔧 Future Enhancements

- Database integration (MySQL/PostgreSQL)
- Email notifications for new leads
- SMS notifications
- Lead assignment and team collaboration
- Analytics and reporting
- Export leads to CSV/Excel

## 📄 License

ISC

## 👨‍💻 Author

Devai Automation Team

