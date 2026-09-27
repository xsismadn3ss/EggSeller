"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { Grupo, SeriePunto, TopProducto } from "@/lib/dashboard";
import { fmtCompact, fmtUSD } from "@/lib/format";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function useDrill(param: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (value: string) => {
    const qs = new URLSearchParams(searchParams.toString());
    if (qs.get(param) === value) qs.delete(param);
    else qs.set(param, value);
    router.replace(`${pathname}?${qs.toString()}`);
  };
}

export function SerieChart({ data }: { data: SeriePunto[] }) {
  const config = { monto: { label: "Ventas USD", color: "var(--chart-1)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-64 w-full">
      <AreaChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis tickFormatter={fmtCompact} tickLine={false} axisLine={false} width={50} />
        <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtUSD(Number(v))} />} />
        <Area dataKey="monto" fill="var(--color-monto)" stroke="var(--color-monto)" radius={4} />
      </AreaChart>
    </ChartContainer>
  );
}

export function TopProductosChart({ data }: { data: TopProducto[] }) {
  const drill = useDrill("producto");
  const config = { monto: { label: "Ventas USD", color: "var(--chart-2)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-72 w-full">
      <BarChart data={data} layout="vertical">
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickFormatter={fmtCompact} hide />
        <YAxis dataKey="producto" type="category" tickLine={false} axisLine={false} width={130} />
        <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtUSD(Number(v))} />} />
        <Bar
          dataKey="monto"
          fill="var(--color-monto)"
          radius={4}
          onClick={(d) => {
            const p = (d as { payload?: TopProducto })?.payload?.producto;
            if (p) drill(p);
          }}
        />
      </BarChart>
    </ChartContainer>
  );
}

export function CategoriaChart({ data }: { data: Grupo[] }) {
  const drill = useDrill("categoria");
  const config = Object.fromEntries(
    data.map((g, i) => [g.nombre, { label: g.nombre, color: COLORS[i % COLORS.length] }]),
  ) satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-72 w-full">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) =>
                `${(item as { payload?: { nombre?: string } })?.payload?.nombre ?? name}: ${fmtUSD(Number(value))}`
              }
            />
          }
        />
        <Pie
          data={data}
          dataKey="monto"
          nameKey="nombre"
          innerRadius={55}
          onClick={(d) => {
            const n = (d as { nombre?: string })?.nombre;
            if (n) drill(n);
          }}
        >
          {data.map((g, i) => (
            <Cell key={g.nombre} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

export function GrupoBars({ data, color }: { data: Grupo[]; color: string }) {
  const config = { monto: { label: "Ventas USD", color } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="nombre" tickLine={false} axisLine={false} tickMargin={8} interval={0} angle={-15} height={55} />
        <YAxis tickFormatter={fmtCompact} tickLine={false} axisLine={false} width={50} />
        <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtUSD(Number(v))} />} />
        <Bar dataKey="monto" fill="var(--color-monto)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
