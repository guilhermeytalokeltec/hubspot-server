# HubSpot Contact Manager Backend

A full-stack application built with React, Vite, ShadCN/UI, and an Express backend to manage HubSpot contact data. It integrates with the HubSpot CRM API to fetch and update contact properties (ZIP and city) and uses the Geoapify API for geocoding based on ZIP codes. Webhooks from HubSpot automatically trigger city updates when a contact's ZIP changes.

---

## Features

* List and view HubSpot contacts with ZIP and city properties
* Update contact ZIP code and automatically geocode to update city
* Manual endpoints for testing geocoding and contact updates
* Webhook listener to process real-time ZIP changes and update city
* Clean UI built with ShadCN/UI components and Tailwind CSS

---

## Tech Stack

* **Frontend**: React, Vite, TypeScript, ShadCN/UI, Sonner (toasts)
* **Backend**: Node.js, Express, Axios
* **APIs**: HubSpot CRM API, Geoapify Geocoding API
* **Styling**: Tailwind CSS

---

## Prerequisites

* Node.js v16+ and npm or pnpm
* A HubSpot Developer account with a private app and API token
* Geoapify API key

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/guilhermeytalokeltec/hubspot-server.git
cd hubspot-server
```

### 2. Set Up Environment Variables

Create a `.env` file in the project root (and in any PoC folder if needed) with the following:

```env
# .env
HUBSPOT_TOKEN=your_hubspot_private_app_token
GEOAPIFY_API_KEY=your_geoapify_api_key
PORT=3000
```

### 3. Install Dependencies

```bash
# using npm
npm install
```

### 4. Run the Backend Server

```bash
npm run dev
```

By default, the Express server runs on `http://localhost:3000`.

## API Endpoints

### Contact Info

* **GET** `/contact-info/:contactId`

  * Fetch a contact’s properties: `zip`, `city`, `firstname`, `lastname`.
  * **Response**:

    ```json
    {
      "success": true,
      "contact": { /* HubSpot contact object */ }
    }
    ```

### List Contacts

* **GET** `/list-contacts`

  * List up to contacts with `zip`, `city`, `firstname`, `lastname`.
  * **Response**: HubSpot contacts results.

### Geocode (Test)

* **GET** `/geocode?postcode=XXXX&country=US`

  * Manual test of Geoapify geocoding for a given ZIP.
  * **Response** returns `postcode`, `country`, `city` (if found), and full raw payload.

### Update ZIP

* **POST** `/update-zip/:contactId`

  * Body: `{ "zip": "12345" }`
  * Updates the contact’s `zip` property.
  * **Response** includes updated contact data.

### Update City (Manual)

* **GET** `/update-city/:contactId`

  * Reads existing `zip`, geocodes via Geoapify, and patches the contact’s `city`.
  * **Response**:

    ```json
    {
      "success": true,
      "contactId": "...",
      "zip": "...",
      "city": "...",
      "message": "Contato ... atualizado com cidade: ..."
    }
    ```

### Webhook Listener

* **POST** `/webhook`

  * Receives HubSpot property change events.
  * Listens for `zip` changes and automatically updates `city`.
  * Always responds with HTTP `200 OK` on success.

---

## Scripts

| Command                  | Description                            |
| ------------------------ | -------------------------------------- |
| `npm run dev`    | Start Express server on port 3000      |

---

## Environment

| Variable           | Description                             |
| ------------------ | --------------------------------------- |
| `HUBSPOT_TOKEN`    | HubSpot private app token               |
| `GEOAPIFY_API_KEY` | Geoapify API key for geocoding          |
| `PORT`             | Port for Express server (default: 3000) |

---
