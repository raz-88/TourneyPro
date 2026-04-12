# TourneyPro — Setup Guide

## 🗂️ Project Structure

```
tournament-app/
├── public/
├── src/
│   ├── firebase/
│   │   ├── config.js          # Firebase init
│   │   ├── auth.js            # Auth service functions
│   │   └── firestore.js       # All DB operations
│   ├── contexts/
│   │   ├── AuthContext.jsx    # Auth state + profile
│   │   └── TournamentContext.jsx
│   ├── components/
│   │   ├── ui/index.jsx       # Shared design system
│   │   ├── auth/
│   │   │   ├── AuthPage.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── dashboard/
│   │   │   ├── Layout.jsx     # Sidebar + header shell
│   │   │   └── DashboardPage.jsx
│   │   ├── tournament/
│   │   │   ├── TournamentsPage.jsx
│   │   │   ├── CreateTournamentPage.jsx
│   │   │   └── TournamentDetailPage.jsx
│   │   ├── matches/
│   │   │   └── MatchesPage.jsx
│   │   ├── fixtures/
│   │   │   └── FixturesPage.jsx
│   │   ├── leaderboard/
│   │   │   └── LeaderboardPage.jsx
│   │   ├── subusers/
│   │   │   └── SubUsersPage.jsx
│   │   └── settings/
│   │       └── SettingsPage.jsx
│   ├── utils/
│   │   └── fixtureGenerator.js  # Core algorithms
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── firestore.rules
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## 🗄️ Firestore Schema

### Collection: `users`
```json
{
  "uid": "string",
  "name": "string",
  "email": "string",
  "role": "main | sub",
  "mainUserId": "string",      // self for main; parent uid for sub
  "permissions": "admin | edit | view",
  "createdAt": "timestamp"
}
```

### Collection: `tournaments`
```json
{
  "name": "string",
  "sport": "string",
  "numTeams": "number",
  "tournamentType": "pool | knockout",
  "fixtureMode": "auto | manual",
  "numPools": "number | null",
  "scoringWin": "number",
  "scoringDraw": "number",
  "scoringLoss": "number",
  "includeQF": "boolean",
  "includeSF": "boolean",
  "includeFinal": "boolean",
  "status": "draft | active | completed",
  "mainUserId": "string",
  "createdBy": "string",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### Collection: `teams`
```json
{
  "name": "string",
  "tournamentId": "string",
  "mainUserId": "string",
  "createdAt": "timestamp"
}
```

### Collection: `matches`
```json
{
  "tournamentId": "string",
  "mainUserId": "string",
  "type": "pool | knockout",
  "poolId": "string | null",   // e.g. 'Pool A'
  "stage": "QF | SF | Final | null",
  "round": "number | null",
  "matchNo": "number | null",
  "teamAId": "string",
  "teamBId": "string",
  "teamAName": "string",
  "teamBName": "string",
  "scoreA": "number | null",
  "scoreB": "number | null",
  "status": "upcoming | ongoing | completed",
  "scheduledAt": "timestamp | null",
  "winnerId": "string | null",
  "createdAt": "timestamp"
}
```

### Collection: `leaderboard`
> Document ID: `{tournamentId}_{teamId}`
```json
{
  "tournamentId": "string",
  "teamId": "string",
  "poolId": "string | null",
  "mainUserId": "string",
  "played": "number",
  "won": "number",
  "drawn": "number",
  "lost": "number",
  "gf": "number",
  "ga": "number",
  "gd": "number",
  "points": "number",
  "updatedAt": "timestamp"
}
```

---

## 🚀 Setup Instructions

### Step 1 — Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `tourney-pro`)
3. Enable **Google Analytics** (optional)
4. Click **Create project**

### Step 2 — Enable Firebase Services

**Authentication:**
1. In Firebase Console → **Authentication** → **Get started**
2. Under **Sign-in method** → Enable **Email/Password**

**Firestore:**
1. Go to **Firestore Database** → **Create database**
2. Choose **Start in production mode**
3. Select your region (e.g. `us-central1`)

### Step 3 — Get Config Keys

1. Go to **Project settings** (gear icon)
2. Under **Your apps** → click Web (`</>`)
3. Register app name → Copy the `firebaseConfig` object

### Step 4 — Add Config to the Project

Open `src/firebase/config.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Step 5 — Deploy Firestore Security Rules

Install Firebase CLI if you haven't:
```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # select your project
```

Copy `firestore.rules` to your project root, then:
```bash
firebase deploy --only firestore:rules
```

### Step 6 — Install & Run

```bash
cd tournament-app
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Step 7 — Create Required Firestore Indexes

In the Firebase Console → Firestore → **Indexes**, create these composite indexes:

| Collection  | Fields                              | Order |
|-------------|-------------------------------------|-------|
| tournaments | mainUserId ASC, createdAt DESC      | —     |
| teams       | tournamentId ASC, createdAt ASC     | —     |
| matches     | tournamentId ASC, scheduledAt ASC   | —     |
| leaderboard | tournamentId ASC                    | —     |
| users       | mainUserId ASC, role ASC            | —     |

> **Tip:** Firestore will also auto-prompt you with index creation links in your browser console when you first run queries.

---

## 🧠 Core Algorithms

### Auto Pool Sizing
- 8 teams  → 2 pools of 4
- 12 teams → 4 pools of 3
- 16 teams → 4 pools of 4
- Odd sizes → pools sized with ±1 overflow

### Round Robin (Circle Method)
- Fix one team at position 0
- Rotate the rest across `n-1` rounds
- Each round produces `n/2` pairs
- Total matches = n(n-1)/2

### Leaderboard Sort
- Primary:   Points (desc)
- Secondary: Goal Difference (desc)
- Tertiary:  Goals For (desc)

---

## 🏗️ Build for Production

```bash
npm run build
```
Output goes to `dist/`. Deploy to Firebase Hosting:
```bash
firebase init hosting   # point to dist/
firebase deploy --only hosting
```

---

## 👥 User Roles Quick Reference

| Action                  | Main Admin | Sub (Edit) | Sub (View) |
|-------------------------|:----------:|:----------:|:----------:|
| Create tournament       | ✅         | ❌         | ❌         |
| View tournaments        | ✅         | ✅         | ✅         |
| Add/edit teams          | ✅         | ✅         | ❌         |
| Generate fixtures       | ✅         | ✅         | ❌         |
| Enter match scores      | ✅         | ✅         | ❌         |
| View leaderboard        | ✅         | ✅         | ✅         |
| Manage sub-users        | ✅         | ❌         | ❌         |
| Delete tournaments      | ✅         | ❌         | ❌         |
