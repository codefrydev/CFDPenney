# Annonate - Microsoft Teams Clone

A full-stack Microsoft Teams-like application built with React (TypeScript) and ASP.NET Core.

## Tech Stack

### Frontend
- React 18+ with TypeScript
- Vite (build tool)
- Redux Toolkit (state management)
- React Router v6
- Tailwind CSS
- SignalR Client (@microsoft/signalr)
- Axios

### Backend
- ASP.NET Core 9.0
- Entity Framework Core with SQLite
- JWT Authentication
- SignalR (real-time communication)
- BCrypt (password hashing)

## Project Structure

```
Annonate/
├── frontend/          # React TypeScript application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── store/        # Redux store and slices
│   │   ├── services/     # API and SignalR services
│   │   ├── types/        # TypeScript type definitions
│   │   └── utils/        # Utility functions
│   └── package.json
│
└── Annonate.Api/     # ASP.NET Core Web API
    ├── Controllers/  # API controllers
    ├── Models/       # Database models
    ├── Services/     # Business logic services
    ├── Hubs/         # SignalR hubs
    ├── Data/         # DbContext
    └── DTOs/         # Data transfer objects
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- .NET 9.0 SDK

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`

### Backend Setup

```bash
cd Annonate.Api
dotnet restore
dotnet run
```

The backend will run on `https://localhost:5001` (or `http://localhost:5000`)

### Environment Variables

Create a `.env` file in the `frontend` directory:

```
VITE_API_BASE_URL=http://localhost:5000/api
```

## Features

- ✅ User authentication (JWT)
- ✅ Real-time chat with SignalR
- ✅ Teams and channels
- ✅ Calendar events
- ✅ Message reactions
- ✅ File uploads (planned)
- ✅ Search functionality (planned)
- ✅ Dark mode (planned)

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Chats
- `GET /api/chats` - Get user's chats
- `GET /api/messages/{chatId}` - Get chat messages
- `POST /api/messages` - Send a message

### Teams
- `GET /api/teams` - Get user's teams

### Calendar
- `GET /api/calendar/events` - Get calendar events
- `POST /api/calendar/events` - Create calendar event

### SignalR Hubs
- `/hubs/chat` - Real-time chat hub

## Development

### Database

The application uses SQLite for development. The database is automatically created on first run.

### Building for Production

**Frontend:**
```bash
cd frontend
npm run build
```

**Backend:**
```bash
cd Annonate.Api
dotnet publish -c Release
```

## License

MIT
