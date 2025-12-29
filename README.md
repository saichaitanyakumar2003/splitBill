# 💰 SplitBill

A modern bill-splitting app with OCR receipt scanning. Scan receipts, assign items to friends, and calculate fair splits instantly.

![SplitBill](https://img.shields.io/badge/SplitBill-v1.0.0-FF6B35?style=for-the-badge)

## ✨ Features

- **📸 OCR Receipt Scanning** - Take a photo of any receipt and automatically extract items and prices
- **🧮 Smart Splitting** - Assign specific items to specific people with proportional or equal tax/tip distribution
- **📊 Clear Breakdowns** - See exactly what each person owes with detailed item breakdowns
- **📤 Easy Sharing** - Share split summaries with your friends
- **🌐 Web & Mobile** - Works on iOS, Android, and Web browsers

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
npx expo start --web --clear
```
Then open `http://localhost:8081` in your browser.

#### 📱 Run on Mobile (iOS/Android)
```bash
cd app
npx expo start
```
Then scan the QR code with **Expo Go** app on your phone.

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

## 📱 App Flow

### On Web Browser:
1. See **SB logo** with orange gradient background
2. Choose: **Add Custom Split** or **Upload Image**
3. Enter/scan items → Assign to people → See split summary

### On Mobile:
1. **Camera scanner** opens by default
2. **3-dot menu** (⋮) in top right for options:
   - Add Custom Split
   - Upload Image
3. Scan receipt → Assign items → See split summary

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React Native + Expo |
| **Styling** | expo-linear-gradient |
| **Backend** | Node.js + Express |
| **OCR** | Tesseract.js |
| **Database** | Supabase (optional) |

## 🔌 API Endpoints

### OCR
- `POST /api/ocr/scan` - Upload and scan a receipt image

### Bills
- `GET /api/bills` - Get all bills
- `POST /api/bills` - Create a new bill
- `GET /api/bills/:id` - Get a specific bill
- `PUT /api/bills/:id` - Update a bill
- `POST /api/bills/:id/assign` - Assign items to people
- `GET /api/bills/:id/split` - Calculate split amounts

### Groups
- `GET /api/groups` - Get all groups
- `POST /api/groups` - Create a new group
- `POST /api/groups/join` - Join via invite code

## 🎨 Theme

The app uses a vibrant **orange theme**:
- Primary: `#FF6B35` (Orange)
- Gradient: `#FF8C5A` → `#FF5722`
- Accent: White cards with shadows

## 📝 License

MIT License - feel free to use this project for personal or commercial purposes.

---

Built with ❤️ for hassle-free bill splitting
