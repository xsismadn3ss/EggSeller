import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardFilters } from "@/components/dashboard-filters";
import {
  CategoriaChart,
  GrupoBars,
  SerieChart,
  TopProductosChart,
} from "@/components/dashboard-charts";
import { fmtInt, fmtUSD } from "@/lib/format";
import { getDashboardDataCached, parseFilters } from "@/lib/dashboard";

function delta(cur: number, prev: number): string {
  if (prev === 0) return "—";
  const pct = ((cur - prev) / prev) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function Kpi({
  title,
  value,
  sub,
  cur,
  prev,
}: {
  title: string;
  value: string;
  sub: string;
  cur: number;
  prev: number;
}) {
  const d = delta(cur, prev);
  const up = d.startsWith("+");
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={up ? "default" : "secondary"}>{d}</Badge>
        <span>{sub}</span>
      </CardContent>
    </Card>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const f = parseFilters(await searchParams);
  const data = await getDashboardDataCached(f);
  const { kpis: k, prev: p } = data;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard gerencial</h1>
        <p className="text-sm text-muted-foreground">
          {f.desde} → {f.hasta} · deltas vs periodo anterior equivalente
        </p>
      </div>

      <DashboardFilters />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi title="Ventas USD" value={fmtUSD(k.monto)} sub="vs anterior" cur={k.monto} prev={p.monto} />
        <Kpi title="Kg / unid" value={fmtInt(k.kg)} sub="vs anterior" cur={k.kg} prev={p.kg} />
        <Kpi title="Tickets" value={fmtInt(k.tickets)} sub="vs anterior" cur={k.tickets} prev={p.tickets} />
        <Kpi title="Ticket promedio" value={fmtUSD(k.ticketPromedio)} sub="vs anterior" cur={k.ticketPromedio} prev={p.ticketPromedio} />
        <Kpi title="Clientes activos" value={fmtInt(k.clientes)} sub="vs anterior" cur={k.clientes} prev={p.clientes} />
      </div>

      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="mercado">Mercado</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Ventas por mes</CardTitle>
              <CardDescription>
                Evolución mensual (datos 2025, único año registrado) y variación
                vs mes anterior
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SerieChart data={data.serie} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Δ vs mes anterior</TableHead>
                    <TableHead className="text-right">Tickets</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.serie.map((s, i) => {
                    const prev = i > 0 ? data.serie[i - 1].monto : null;
                    const pct =
                      prev && prev > 0
                        ? Math.round(((s.monto - prev) * 100) / prev)
                        : null;
                    return (
                      <TableRow key={s.mes}>
                        <TableCell className="font-medium">{s.mes}</TableCell>
                        <TableCell className="text-right">{fmtUSD(s.monto)}</TableCell>
                        <TableCell className="text-right">
                          {pct === null ? (
                            "—"
                          ) : (
                            <Badge variant={pct >= 0 ? "default" : "secondary"}>
                              {pct >= 0 ? "+" : ""}
                              {pct}%
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{s.tickets}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Señales de demanda</CardTitle>
              <CardDescription>
                Productos con caída vs periodo anterior equivalente. Sin datos
                de inventario no se detecta quiebre de stock real: son
                candidatos a revisar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.tendencias.filter(
                (t) => t.tendenciaPct !== null && t.tendenciaPct < -10,
              ).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin caídas significativas en el periodo.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Kg periodo</TableHead>
                      <TableHead className="text-right">Kg anterior</TableHead>
                      <TableHead className="text-right">Tendencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tendencias
                      .filter(
                        (t) => t.tendenciaPct !== null && t.tendenciaPct < -10,
                      )
                      .map((t) => (
                        <TableRow key={t.producto}>
                          <TableCell className="font-medium">{t.producto}</TableCell>
                          <TableCell className="text-right">{fmtInt(t.kg)}</TableCell>
                          <TableCell className="text-right">{fmtInt(t.kgPrev)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{t.tendenciaPct}%</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top productos</CardTitle>
                <CardDescription>Clic en una barra para filtrar</CardDescription>
              </CardHeader>
              <CardContent>
                <TopProductosChart data={data.topProductos} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Por categoría</CardTitle>
                <CardDescription>Clic en un segmento para filtrar</CardDescription>
              </CardHeader>
              <CardContent>
                <CategoriaChart data={data.porCategoria} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mercado" className="flex flex-col gap-4">
          {(() => {
            const totKg = data.porCanal.reduce((a, g) => a + g.kg, 0);
            const top = [...data.porCanal].sort((a, b) => b.kg - a.kg)[0];
            const share =
              top && totKg > 0 ? Math.round((top.kg * 100) / totKg) : 0;
            return (
              <p className="text-sm text-muted-foreground">
                {top
                  ? `Mayor volumen: ${top.nombre} con ${fmtInt(top.kg)} kg (${share}% del total).`
                  : "Sin datos por canal."}
              </p>
            );
          })()}
          <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Por canal de venta</CardTitle>
              <CardDescription>Retail · Horeca · Mayorista</CardDescription>
            </CardHeader>
            <CardContent>
              <GrupoBars data={data.porCanal} color="var(--chart-3)" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Por zona</CardTitle>
              <CardDescription>Dónde enfocar distribución</CardDescription>
            </CardHeader>
            <CardContent>
              <GrupoBars data={data.porZona} color="var(--chart-4)" />
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        <TabsContent value="clientes">
          <Card>
            <CardHeader>
              <CardTitle>Top clientes</CardTitle>
              <CardDescription>Preferencias por cliente</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Ventas USD</TableHead>
                    <TableHead className="text-right">Compras</TableHead>
                    <TableHead>Última compra</TableHead>
                    <TableHead>Producto favorito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topClientes.map((c) => (
                    <TableRow key={c.cliente}>
                      <TableCell className="font-medium">{c.cliente}</TableCell>
                      <TableCell className="text-right">{fmtUSD(c.monto)}</TableCell>
                      <TableCell className="text-right">{c.ventas}</TableCell>
                      <TableCell>{c.ultimaCompra}</TableCell>
                      <TableCell>{c.favorito}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
