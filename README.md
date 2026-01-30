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

**SplitBill offers FREE AI-powered OCR bill scanning** — a premium feature that competitors like Splitwise charge for in their Pro subscription ($4.99/month).

| Feature | SplitBill | Splitwise |
|---------|-----------|-----------|
| OCR Bill Scanning | ✅ **FREE** | ❌ Pro only ($4.99/mo) |
| Item-level Splitting | ✅ FREE | ❌ Pro only |
| Unlimited Scans | ✅ FREE | ❌ Limited |
| Smart Tax/Tip Distribution | ✅ FREE | ⚠️ Basic |

> **No subscriptions. No hidden fees. Just scan, split, and settle — completely free!**

---

## 🤖 Powered by Google Gemini AI

SplitBill uses **Google Gemini 2.5 Flash** — one of the most advanced multimodal AI models available:

| Model | Provider | Capability |
|-------|----------|------------|
| **Gemini 2.5 Flash** | Google AI | Vision + Language Understanding |

This cutting-edge multimodal model excels at understanding and extracting structured data from bill images, providing:

- 🎯 **High accuracy** in recognizing item names, prices, and quantities
- 🧠 **Smart categorization** of food items (Veg, Non-Veg, Beverages, Others)
- 📊 **Automatic tax & charge detection** (CGST, SGST, Service Charge)
- 🏪 **Restaurant/merchant name extraction**
- 💡 **Tax-inclusive bill handling** — correctly handles Indian GST bills
- ⚡ **Fast processing** — results in seconds

---

## ✨ Features

- **📸 OCR Receipt Scanning** - Take a photo of any receipt and automatically extract items and prices using AI
- **🧮 Smart Splitting** - Assign specific items to specific people with proportional or equal tax/tip distribution
- **📊 Clear Breakdowns** - See exactly what each person owes with detailed item breakdowns
- **📤 Easy Sharing** - Share split summaries with your friends
- **🔔 Push Notifications** - Get notified when you owe money or when expenses are added
- **🌐 Web & Mobile** - Works on Android and Web browsers

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
