# Trackseam — Client Measurement Records

A clean, formal web application for tailors to save, retrieve, and export client measurements.

---

## Project Structure

```
tailor-app/
├── backend/
│   ├── server.js          ← Express API + Mongoose models
│   ├── package.json
│   └── .env.example       ← Copy to .env and configure
└── frontend/
    ├── src/
    │   ├── App.jsx        ← Full React application
    │   └── main.jsx       ← Entry point
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Setup & Running

### 1. Prerequisites
- Node.js v18+
- MongoDB running locally **or** a MongoDB Atlas URI

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env          # edit MONGO_URI if needed
npm run dev                   # starts on http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                   # starts on http://localhost:3000
```

Open **http://localhost:3000** in your browser.

---

## API Reference

### Clients

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients` | List all clients |
| GET | `/api/clients/search?q=name` | Search clients by name |
| POST | `/api/clients` | Create a new client |
| DELETE | `/api/clients/:id` | Delete client + all measurements |

**POST /api/clients body:**
```json
{
  "clientId": "A3F7B2",
  "name": "Amara Okonkwo",
  "phone": "+234 801 234 5678",
  "email": "amara@email.com",
  "notes": "Prefers loose fits"
}
```

### Measurements

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/clients/:id/measurements` | Get all measurements for a client |
| POST | `/api/clients/:id/measurements` | Add a measurement |
| DELETE | `/api/clients/:id/measurements/:measId` | Delete a measurement |

**POST /api/clients/:id/measurements body:**
```json
{
  "outfitType": "Suit",
  "description": "Wedding suit — December 2025",
  "fields": {
    "Chest": "42",
    "Waist": "34",
    "Shoulder": "18"
  },
  "notes": "Navy blue wool. Client prefers slim cut."
}
```

---

## Features

- **Client Registry** — Each client gets a unique short ID (e.g. `A3F7B2`)
- **Multiple Measurements** — One client can have measurements for many outfits
- **Preset Outfit Types** — Shirt, Trouser, Dress, Suit, Skirt, Agbada, Kaftan, Custom
- **Search** — Find clients instantly by name
- **Export** — Download any measurement as a `.txt` file
- **Expandable Cards** — Click a measurement to view all fields

---

## Data Models

### Client
```
clientId    String (unique, human-readable)
name        String (indexed for search)
phone       String
email       String
notes       String
measurements [Measurement]  (embedded array)
createdAt   Date
```

### Measurement (embedded)
```
outfitType   String
description  String
fields       Map<String, String>  (field name → cm value)
notes        String
createdAt    Date
```
