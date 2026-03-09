# LeadFlow AI - Lead Management System

A comprehensive full-stack lead management application that enables businesses to capture, track, and manage customer leads efficiently. Built with Node.js backend and vanilla JavaScript frontend.

## 🎯 Overview

LeadFlow AI is a powerful lead management platform designed for businesses that need to manage customer inquiries and leads in one centralized location. Whether you run a gym, salon, clinic, or real estate business, LeadFlow AI helps you organize, track, and convert leads into customers.

## ✨ Features

### 👔 For Business Users

- **User Registration & Authentication**
  - Secure signup with business details (name, profession, contact info)
  - Support for multiple professional types (Gym, Salon, Clinic, Real Estate)
  - JWT-based authentication with bcryptjs password hashing

- **Lead Dashboard**
  - Real-time lead statistics (total leads, today's leads, converted leads)
  - Visual overview of business performance
  - Lead analytics and insights

- **Lead Management**
  - View all incoming leads with details
  - Add leads manually to the system
  - Update lead status (Pending, Contacted, Converted, Lost)
  - Add notes and comments to leads
  - Track lead history and interactions

- **Lead Form Generation**
  - Generate unique public lead form links
  - Share forms with customers via email, social media, or website
  - Customers can submit inquiries without needing an account

### 👥 For Customers

- **Simple Lead Submission**
  - Easy-to-use public form for submitting inquiries
  - No account registration required
  - Quick response from businesses
  - Submit via name, phone, and service inquiry

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js (v14+)
- **Web Framework**: Express.js (v5.2.1)
- **Authentication**: JSON Web Token (JWT) based tokens
- **Password Security**: bcryptjs (hashing and salting)
- **API Style**: RESTful API
- **CORS**: Enabled for cross-origin requests
- **Data Storage**: JSON files (persistent storage)
  - `users.json` - User accounts and business information
  - `leads.json` - Lead data and inquiries

### Frontend
- **Languages**: HTML5, CSS3, JavaScript (ES6+)
- **Architecture**: Vanilla JavaScript (no framework dependencies)
- **Styling**: Custom CSS with responsive design
- **Browser Support**: All modern browsers (Chrome, Firefox, Safari, Edge)

### Database
- Currently: JSON file-based storage
- Future: SQL schema ready (schema.sql provided)

## 📁 Project Structure

```
startup/
├── backend/
│   ├── server.js              # Express server & all API endpoints
│   ├── package.json           # Node.js dependencies & scripts
│   ├── users.json             # User accounts database
│   ├── leads.json             # Leads database
│   └── README.md
├── frontend/
│   ├── index.html             # Public lead form page
│   ├── login.html             # Business user login page
│   ├── signup.html            # Business user registration page
│   ├── dashboard.html         # Lead management dashboard
│   ├── forgot-password.html   # Password recovery page
│   ├── reset.html             # Password reset page
│   ├── script.js              # Main JavaScript logic
│   ├── index.css              # Lead form styles
│   ├── login.css              # Login page styles
│   ├── signup.css             # Signup page styles
│   ├── form.css               # Form styles
│   └── dashboard.css          # Dashboard styles
├── database/
│   └── schema.sql             # SQL database schema (future DB migration)
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v14.0.0 or higher ([Download](https://nodejs.org/))
- **npm**: v6.0.0 or higher (comes with Node.js)
- **Modern Browser**: Chrome, Firefox, Safari, or Edge
- **Optional**: VS Code Live Server extension for local frontend development

### Installation & Setup

#### 1. Clone or Download the Project

```bash
# Navigate to project directory
cd startup
```

#### 2. Set Up Backend

```bash
# Navigate to backend directory
cd backend

# Install all dependencies
npm install

# Start the server
npm start
```

**Expected Output:**
```
Server running on http://localhost:5000
```

> ⚠️ **Note**: The backend will be available at `http://localhost:5000`

#### 3. Set Up Frontend

**Option A: Using Live Server (Recommended)**
- Install VS Code Live Server extension
- Right-click on `frontend/index.html`
- Select "Open with Live Server"
- Browser will automatically open at `http://localhost:5500`

**Option B: Direct Browser Access**
- Open `frontend/index.html` directly in your browser
- Or use any local HTTP server

**Option C: Simple HTTP Server**
```bash
# From the project root
cd frontend
python -m http.server 8000
# Access at http://localhost:8000
```

## 📖 Usage Guide

### 🏪 For Business Users

#### 1. **Create an Account (Sign Up)**

Navigate to `signup.html` (`/signup.html`)

Fill in the following details:
- **Full Name**: Your business owner's name
- **Email**: Valid email address (used for login)
- **Password**: Strong password (minimum 6 characters recommended)
- **Profession**: Select your business type
  - Gym
  - Salon
  - Clinic
  - Real Estate
- **Business Name**: Your business/brand name
- **Phone**: Business contact number
- **Location**: Your business location/address
- **Services**: Services you offer (comma-separated)
- **Website**: Your business website URL

Click **"Sign Up"** to create your account.

#### 2. **Log In**

Navigate to `login.html` (`/login.html`)

Enter your credentials:
- **Email**: The email you registered with
- **Password**: Your account password

Click **"Login"** to access your dashboard.

#### 3. **Access Your Dashboard**

After successful login, you'll be redirected to `dashboard.html`

Your dashboard includes:

- **Lead Statistics Card**
  - Total Leads: All leads received
  - Today's Leads: Leads received today
  - Converted Leads: Successfully converted leads

- **Lead Management Section**
  - View all submitted leads in a table
  - See lead details (name, phone, service, status, date)
  - Update lead status (Pending → Contacted → Converted → Lost)
  - Add notes to each lead

- **Generate Form Link**
  - Create a unique public form URL
  - Share with customers via email, social media, or website
  - Customers can submit inquiries without accounts

#### 4. **Manage Leads**

In the dashboard:
- **View Leads**: See all incoming leads in real-time
- **Update Status**: Change lead status as you interact with them
- **Add Notes**: Keep track of conversations and follow-ups
- **Delete Leads**: Remove old or duplicate leads

#### 5. **Forgot Password**

Navigate to `forgot-password.html` if you forget your password:
- Enter your registered email
- Receive reset link
- Create a new password

### 👥 For Customers

#### **Submit a Lead** (No Account Needed)

Navigate to the public form page (`index.html`)

Fill in simple details:
- **Name**: Customer's full name
- **Phone**: Contact number
- **Service**: Service interested in

Click **"Submit"** button.

Your inquiry will be received by the business instantly and visible in their dashboard.

## 🔌 API Endpoints

### Authentication Endpoints

```
POST /signup
  - Create new business account
  - Body: { name, email, password, profession, business_name, phone, location, services, website }

POST /login
  - User login
  - Body: { email, password }
  - Returns: JWT token

POST /forgot-password
  - Send password reset email
  - Body: { email }

POST /reset-password
  - Reset password with token
  - Body: { token, new_password }
```

### Lead Endpoints

```
GET /leads
  - Get all leads for logged-in user
  - Headers: { Authorization: token }

POST /leads
  - Create new lead
  - Body: { name, phone, service, email (optional) }

PUT /leads/:id
  - Update a lead
  - Body: { status, notes, updated_fields }
  - Headers: { Authorization: token }

DELETE /leads/:id
  - Delete a lead
  - Headers: { Authorization: token }
```

### User Endpoints

```
GET /user/profile
  - Get user profile information
  - Headers: { Authorization: token }

PUT /user/profile
  - Update user profile
  - Body: { updated_fields }
  - Headers: { Authorization: token }
```

## 🔐 Security Features

- **Password Hashing**: bcryptjs with salt rounds for secure password storage
- **JWT Authentication**: Stateless token-based authentication
- **CORS Protection**: Cross-origin resource sharing configured
- **Input Validation**: Server-side validation for all inputs
- **Access Control**: Protected routes require valid JWT token

## 📊 Data Models

### User (Business Owner)

```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "password": "hashed_string",
  "profession": "Gym|Salon|Clinic|Real Estate",
  "business_name": "string",
  "phone": "string",
  "location": "string",
  "services": "string",
  "website": "string",
  "created_at": "timestamp"
}
```

### Lead

```json
{
  "id": "uuid",
  "name": "string",
  "phone": "string",
  "email": "string (optional)",
  "service": "string",
  "status": "Pending|Contacted|Converted|Lost",
  "notes": "string",
  "user_id": "uuid (business owner)",
  "submitted_date": "timestamp"
}
```

## 🧪 Testing

### Test Account Credentials

After signup, you can test the application with:

**Business Account:**
```
Email: test@business.com
Password: test123
```

**Public Form:**
- Submit leads from `index.html`
- View submitted leads in the dashboard

## 🐛 Troubleshooting

### Issue: "Cannot GET /..."
**Solution**: Make sure backend server is running (npm start)

### Issue: CORS Error
**Solution**: Backend CORS is enabled; ensure frontend is accessing correct URL

### Issue: Leads not appearing
**Solution**: 
- Check browser console for errors (F12)
- Verify JWT token is valid
- Ensure you're logged in

### Issue: File not found errors
**Solution**: 
- Verify all files exist in correct directories
- Check file paths in frontend JavaScript code
- Ensure backend is serving from correct directory

## 📈 Future Enhancements

- [ ] Migration from JSON to SQL database (schema.sql ready)
- [ ] Email notifications for new leads
- [ ] Advanced lead analytics and reports
- [ ] Multi-user team support
- [ ] Email verification during signup
- [ ] Two-factor authentication (2FA)
- [ ] Lead assignment and workflow automation
- [ ] Integration with CRM systems
- [ ] Mobile app (React Native)
- [ ] Real-time notifications with WebSockets
- [ ] Lead scoring and prioritization

## 📝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 📧 Support & Contact

For questions, issues, or feedback:
- Create an issue on the repository
- Contact: support@leadflow.ai
- Documentation: See this README for detailed information

## 🙏 Acknowledgments

- Built with Express.js and Node.js
- Security powered by bcryptjs and JWT
- Responsive design principles for accessibility

---

**Last Updated**: March 2026  
**Version**: 1.0.0  
**Status**: Active Development
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

