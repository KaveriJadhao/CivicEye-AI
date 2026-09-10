# 👁️ CivicEye-AI

**CivicEye-AI** is a full-stack, AI-powered civic issue reporting and municipal intelligence platform. It empowers citizens to report urban infrastructure hazards (potholes, overflowing garbage, broken streetlights, waterlogging, road obstructions) using photo uploads and voice notes, while providing municipal authorities with automated AI triage, geospatial heatmaps, SLA tracking, and resolution workflows.

---

## 🌟 Key Features

### 👤 Citizen Portal
- 📸 **Instant Snap & Report**: Drag-and-drop or camera snap with automatic GPS geolocation and map pin dropper.
- 🤖 **Live AI Vision Scan**: Real-time pre-submission scanning that classifies category, severity score ($1-10$), urgency level, and suggested work order title.
- 🎙️ **Voice AI Logging**: Speak naturally to describe hazards via the Web Speech API.
- 🗺️ **Geospatial Map & Community Feed**: Interactive Leaflet map with pulsing severity markers and live feed filters.
- 👥 **Community Upvoting**: Citizens can upvote active issues to automatically escalate priority to municipal departments.
- 🏆 **Civic Karma & Gamification**: Earn karma points and unlock badges for filing and verifying civic reports.

### 🏛️ Municipal Command & Admin Cockpit
- 📊 **Executive SLA Dashboard**: Real-time KPI metrics for total reports, critical hazards, active work orders, and resolution times.
- 📈 **Visual Analytics**: Interactive Category Breakdown Doughnut chart and Department Workload efficiency bars powered by Chart.js.
- 🚦 **Work Order Triage & Dispatch**: Transition statuses (`REPORTED` $\to$ `VERIFIED` $\to$ `ASSIGNED` $\to$ `IN_PROGRESS` $\to$ `RESOLVED`) and assign field officers.
- 🔍 **AI Resolution Verification**: Verifies field crew repair photos before marking tickets as resolved.
- 📍 **Duplicate Spatial Clustering**: Automatically detects and merges duplicate reports logged within close proximity.

---

## 🛠️ Tech Stack (Easy to Explain)

| Component | Technologies |
| :--- | :--- |
| **Frontend** | HTML5, CSS3, Modern JavaScript (ES6+), Tailwind CSS, FontAwesome 6, Leaflet.js, Chart.js, Canvas Confetti |
| **Backend** | Node.js, Express.js, Multer, CORS, dotenv |
| **AI Engine** | Groq LLaMA 3.3 / Gemini Vision integration + Built-in Smart Heuristic Vision Engine (Zero-config offline mode) |
| **Database** | MongoDB Atlas (Mongoose) + Automatic Local JSON Store Fallback |

---

## 🚀 Quick Start & Run Locally

```bash
# 1. Clone or open the repository
cd CivicEye-AI

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

Open **`http://localhost:5000`** in your browser to explore the live application!

---

## 📁 Project Structure

```
CivicEye-AI/
├── Backend/
│   ├── controllers/
│   │   ├── adminController.js      # Municipal stats, department workloads & hotspots
│   │   ├── aiController.js         # Live AI preview & resolution verification
│   │   └── reportController.js     # Report CRUD, upvotes, and status workflows
│   ├── models/
│   │   └── Report.js               # Mongoose schema + local fallback store
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── aiRoutes.js
│   │   └── reportRoutes.js
│   ├── services/
│   │   ├── aiService.js            # Multimodal AI triage & Smart Vision engine
│   │   └── geoService.js           # Haversine distance & duplicate detection
│   ├── uploads/                    # Uploaded hazard images
│   ├── data/                       # Local database store (reports.json)
│   ├── seedData.js                 # Realistic urban civic dataset
│   └── server.js                   # Express server entry point
├── Frontend/
│   ├── css/
│   │   └── style.css               # Modern glassmorphism & map styling
│   ├── js/
│   │   ├── api.js                  # Frontend API service client
│   │   ├── app.js                  # Application controller & state
│   │   └── map.js                  # Leaflet map manager & pulse markers
│   ├── assets/
│   └── index.html                  # Responsive Citizen & Admin UI
├── package.json
└── README.md
```

---

## 👩‍💻 Author

Made with ❤️ by **Kaveri Jadhao**  
GitHub: [@KaveriJadhao](https://github.com/KaveriJadhao)
