# Security Considerations

- Admin password is hashed with bcrypt before comparison (stored in .env or default).
- JWT tokens are used for admin authentication with configurable expiry (default 24h).
- JWT secret is stored in environment variable JWT_SECRET.
- CORS is open for development (all origins allowed).
- File uploads are limited to 50MB and only image MIME types (JPEG, PNG, WebP, GIF, AVIF) validated server-side via multer fileFilter.
- Data is stored both in MongoDB (when available) and local JSON files as fallback.
- In production:
  - Set a strong JWT_SECRET environment variable
  - Restrict CORS to specific origins
  - Use HTTPS
  - Add rate limiting
  - Move to HttpOnly cookies for token storage
