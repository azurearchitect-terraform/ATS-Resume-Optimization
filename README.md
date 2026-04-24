<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/46d0b811-33d0-4b91-a2d2-d84e11607e87

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

# 🚀 How to Use Nexus AI

## 📊 Dashboard Setup
- Navigate to the **Career Tools** section.
- Configure your AI engine:
  - Gemini
  - OpenAI
  - Hybrid Mode

> **Note:** The system includes resilient logic that automatically falls back to secondary models if your primary quota is reached.

---

## 📄 Resume Optimization
- Upload your current resume or paste it into the **Resume Editor**.
- Paste the **Job Description (JD)** you are targeting.
- Click **Optimize**.

Nexus AI will:
- Analyze JD keywords
- Reconstruct your resume
- Improve ATS readability
- Increase impact scores

---

## 📌 Job Tracking
- Use the **Job Tracker** to save applied roles.
- Manage application status:
  - Applied
  - Interviewing
  - Offered
  - etc.

---

## 📈 Nexus AI Analytics
- Track AI usage in real-time.
- Access the **Usage & Tokens Dashboard** to view:
  - Model usage (Gemini vs OpenAI)
  - Token consumption
  - Estimated costs

---

## 🌐 Browser Helper (Advanced)
The app includes a **Nexus AI Autofill Extension**:

- Copy optimized resume data as a JSON payload
- Autofill job applications (e.g., Workday, Greenhouse)
- Save time on repetitive form filling

---

# ⚙️ Resilience & Fallback Features

Built to handle API quota limitations seamlessly:

### 🔹 Stage 1: Extraction
- Primary: **Gemini 3.1 Flash**
- Fallback: **Gemini 2.0 Flash**

### 🔹 Stage 2: Generation
- Hybrid Mode:
  - Primary: **OpenAI (Premium Model)**
  - Fallback: **Gemini 2.0 Flash**

> Ensures uninterrupted workflow and prevents data loss during optimization.
