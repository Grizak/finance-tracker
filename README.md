# Finance Tracker API

A robust backend API for the Personal Finance Tracker application built with Node.js, Express, SQLite, and JWT authentication.

## Features

- 🔐 JWT-based authentication
- 📊 Complete transaction management (CRUD operations)
- 💾 SQLite database with proper relations
- 🔒 Password hashing with bcrypt
- 🌐 CORS support for frontend integration
- ✅ Input validation and error handling
- 📝 RESTful API design

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- pnpm

### Installation

1. Clone or download the backend code
2. Install dependencies:

```bash
pnpm install
```

3. Create environment file:

```bash
cp .env.example .env
```

4. Edit `.env` file with your settings:

```env
PORT=3001
JWT_SECRET=your-very-long-and-random-secret-key-here
FRONTEND_URL=http://localhost:3000
```

5. Initialize database:

```bash
npm run init-db
```

6. Start the server:

```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:3001`

## API Endpoints

### Authentication

- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - User login

### Transactions (Requires Authentication)

- `GET /api/transactions` - Get all user transactions
- `POST /api/transactions` - Replace all user transactions (bulk update)
- `POST /api/transactions/add` - Add single transaction
- `DELETE /api/transactions/:transactionId` - Delete specific transaction

### User

- `GET /api/user/profile` - Get user profile information

### Utility

- `GET /api/health` - API health check

## Request/Response Examples

### Register User

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

Response:

```json
{
  "message": "User created successfully",
  "email": "user@example.com",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": 1
}
```

### Add Transaction

```bash
curl -X POST http://localhost:3001/api/transactions/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "id": 1640995200000,
    "description": "Salary",
    "amount": 5000,
    "type": "income",
    "category": "Salary",
    "date": "12/31/2023"
  }'
```

## Database Schema

### Users Table

- `id` - Primary key
- `email` - Unique email address
- `password_hash` - Bcrypt hashed password
- `created_at` - Account creation timestamp

### Transactions Table

- `id` - Primary key
- `user_id` - Foreign key to users table
- `transaction_id` - Frontend transaction ID
- `description` - Transaction description
- `amount` - Transaction amount
- `type` - 'income' or 'expense'
- `category` - Transaction category
- `date` - Transaction date
- `created_at` - Record creation timestamp

## Security Features

- JWT tokens with 7-day expiration
- Password hashing with bcrypt (10 salt rounds)
- Input validation and sanitization
- CORS protection
- SQL injection prevention with parameterized queries
- User isolation (users can only access their own data)

## Error Handling

The API returns consistent error responses:

```json
{
  "error": "Description of what went wrong"
}
```

Common HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (token expired)
- `404` - Not Found
- `500` - Internal Server Error

## Development

### Running Tests

```bash
npm test
```

### Database Management

The SQLite database file (`finance.db`) will be created automatically. You can view it using any SQLite browser or command line tools.

To reset the database:

```bash
rm finance.db
npm run init-db
```

## Production Deployment

1. Set `NODE_ENV=production` in your environment
2. Use a strong, random JWT secret (minimum 32 characters)
3. Consider using a more robust database (PostgreSQL, MySQL) for production
4. Set up proper logging and monitoring
5. Use HTTPS in production
6. Configure proper CORS origins

## Frontend Integration

Update your frontend's `API_BASE` to point to your deployed backend:

```javascript
const API_BASE = "https://your-backend-domain.com/api";
```

The frontend will automatically handle:

- User authentication
- Token storage and refresh
- Data synchronization between local and cloud storage

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the `PORT` in `.env` file
2. **Database errors**: Make sure you ran `npm run init-db`
3. **CORS errors**: Check that `FRONTEND_URL` in `.env` matches your frontend URL
4. **Token errors**: Verify `JWT_SECRET` is set and consistent

### Logs

The server logs important events to the console. In production, consider using a proper logging solution like Winston.

## License

MIT License - feel free to use this code in your projects!
