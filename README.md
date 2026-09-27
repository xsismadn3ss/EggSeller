# EggSeller

Solución de pedidos sugeridos utilizando inteligencia artificial.

## Desarrollo

```bash
cp .env.example .env   # ajusta NEO4J_PASSWORD
docker compose up -d   # Neo4j en :7474 (HTTP) y :7687 (Bolt)
npm install
npm run dev            # app en http://localhost:3000
```

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
