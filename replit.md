# Masarif - Personal Finance Tracker

## Overview

Masarif is a bilingual (Arabic-primary) personal finance tracking mobile application built with Expo/React Native. It allows users to manage multiple wallets with different currencies (EGP, KWD, USD), track income and expense transactions across categories, and view spending statistics with visual charts. The app uses a file-based routing system via Expo Router with tab navigation (Home, Transactions, Stats) and modal sheets for adding transactions and wallets. Data is currently stored locally using AsyncStorage.

The project includes an Express backend server, though the current app functionality is primarily client-side. The backend has scaffolding for PostgreSQL via Drizzle ORM with a basic users schema, suggesting future plans for server-side data persistence and authentication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo/React Native)

- **Framework**: Expo SDK 54 with React Native 0.81, React 19.1
- **Routing**: Expo Router v6 with file-based routing and typed routes enabled
  - Tab layout at `app/(tabs)/` with three tabs: Home (index), Transactions, Stats
  - Modal sheets for `add-transaction` and `add-wallet` screens using `presentation: "formSheet"`
- **State Management**: React Context (`TransactionContext`) for global transaction/wallet state, with `@tanstack/react-query` available for server data fetching
- **Styling**: React Native StyleSheet (no external styling library), with a centralized color palette in `constants/colors.ts`
- **Fonts**: Cairo Google Font (Arabic-optimized) in Regular, SemiBold, and Bold weights
- **UI Libraries**: react-native-gesture-handler, react-native-reanimated, react-native-svg (for charts), expo-blur, expo-linear-gradient, expo-haptics for tactile feedback
- **Local Storage**: AsyncStorage (`@react-native-async-storage/async-storage`) for persisting transactions, wallets, and user preferences
- **Platform Support**: iOS, Android, and Web (with platform-specific adaptations like KeyboardAwareScrollViewCompat)
- **Language/RTL**: The UI is primarily in Arabic. Category names have both English (`name`) and Arabic (`nameAr`) fields. Currency formatting uses `ar-EG` locale.

### Data Model (Client-side)

- **Wallet**: id, name, currency (EGP/KWD/USD), icon, color, createdAt
- **Transaction**: id, type (income/expense), amount, category, description, date, createdAt, walletId
- **Categories**: Predefined expense categories (food, transport, bills, shopping, health, education, entertainment, rent, phone, clothes, other) and income categories (salary, freelance, investment, gift, bonus, other) with icons and colors

### Backend (Express)

- **Framework**: Express 5 with TypeScript, compiled via `tsx` for dev and `esbuild` for production
- **API Pattern**: Routes registered in `server/routes.ts`, prefixed with `/api`
- **CORS**: Dynamic CORS configuration supporting Replit domains and localhost for development
- **Storage Layer**: Currently uses in-memory storage (`MemStorage` class in `server/storage.ts`) with a `Map`-based user store. This is a placeholder; the Drizzle schema exists but isn't connected to routes yet.
- **Static Serving**: In production, serves pre-built Expo web bundle from `dist/` directory; in development, proxies to Metro bundler

### Database (Drizzle + PostgreSQL)

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` — currently contains only a `users` table (id, username, password)
- **Schema Validation**: drizzle-zod for generating Zod schemas from Drizzle table definitions
- **Migration Config**: `drizzle.config.ts` outputs to `./migrations` directory
- **Push Command**: `npm run db:push` to sync schema to database
- **Note**: The database schema is minimal and not yet integrated with the app's transaction/wallet data model. The app currently stores all financial data in AsyncStorage on the client side.

### Build & Deployment

- **Development**: Two concurrent processes — `expo:dev` for Metro bundler and `server:dev` for Express
- **Production Build**: `expo:static:build` runs a custom build script (`scripts/build.js`) that starts Metro, fetches the bundle, and saves to `dist/`. Server is built with esbuild to `server_dist/`.
- **Production Run**: `server:prod` serves the static bundle and API from a single Express server

## External Dependencies

- **PostgreSQL**: Required via `DATABASE_URL` environment variable for Drizzle ORM (schema exists but not yet fully utilized by the app)
- **AsyncStorage**: Primary data persistence mechanism for the mobile app (local to device)
- **Expo Services**: Standard Expo build/development infrastructure
- **No external APIs**: The app currently has no third-party API integrations (no payment processing, no cloud sync, no analytics services)
- **Key npm packages**: expo, express, drizzle-orm, pg, @tanstack/react-query, react-native-reanimated, react-native-svg, expo-haptics, expo-crypto