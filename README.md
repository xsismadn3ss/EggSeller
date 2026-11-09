# EggSeller

Solución de pedidos sugeridos utilizando inteligencia artificial.

## Desarrollo

```bash
cp .env.example .env   # ajusta NEO4J_PASSWORD, JWT_SECRET y ADMIN_PASSWORD
docker compose up -d   # Neo4j en :7474 (HTTP) y :7687 (Bolt), Mongo en :27017
npm install
npm run seed:admin      # crea/actualiza el usuario admin en Mongo
npm run dev            # app en http://localhost:3000
```

## Autenticación

Sesión con JWT (HS256, expiración 12h) en cookie httpOnly
`eggseller_token` (no accesible desde JS). Credenciales: usuario +
contraseña, sin email. No hay registro público: el único usuario se crea
con la semilla.

```bash
npm run seed:admin  # usa ADMIN_USERNAME/ADMIN_PASSWORD de .env (mín. 8 chars)
```

Rutas protegidas: `/`, `/upload`, `/chat`, `/sugerencias` (redirigen a
`/login?next=...` sin sesión) y todo `/api/*` salvo `/api/auth/*` y
`/api/health` (responden 401 JSON). Flujo: `POST /api/auth/login` →
cookie → `GET /api/auth/me` → `POST /api/auth/logout`.

## API

- `POST /api/compras` — JSON de una venta (`fuente: api`).
- `POST /api/upload-csv` — multipart `file` .csv (máx 5MB, 5000 filas).
- `POST /api/upload-excel` — multipart `file` .xls/.xlsx.
- `GET /api/health` — ping a Neo4j.

Página: `/upload` (formulario CSV/Excel con shadcn/ui).

## Componentes UI

```bash
npx shadcn@latest add button
```

Ver `Docs/` para arquitectura, esquemas de datos, procesos e historias de usuario.
