<div align="center">
  <img src="https://img.shields.io/badge/Status-Secured_End--to--End-FF0000?style=for-the-badge" alt="Status" />
  <h1>🚨 Accident Detection System: AI Accident Detection</h1>
  <p><strong>Predict. Detect. Protect. Real-time vision intelligence for global road safety.</strong></p>
  
  <p>
    <a href="#-features">Features</a> •
    <a href="#-how-it-works">How It Works</a> •
    <a href="#-tech-stack">Tech Stack</a> •
    <a href="#-installation">Installation</a> •
    <a href="#-system-architecture">Architecture</a>
  </p>
</div>

---

## 👁️ Overview

**Accident Detection System** is a state-of-the-art, production-ready computer vision platform designed to instantly detect traffic accidents from camera feeds. Fusing a highly optimized YOLO object detection model with a high-performance Flask backend and a stunning React cyberpunk frontend, the system processes frames in milliseconds. Upon detecting severe collisions, it automatically triggers an escalation protocol, dispatching annotated visual evidence to authorities via Twilio (WhatsApp) and SMTP (Email).

![System Status](https://img.shields.io/badge/System-Online-brightgreen?style=flat-square)
![API Version](https://img.shields.io/badge/API-v2.4.0-blue?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.11+-yellow?style=flat-square)
![React](https://img.shields.io/badge/React-18-blue?style=flat-square)

---

## ✨ Features

- **Real-Time Video Inference**: Analyzes static imagery, video files, or live network camera (MJPEG) streams.
- **Sub-Second Escalations**: Auto-dispatches severe accident alerts with annotated bounding boxes straight to WhatsApp and Email.
- **Historical Risk Mapping**: Features a predictive geographical **KDTree** (via SciPy) analyzing hundreds of thousands of real UK and Indian motor records to calculate dynamic route safety indices.
- **God-Tier UI**: A breathtaking, glassmorphic React dashboard featuring a 3D animated hero, seamless routing, and responsive analytics.
- **Zero Absolute Paths**: Fully portable codebase ready to be deployed on Render, Vercel, or AWS anywhere in the world.

---

## ⚙️ How It Works

1. **Upload & Digest**: A user uploads a traffic feed (video/image) via the secured Dashboard.
2. **YOLO Analysis**: The Flask API passes the frames to our `best.pt` custom-trained YOLO model mapping spatial coordinates.
3. **Severity Calculation**: The engine classifies accidents as `Moderate` or `Severe` based on confidence metrics.
4. **Trigger Protocol**: If the confidence hits the threshold > 50%, an annotated `.jpeg` is cached and Twilio SMS/WhatsApp logic is immediately fired alongside an SMTP payload.

---

## 🛠️ Tech Stack

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend API** | Flask (Python) | High-throughput REST API, file handling & system bridging |
| **AI / ML** | Ultralytics YOLOv8 | Core bounding box inference & object detection |
| **Spatial Engine** | SciPy (KDTree) + Pandas | Geo-spatial indexing over massive accident matrices |
| **Frontend UI** | React + Vite | Component-driven, lightning-fast SPA architecture |
| **Styling** | Custom Vanilla CSS | High-fidelity Cyberpunk glassmorphism aesthetic |
| **Escalation** | Twilio API + Python SMTP | Instantaneous messaging logic |

---

## 🌍 Installation: Run from Anywhere

Whether you are pulling this for local testing on a Windows rig or an M1 Mac in a café, the system is fully containerized by `venv` and highly portable.

### 1. Clone the Repository
```bash
git clone https://github.com/MuthuxSelvam/Accident-Detection.git
cd Accident-Detection
```

### 2. Backend Setup (Flask & AI)
Make sure you have Python 3.10+ installed.

```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS / Linux:
source venv/bin/activate

# Install the machine-learning and API dependencies
pip install -r requirements.txt
```

### 3. Environment Variables
Create a file exactly named `.env` in the root directory (`Accident-Detection/`) to link your APIs:
```env
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
FROM_WHATSAPP_NUMBER=your_twilio_whatsapp_number
TO_WHATSAPP_NUMBER=your_target_whatsapp_number
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
FROM_EMAIL=your_email@gmail.com
TO_EMAIL=target_email@gmail.com
```

### 4. Boot up the Inference Backend
```bash
# With your `venv` active:
python app.py
```
> **Note:** The backend API will expose itself on `http://localhost:5000`. Keep this terminal running!

### 5. Frontend Setup (React Dashboard)
Open a **new separate terminal** window leaving the backend alive.

```bash
cd Accident-Detection/frontend

# Install node dependencies
npm install

# Start the frontend Vite server
npm run dev
```

> **Success!** Navigate to `http://localhost:5173` in your browser to interact with the system.

---

<div align="center">
  <p>Built for the Future of Road Safety.</p>
  <p>© 2026 Accident Detection System</p>
</div>
