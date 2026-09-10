# Environment

Du an co 2 moi truong: `development` va `production`.

## FE

File that khong commit:

- `FE/.env.development`
- `FE/.env.production`

Development:

```bash
VITE_API_URL="/api/v1"
VITE_PROXY_TARGET="http://localhost:3000"
VITE_DEV_PORT=5173
```

Production:

```bash
# Neu FE va BE dung chung domain/reverse proxy.
VITE_API_URL="/api/v1"

# Neu BE dung domain rieng, dung URL day du.
# VITE_API_URL="https://api.example.com/api/v1"

# Chi dung khi chay npm run dev:prod.
VITE_PROXY_TARGET="https://api.example.com"
VITE_DEV_PORT=5173
```

Lenh:

```bash
cd FE
npm run dev
npm run build:prod
```

## BE

File that khong commit:

- `BE/.env.development`
- `BE/.env.production`
- `BE/.env`

Development:

```bash
NODE_ENV="development"
DATABASE_URL="postgresql://user:password@host.neon.tech/docs_dev?sslmode=require"
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
JWT_ACCESS_SECRET="change-this-dev-access-secret"
JWT_REFRESH_SECRET="change-this-dev-refresh-secret"
ADMIN_EMAIL="admin@docs.vn"
ADMIN_PASSWORD="Admin@123456"
ADMIN_NAME="System Admin"
PORT=3000
CORS_ORIGIN="http://localhost:5173"
AUTH_PROVIDER="external"
EXTERNAL_AUTH_BASE_URL="https://dev.vwork.vfast.dev"
EXTERNAL_AUTH_API_KEY=""
```

Production:

```bash
NODE_ENV="production"
DATABASE_URL="postgresql://user:password@host.neon.tech/docs_prod?sslmode=require"
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
JWT_ACCESS_SECRET="replace-with-strong-production-access-secret"
JWT_REFRESH_SECRET="replace-with-strong-production-refresh-secret"
ADMIN_EMAIL="admin@docs.vn"
ADMIN_PASSWORD="replace-with-strong-production-password"
ADMIN_NAME="System Admin"
PORT=3000
CORS_ORIGIN="https://app.example.com"
AUTH_PROVIDER="external"
EXTERNAL_AUTH_BASE_URL="https://vfacein.vfastsoft.com"
EXTERNAL_AUTH_API_KEY=""
```

Lenh:

```bash
cd BE
npm run start:dev
npm run build
npm run start:prod
```

BE load env theo thu tu:

- `NODE_ENV=development`: `.env.development`, fallback `.env`
- `NODE_ENV=production`: `.env.production`, fallback `.env`
