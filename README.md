# Tyre Inventory

A mobile app (iOS + Android) for managing tyre shop inventory. Admin logs in
and has full create/edit/update/delete access over the tyre catalog.

- `backend/` — Node.js + Express + TypeScript API, PostgreSQL via Prisma
- `mobile/` — React Native (Expo) app

## Backend setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

npx prisma migrate dev   # creates the database schema
npm run seed              # creates the initial admin user from .env

npm run dev                # starts the API on http://localhost:4000
```

## Mobile setup

```bash
cd mobile
npm install

# Point the app at your backend:
#   - iOS simulator: http://localhost:4000 works as-is
#   - Android emulator: change API_BASE_URL in src/api/client.ts to http://10.0.2.2:4000
#   - Physical device via Expo Go: use your machine's LAN IP, e.g. http://192.168.1.x:4000

npm start
```

Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR
code with Expo Go on a physical device.

## Roles

Only an `ADMIN` role exists today. There is no public sign-up endpoint — the
seed script is the only way to create an account, which keeps account
creation off the API's attack surface. The backend's `requireAdmin`
middleware is structured so additional, lower-privilege roles can be added
later without changing the auth flow.

## Troubleshooting

### Mobile App Bundling Issues

This project targets **Expo SDK 57**. Don't hand-pin package versions from
older SDKs (e.g. SDK 50's `react-native@0.73.6`, `expo-secure-store@~12.8.1`)
— mixing SDK generations is a common cause of the app hanging on a loading
screen or Metro throwing `Unable to resolve` errors, because the native
module versions no longer match the Expo runtime.

If you hit bundling errors or an endless loading screen, first check you're
not on a mismatched set of versions, then let Expo's own tooling fix it:

```bash
cd mobile
npx expo install --check   # detects and offers to fix SDK-incompatible versions
npx expo-doctor             # should report 21/21 (or current total) checks passing
```

If that doesn't resolve it, do a clean reinstall rather than downgrading:

```bash
cd mobile
rm -rf node_modules package-lock.json
npm install
npx expo-doctor
```

### Web Testing

If you cannot connect via Expo Go due to network issues, test the app in your browser:

```bash
cd mobile
npm start
# Then open http://localhost:8081 in your browser
```

The web version works perfectly and can be used to test all app features before deploying to physical devices.
