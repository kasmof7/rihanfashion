# API Documentation

## Authentication
- POST /api/admin/login
  - Request: { username: string, password: string }
  - Response: { token: string } (JWT, expires in 24h by default)

- GET /api/admin/verify
  - Headers: Authorization: Bearer <token>
  - Response: { valid: boolean }

## Dresses
- GET /api/dresses
  - Query params: category, search, sort, featured, isNew, isOnSale, inStock, minPrice, maxPrice, page, limit
  - Response: { dresses: [], pagination: { page, limit, total, pages } }

- GET /api/dresses/featured
  - Response: Dress[] (max 10)

- GET /api/dresses/:id
  - Response: Dress object

- POST /api/dresses (Admin only)
  - Headers: Authorization: Bearer <token>
  - Body: { name, description, price, discountPrice, images, category, material, featured, isNew, isOnSale, inStock }

- PUT /api/dresses/:id (Admin only)
  - Headers: Authorization: Bearer <token>
  - Body: partial Dress fields

- DELETE /api/dresses/:id (Admin only)
  - Headers: Authorization: Bearer <token>
  - Response: { success: true }

## Uploads
- POST /api/upload (Admin only)
  - Body: FormData with "image" field (max 5MB, JPEG/PNG/WebP/GIF/AVIF)
  - Response: { url: string }

## Dynamic Blocks
- GET /api/blocks
  - Response: Block[]

## Reviews
- GET /api/reviews
  - Response: Review[]

- POST /api/reviews
  - Body: { name: string, review: string }
  - Response: { success: true, item: Review }

