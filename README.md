# BA Document Control

Web app quan ly tai lieu theo du an cho BA.

## Folder

- `FE`: Vite React UI cho dashboard, library, import panel, HTML viewer va comments theo block.
- `BE`: NestJS API theo feature modules, Prisma schema cho Neon, import `.md/.docx/.pdf`, Cloudinary media va export Word/PDF.

## Chay FE

```bash
cd FE
npm install
npm run dev
```

Mac dinh FE chay o `http://localhost:5173`.

## Chay BE

```bash
cd BE
cp .env.example .env
npm install
npx prisma generate
npm run prisma:migrate
npm run start:dev
```

Can dien `.env`:

```bash
DATABASE_URL="postgresql://user:password@host.neon.tech/docs?sslmode=require"
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
PORT=3000
```

Swagger: `http://localhost:3000/api/docs`

## API Chinh

- `GET /api/v1/projects`
- `POST /api/v1/projects`
- `GET /api/v1/documents/project/:projectId`
- `POST /api/v1/documents`
- `POST /api/v1/imports/documents`
- `POST /api/v1/media/upload`
- `GET /api/v1/exports/documents/:id/pdf`
- `GET /api/v1/exports/documents/:id/docx`

## Verification

Da chay:

```bash
cd FE && npm run build
cd BE && npx prisma generate && npm run build
```
# Docs-managements-web
