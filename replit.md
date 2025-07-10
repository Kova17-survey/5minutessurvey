# 5 Minute Survey Platform

## Overview

This is a secure, production-ready survey platform that allows users to complete quick surveys and earn cryptocurrency rewards (gems). The platform features Google OAuth authentication, comprehensive fraud prevention, admin controls, and Litecoin withdrawal functionality. Built with React frontend and Express.js backend using PostgreSQL for data persistence.

**Status**: ✅ Successfully implemented and deployed (January 2025)

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**January 9, 2025**:
✓ Complete platform implementation with all security features
✓ Google OAuth authentication system integrated
✓ Database schema created with all required tables
✓ Admin panel with user management and withdrawal approval
✓ Three sample surveys added for testing
✓ Comprehensive fraud prevention and security logging
✓ Modern UI design using provided 5 Minute Survey logo
✓ Application successfully deployed and running on port 5000
✓ **NEW**: Integrated 5 major offerwalls (CPX Research, BitLabs, TheoremReach, AdGem, Lootably)
✓ **NEW**: Added animated horizontal scrolling sections for games/videos and surveys
✓ **NEW**: Implemented offerwall completion tracking and automatic gem rewards
✓ **NEW**: Enhanced conversion rate system (1000 gems = $1 USD)
✓ **NEW**: Complete offerwall iframe integration with demo functionality

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite for development and bundling

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Passport.js with Google OAuth 2.0 strategy
- **Session Management**: Express sessions with PostgreSQL store

### Database Design
- **Primary Database**: PostgreSQL (via Neon Database)
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Connection**: Neon serverless driver with WebSocket support

## Key Components

### Authentication System
- Google OAuth 2.0 integration using Passport.js
- Session-based authentication with PostgreSQL session store
- User roles (regular users and admins)
- Account status management (active, banned, suspended)
- User verification system

### Survey Management
- Survey creation and management
- Question types and response collection
- Survey completion tracking
- Gem reward calculation and distribution

### Rewards System
- Gem-based virtual currency
- Transaction tracking for all gem movements
- Withdrawal request system
- Admin approval workflow for withdrawals

### User Management
- User profile management
- Balance tracking
- Transaction history
- Account verification

### Admin Panel
- User management and moderation
- Withdrawal request processing
- System statistics and monitoring
- User status management (ban/suspend functionality)

## Data Flow

1. **User Authentication**: Users sign in via Google OAuth, creating or updating user records
2. **Survey Participation**: Users browse available surveys, complete them, and earn gems
3. **Gem Management**: All gem transactions are tracked in the transactions table
4. **Withdrawal Process**: Users request withdrawals, which require admin approval
5. **Admin Operations**: Admins can manage users, approve withdrawals, and monitor system activity

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Neon Database PostgreSQL driver
- **passport-google-oauth20**: Google OAuth authentication
- **drizzle-orm**: Type-safe ORM for database operations
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Accessible UI component primitives
- **tailwindcss**: Utility-first CSS framework

### Development Tools
- **drizzle-kit**: Database schema management and migrations
- **vite**: Frontend build tool and development server
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Fast JavaScript bundler for production builds

## Deployment Strategy

### Development Environment
- Frontend served by Vite development server with HMR
- Backend runs with `tsx` for TypeScript execution
- Database migrations managed through Drizzle Kit
- Environment variables for configuration

### Production Build
- Frontend built with Vite and served as static files
- Backend bundled with esbuild for optimized Node.js execution
- Database schema pushed via Drizzle Kit
- Session storage and file uploads handled by server

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string (required)
- **GOOGLE_CLIENT_ID**: Google OAuth client ID (required)
- **GOOGLE_CLIENT_SECRET**: Google OAuth client secret (required)
- **SESSION_SECRET**: Session encryption secret (optional, has fallback)
- **NODE_ENV**: Environment mode (development/production)

The application follows a monorepo structure with clear separation between client, server, and shared code, making it maintainable and scalable for a survey platform with cryptocurrency rewards.