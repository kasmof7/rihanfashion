# Architecture Overview

## Frontend
- Static HTML/CSS/JS served directly from the project root.
- Pages: index.html (home), dresses/dresses.html (listing), Admin/admin.html (dashboard), 404.html
- JS modules: script.js (home page), dresses.js (listing page), dynamic-blocks.js (admin-managed blocks), admin.js (CRUD)
- CSS: style.css (global), dresses/dresses.css (listing), Admin/admin.css (dashboard)

## Backend
- Node.js + Express REST API on configurable port (default 3000).
- JWT-based authentication for admin routes.
- MongoDB via Mongoose (when MONGODB_URI is set), falling back to JSON file storage in data/.
- File uploads via multer, stored in backend/uploads/.

## Key Endpoints
- GET /api/dresses - List dresses with filtering, sorting, pagination
- GET /api/dresses/:id - Single dress detail
- POST/PUT/DELETE /api/dresses/:id - CRUD (admin only)
- POST /api/admin/login - JWT authentication
- POST /api/upload - Image upload (admin only)
- GET /api/blocks - Dynamic content blocks
- POST /api/reviews - Customer reviews
