# Programa de gestion

Monorepo TypeScript con:
- `apps/api` (NestJS + Prisma + Postgres)
- `apps/web` (Next.js)

## Requisitos
- Node.js 18+
- Docker Desktop

## Arranque rapido
```bash
cd "c:\Programa de gestion"
npm install
docker compose up -d
```

En otra terminal:
```bash
npm run dev:api
```

En otra terminal:
```bash
npm run dev:web
```

Web: http://localhost:3000  
API: http://localhost:3001

## Variables de entorno
### API (`apps/api/.env`)
Copiar desde `apps/api/.env.example`.
```
DATABASE_URL=postgresql://pdg:pdg@localhost:5432/pdg
WOO_BASE_URL=
WOO_CONSUMER_KEY=
WOO_CONSUMER_SECRET=
```

### Web (`apps/web/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Prisma
```bash
cd "c:\Programa de gestion\apps\api"
npm run migrate:dev -- --name init
npm run seed
```

## Endpoints clave (API)
- GET `/health`
- GET `/settings/woo`
- PUT `/settings/woo`
- POST `/woo/import` (modo mock si no hay credenciales)
- GET `/products`
- POST `/products` (standard)
- POST `/products/quick`
- POST `/products/:sku/convert-to-standard`
- GET `/locations`
- POST `/locations`
- POST `/moves/purchase|transfer|b2b-sale|adjust`
- GET `/stock?locationId=1`
- POST `/web-orders/:wooOrderId/assign-warehouse`
- POST `/web-orders/:wooOrderId/process`
- GET `/export`
- POST `/import?mode=merge|restore` (form-data: file)

## Export/Import (script)
```bash
powershell -ExecutionPolicy Bypass -File "c:\Programa de gestion\apps\api\scripts\export-import-test.ps1"
```

## CSV (web)
Productos:
```
sku,name,photoUrl,cost,rrp,active
SKU-100,Producto CSV,,2.5,4.9,true
```

Stock:
```
locationId,sku,quantity,unitCost
1,SKU-100,10,2.5
```
