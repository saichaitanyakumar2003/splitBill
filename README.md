# 💰 SplitBill

A modern bill-splitting app with OCR receipt scanning. Scan receipts, assign items to friends, and calculate fair splits instantly.

![SplitBill](https://img.shields.io/badge/SplitBill-v1.0.0-FF6B35?style=for-the-badge)

🌐 **Web Link:** [https://splitbill-sand.vercel.app/](https://splitbill-sand.vercel.app/)

📱 **Download Android App:** 

[https://github.com/saichaitanyakumar2003/splitBill/releases/download/v1.0.0/application-63f45298-acb2-42f6-842e-38d52cf2d9e5.apk](https://github.com/saichaitanyakumar2003/splitBill/releases/download/v1.0.0/application-63f45298-acb2-42f6-842e-38d52cf2d9e5.apk)

> **Note:** Google OAuth SSO is available only for web users. Mobile users can sign up/login using email. For OAuth access, please reach out to the owner.

> ⏳ **Server Cold Start:** The backend is hosted on Render's free tier, which spins down after 15 minutes of inactivity. Your first request may take **~50 seconds** while the server wakes up. Subsequent requests will be fast. Please be patient on first load!

---

## 🆓 Why SplitBill?

Other expense-splitting apps charge **$4.99/month or more** for premium features like OCR scanning and analytics. **SplitBill gives you everything for FREE.**

### What You Get — 100% Free:
- **📸 AI-Powered OCR Scanning** — Scan any receipt and extract items automatically
- **🧮 Item-Level Splitting** — Assign specific items to specific people
- **📊 Expense Analytics** — Track spending by category with interactive charts
- **🤖 AI-Powered Insights** — Get personalized spending summaries and saving tips
- **🔔 Push Notifications** — Stay updated on group expenses
- **♾️ Unlimited Usage** — No caps, no limits, no subscriptions

> **No subscriptions. No hidden fees. Just scan, split, and track — completely free!**

---

## 🤖 Powered by Google Gemini AI

SplitBill uses **Google Gemini 2.5 Flash** — one of the most advanced multimodal AI models — for both OCR and analytics:

### Receipt Scanning (Vision AI)
- 🎯 **High accuracy** in recognizing item names, prices, and quantities
- 🧠 **Smart categorization** of food items (Veg, Non-Veg, Beverages, Others)
- 📊 **Automatic tax & charge detection** (CGST, SGST, Service Charge)
- 🏪 **Restaurant/merchant name extraction**
- 💡 **Tax-inclusive bill handling** — correctly handles Indian GST bills
- ⚡ **Fast processing** — results in seconds

### Expense Analytics (Language AI)
- 🏷️ **Auto-categorization** of expenses into Food, Travel, Entertainment, Shopping, Others
- 📈 **Spending pattern analysis** across months
- 💬 **Personalized AI summaries** with saving tips
- 🔄 **Smart caching** to minimize API calls

---

## ✨ Features

- **📸 OCR Receipt Scanning** - Take a photo of any receipt and automatically extract items and prices using AI
- **🧮 Smart Splitting** - Assign specific items to specific people with proportional or equal tax/tip distribution
- **📊 Clear Breakdowns** - See exactly what each person owes with detailed item breakdowns
- **📤 Easy Sharing** - Share split summaries with your friends
- **🔔 Push Notifications** - Get notified when you owe money or when expenses are added
- **🌐 Web & Mobile** - Works on Android and Web browsers

---

## 📈 Expense Analytics & AI Insights (Android Only)

Track your spending patterns and get AI-powered insights — all for free!

> **Note:** Analytics features are currently available only on the Android app.

### Expense Insights (Pie Chart)
- View spending breakdown by category for any month
- Interactive pie chart — tap a slice to see details
- Filter by categories: Food, Travel, Entertainment, Shopping, Others

### Analysis (Bar Chart)
- Compare spending across categories over time
- Select date range: Past 1-6 months
- See total spending trends at a glance

### AI-Powered Summary
- Get personalized insights about your spending habits
- See where you spent the most and month-over-month changes
- Receive actionable saving tips based on your patterns
- Powered by Google Gemini AI (2 summaries per day)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Navigate to the project
cd splitBill

# Install app dependencies
cd app
npm install

# Install web dependencies
npx expo install react-native-web react-dom @expo/metro-runtime
```

### Running the App

#### 🌐 Run in Web Browser (Recommended for testing)
```bash
cd app
npx expo start --web
```
Then open `http://localhost:8081` in your browser.

#### 🖥️ Run Backend Server (Optional - for OCR)
```bash
cd backend
npm install
npm run dev
```
Backend runs on `http://localhost:3001`

## 🏗️ Project Structure

```
splitBill/
├── app/                    # React Native/Expo mobile app
│   ├── src/
│   │   ├── screens/        # App screens
│   │   ├── components/     # Reusable components
│   │   ├── api/            # API client
│   │   └── theme.js        # UI theme (orange theme)
│   ├── App.js              # Main app entry point
│   └── package.json
│
├── backend/                # Node.js/Express API
│   ├── src/
│   │   ├── routes/         # API routes (OCR, bills, groups)
│   │   └── utils/          # Utilities (bill parser, Supabase client)
│   └── package.json
│
└── package.json            # Monorepo root
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React Native + Expo |
| **Styling** | expo-linear-gradient |
| **Backend** | Node.js + Express |
| **AI/OCR** | Google Gemini 2.5 Flash |
| **Database** | MongoDB |
| **Notifications** | Expo Push Notifications + FCM |
| **Hosting** | Vercel (Frontend) + Render (Backend) |


Built with ❤️ for hassle-free bill splitting
