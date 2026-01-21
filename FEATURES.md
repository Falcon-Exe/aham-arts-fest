# AHAM Arts Fest - Project Features

## 📱 Public Features (User Facing)

### 1. Home Page / Landing
*   **Cinematic Design:** Avant Garde aesthetic with a "Hero" section.
*   **Bento Grid Navigation:** Quick access to Events, Results, Registration, and Participants.
*   **Featured Spotlight:** Dynamic image gallery carousel (Admin managed).
*   **Live Ticker:** Scrolling announcement bar for real-time updates (e.g., "Results released for...").

### 2. Events & Schedule
*   **Event Listing:** View all arts fest events with details (Time, Venue, Stage).
*   **Filtering:** Filter by "On Stage", "Off Stage", or view "All".
*   **Search:** Real-time search by event name or category.

### 3. Results Dashboard
*   **Live Championship:** Displays the current **Festival Leader** and **Runner-up** with total points.
*   **Team Filters:** Quick-filter results by specific teams (e.g., ruby, emerald, etc.) with their live point totals.
*   **Detailed Winners:** Lists 1st, 2nd, and 3rd place winners for each event.
*   **Winner Details:** Shows Student Name, Grade, Team, and Chest Number.
*   **Social Sharing:** Built-in functionality to share specific result cards.

### 4. Participants Directory
*   **Master List:** Displays all registered performers (sourced seamlessly from Google Sheets CSV).
*   **Participant Cards:** Detailed profiles showing Name, Chest No, Team, CIC No.
*   **Event Registration Status:** Shows exactly which *On Stage* and *Off Stage* events a student is participating in.
*   **Search:** Find users by Name, Chest Number, or Team.

### 5. Registration
*   **Candidate Registration:** Fully integrated native React form.
    *   **Features:** Real-time fetching of available events, Team allocation (PYRA, IGNIS, ATASH), and direct submission to Firebase.

---

## 🛡️ Admin Features (Secure Dashboard)

### 1. General
*   **Secure Access:** Firebase Authentication for admin login.
*   **Live Stats:** Real-time counter for Total Events and Results Published.
*   **Role-Based Access:** Basic route protection for admin pages.

### 2. Event Management
*   **CRUD Operations:** Create, Read, Update, and Delete events.
*   **Sync:** One-click sync from Master CSV to auto-populate events.
*   **Bulk Upload:** Upload multiple events via CSV file.
*   **Categorization:** Define Stage, Venue, Time, and Type (On/Off Stage).

### 3. Results Management
*   **Publishing:** Input winners for specific events (1st, 2nd, 3rd).
*   **Smart Validation:** Checks against the Master Participant List to ensure the winner is actually registered for that specific event.
*   **Conflict Prevention:** Warns if a prize has already been awarded for an event (prevents duplicates).
*   **Bulk Actions:** Bulk upload results via CSV and Export history to CSV.
*   **Manual Entry:** Option for manual entry if a student is missing from the master list.

### 4. Team Standings (Automated)
*   **Auto-Scoring:** Automatically calculates team points based on published results (1st=5, 2nd=3, 3rd=1).
*   **Live Leaderboard:** Detailed table showing rank, gold/silver/bronze counts, and total scores.
*   **Manual Overrides:** Calculation logic is visible and verifiable.

### 5. Content Control
*   **Announcements:** Update and toggle the global scrolling ticker message.
*   **Gallery:** Add or remove promoted images from the Home Page spotlight.

---

## 🚀 Technical Implementation

### Core Stack
*   **Frontend:** React-based Single Page Application (SPA).
*   **Build Tool:** Vite for fast HMR and optimized builds.
*   **Backend/Database:** Firebase Firestore for real-time data syncing.
*   **Authentication:** Firebase Auth.

### Advanced Capabilities
*   **PWA (Progressive Web App):** Fully installable on mobile/desktop with offline capabilities (`vite-plugin-pwa`).
*   **Performance:** Code splitting and lazy loading (Suspense) for optimized load times.
*   **SEO Optimization:** Basic structure for search visibility.
*   **State Management:** Real-time Firestore listeners for live updates without page refreshes.
