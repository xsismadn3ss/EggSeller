# Arquitectura

El proyecto tendrá lo siguiente
:

- Base de datos basada en grafos: Neo4j para persistir datos de preferencias de compra de los clientes
- API: para proveer una forma en al cual cargar datos por medio de excel, csv o por medio de POST al registrar una compra en el sistema al que se hará la integración.
- MCP: para proveer herramientas de consulta para la base de datos y que un LLM pueda hacer lecturas en la base de datos para generar reportes o recomendaciones segun los datos registrados sobre las preferencias de lo usuarios.
- Cliente LLM: recomendaciones y reportes utilizando IA
- Web: Mostrar dhasboards sobre los datos guardados

Tecnologías a utilizar:

- Next.js: framework fullstack para desarrollar frontend y backend
- Neo4j: base de datos de grafos (Cypher). Conexión desde Next.js con `neo4j-driver` oficial para TypeScript.
- OpenCode: cliente LLM con modelos gratuitos
## Diagrama Mermaid:

```mermaid
flowchart LR
    API["API Next.js<br/>Carga Excel / CSV / POST"] -- escribe Cypher via neo4j-driver --> DB[("Neo4j<br/>Grafos")]
    MCP["MCP<br/>Herramientas de consulta"] -- consulta Cypher --> DB
    LLM["Cliente LLM"] -- usa herramientas --> MCP
    WEB["Web Next.js<br/>Dashboard"] -- lee via API / driver --> DB
```