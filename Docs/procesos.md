# Procesos

**Subir datos con CSV:**
- En la web se sube el archivo CSV
- La web envía el archivo CSV a la API
- La API carga los datos en la base de datos basada en grafos

```mermaid
sequenceDiagram
    actor Usuario
    participant Web
    participant API
    participant Neo4j
    Usuario->>Web: Sube archivo CSV
    Web->>API: POST /api/upload-csv (file)
    API->>Neo4j: CREATE (:Venta) + MERGE catálogos
    Neo4j-->>API: OK
    API-->>Web: 201 resumen carga
    Web-->>Usuario: Confirma carga
```

**Subir datos con Excel:**

- En la web se sube el archivo Excel en un formulario
- La web envía el archivo Excel a la API
- La API carga los datos en la base de datos basada en grafos

```mermaid
sequenceDiagram
    actor Usuario
    participant Web
    participant API
    participant Neo4j
    Usuario->>Web: Sube archivo Excel
    Web->>API: POST /api/upload-excel (file)
    API->>Neo4j: CREATE (:Venta) + MERGE catálogos
    Neo4j-->>API: OK
    API-->>Web: 201 resumen carga
    Web-->>Usuario: Confirma carga
```

**Guardar ventas nuevas:**

- En un sistema externo se registra una venta y envia un POST a la API
- La API guarda la venta en la base de datos basada en grafos

> Este proceso es útil para conectar la solución con otros sistemas y constantemente actualizar los datos. Esto permite que el LLM pueda responder mejor en los chats o que los dashboard contengan más información útil.

```mermaid
sequenceDiagram
    participant Ext as Sistema externo
    participant API
    participant Neo4j
    Ext->>API: POST /api/compras (JSON)
    API->>Neo4j: CREATE (:Venta)-[:INCLUYE_PRODUCTO]->(:Producto)
    Neo4j-->>API: OK
    API-->>Ext: 201 ventaId
```

**Ver dashboard:**

- En la web hay una página para ver un dashboard general sobre las ventas
- La web lee los datos que hay en la base de datos basada en grafos
- El usuario puede navegar o aplicar filtros para hacer busquedas concretas basado en fechas u otro tipo de datos

```mermaid
sequenceDiagram
    actor Usuario
    participant Web
    participant Neo4j
    Usuario->>Web: Abre dashboard
    Web->>Neo4j: MATCH agregaciones (Cypher)
    Neo4j-->>Web: Resultados
    Web-->>Usuario: Render dashboard
    loop Filtros (fecha, cliente, producto, canal)
        Usuario->>Web: Aplica filtro
        Web->>Neo4j: Cypher con filtros
        Neo4j-->>Web: Resultados filtrados
        Web-->>Usuario: Actualiza dashboard
    end
```

**Generar sugerencias de pedidos:**

- En la web hay una página para generar sugerencias de pedidos
- La web pide al cliente LLM que consulte datos de la base de datos usando el MCP
- El cliente LLM sugiere pedidos segun los habitos y comportamientos de los clientes basados en las ventas registradas
- La web presenta un dashboard al usuario y un reporte de los pedidos sugeridos

```mermaid
sequenceDiagram
    actor Usuario
    participant Web
    participant LLM as Cliente LLM
    participant MCP
    participant Neo4j
    Usuario->>Web: Pide sugerencia de pedidos
    Web->>LLM: Solicita sugerencia
    LLM->>MCP: tool: consulta ventas / preferencias
    MCP->>Neo4j: Cypher agregaciones
    Neo4j-->>MCP: Datos
    MCP-->>LLM: Resultado tools
    LLM-->>Web: Sugerencia + reporte
    Web-->>Usuario: Dashboard + reporte
```

**Chat interactivo con IA:**

- En la web hay una página para iniciar un chat con inteligencia artificial
- El usuario puede chatear para consultar datos guardados en la base de datos basado en grafos para generar reportes o búsquedas concretas
- El cliente LLM usa el MCP para consultar la base de datos
- Es necesario tener historial de chats en la web para poder acceder nuevamente a las conversaciones

```mermaid
sequenceDiagram
    actor Usuario
    participant Web
    participant LLM as Cliente LLM
    participant MCP
    participant Neo4j
    Usuario->>Web: Abre chat / envía mensaje
    Web->>Web: Carga historial
    Web->>LLM: Mensaje + historial
    LLM->>MCP: tool: consulta Neo4j según intención
    MCP->>Neo4j: Cypher
    Neo4j-->>MCP: Datos
    MCP-->>LLM: Resultado tools
    LLM-->>Web: Respuesta / reporte
    Web->>Web: Guarda en historial
    Web-->>Usuario: Muestra respuesta
```
