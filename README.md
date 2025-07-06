# Real Estate Outreach Automation Platform

A full-stack Real Estate Outreach Automation Platform built with **Next.js**, **Supabase**, and **n8n**. It automates property email campaigns by extracting property and owner info using **Gemini Pro AI**, managing email templates, and tracking analytics. The system automatically sends amenity proposals when owners reply with specific keywords, powered by n8n workflows.

---

## Overview

This platform streamlines real estate outreach by combining AI-driven property data extraction, automated email workflows, and centralized campaign analytics. It is designed for marketing teams, agencies, and property managers looking to scale communication with property owners efficiently.

### Core Workflow

1. **Property Upload:** Users upload property images and addresses.
2. **AI Extraction:** Gemini Pro AI extracts the property name and owner/manager details.
3. **Email Campaign:** The system sends personalized emails to property owners.
4. **Reply Detection:** When an owner replies with a target keyword, an amenity proposal is automatically sent.
5. **Analytics Dashboard:** Tracks campaign performance, reply rate, and engagement metrics.

---

## Features

### Frontend (Next.js)

* Modern, responsive UI using Tailwind CSS and ShadCN components.
* Role-based authentication and secure session handling.
* Real-time campaign analytics and property upload interface.

### Backend (Supabase)

* Database for storing property, campaign, and user data.
* Supabase Auth for secure login and role-based access control.
* Real-time updates for campaign and email metrics.

### AI Integration (Gemini Pro)

* Extracts property name and management information from uploaded images.
* Enriches database entries with contextual data for personalization.

### Email Automation (n8n)

Three core workflows:

* **Send Emails:** Automates property outreach using predefined templates.
* **Monitor Replies:** Detects owner responses and triggers proposals.
* **Unsubscribe Handling:** Automatically removes contacts who opt out.

### Additional Tools

* **Email Template Management:** Create, edit, and activate templates for outreach.
* **Amenity Proposal Management:** Upload and link proposal PDFs to specific campaigns.
* **Analytics Dashboard:** Provides metrics on email delivery, replies, and conversions.

---

## Tech Stack

| Layer          | Technology                           |
| -------------- | ------------------------------------ |
| Frontend       | Next.js, Tailwind CSS, ShadCN UI     |
| Backend        | Supabase (PostgreSQL, Auth, Storage) |
| Automation     | n8n Workflows                        |
| AI Integration | Gemini Pro API                       |
| Email Delivery | Gmail API / SMTP                     |

---

## Installation

### Prerequisites

* Node.js 18+
* Supabase account and project setup
* n8n self-hosted instance or cloud workspace
* Gemini API key

### 1. Clone the Repository

```bash
git clone https://github.com/anas-farooq8/Realestate-Outreach.git
cd Realestate-Outreach
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env.local` file and add:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SUPABASE_BUCKET_NAME=your_bucket_name

GEMINI_API_KEY=your_gemini_api_key

EMAIL_USER=your_sending_email
EMAIL_PASSWORD=your_email_app_password

ROOT_USER_EMAIL=admin_or_root_email

NEXT_PUBLIC_APP_URL=https://yourappurl.com
```

### 4. Run Development Server

```bash
npm run dev
```

Then open `http://localhost:3000` in your browser.

---

## n8n Workflows

1. **Send Emails:** Sends outreach emails to property owners.
2. **Monitor Replies:** Tracks replies and filters by keyword (e.g., "Interested").
3. **Unsubscribe Flow:** Handles removal requests and updates Supabase.

These workflows can be imported into n8n via JSON exports from the `/n8n` folder.

---

### Demo
<img width="1920" height="1200" alt="Image" src="https://github.com/user-attachments/assets/1c277eb7-e398-43bd-82ae-29b310091482" />
<img width="1920" height="1200" alt="Image" src="https://github.com/user-attachments/assets/ba7b40ca-f5c1-41b2-b33b-83a8dda3e362" />
<img width="1920" height="1200" alt="Image" src="https://github.com/user-attachments/assets/83760f32-e25d-4312-8e2e-f7ae4b49a1ae" />
<img width="1920" height="1200" alt="Image" src="https://github.com/user-attachments/assets/50972b35-48ec-404e-bc87-186cf9b27adb" />
<img width="1920" height="1200" alt="Image" src="https://github.com/user-attachments/assets/edac3119-185f-44c8-ad5d-b2af3eccd1e8" />
