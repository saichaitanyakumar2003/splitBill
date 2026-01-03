# 💰 SplitBill

A modern bill-splitting app with OCR receipt scanning. Scan receipts, assign items to friends, and calculate fair splits instantly.

![SplitBill](https://img.shields.io/badge/SplitBill-v1.0.0-FF6B35?style=for-the-badge)

🌐 **Live Demo:** [https://splitbill-sand.vercel.app/](https://splitbill-sand.vercel.app/)

> **Note:** For OAuth SSO usage, please reach out to the owner.

## ✨ Features

- **📸 OCR Receipt Scanning** - Take a photo of any receipt and automatically extract items and prices
- **🧮 Smart Splitting** - Assign specific items to specific people with proportional or equal tax/tip distribution
- **📊 Clear Breakdowns** - See exactly what each person owes with detailed item breakdowns
- **📤 Easy Sharing** - Share split summaries with your friends
- **🌐 Web & Mobile** - Works on Android, and Web browsers

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
| **OCR** | qwen AI model |
| **Database** | Mongo DB |


Built with ❤️ for hassle-free bill splitting
