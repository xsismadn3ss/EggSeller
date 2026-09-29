"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FiltrosData } from "@/lib/dashboard";

const PRESETS: { label: string; desde: string; hasta: string }[] = [
  { label: "Todo 2025", desde: "2025-01-01", hasta: "2025-12-31" },
  { label: "Q1", desde: "2025-01-01", hasta: "2025-03-31" },
  { label: "Q2", desde: "2025-04-01", hasta: "2025-06-30" },
  { label: "Q3", desde: "2025-07-01", hasta: "2025-09-30" },
  { label: "Q4", desde: "2025-10-01", hasta: "2025-12-31" },
  { label: "Últimos 30 días", desde: "2025-12-02", hasta: "2025-12-31" },
  { label: "Últimos 90 días", desde: "2025-10-03", hasta: "2025-12-31" },
];

function FilterSelect({
  label,
  param,
  options,
  current,
  onChange,
}: {
  label: string;
  param: string;
  options: string[];
  current: string | null;
  onChange: (param: string, value: string | null) => void;
}) {
  return (
    <div className="flex min-w-36 flex-col gap-1">
      <Label>{label}</Label>
      <Select
        value={current ?? "all"}
        onValueChange={(v) => onChange(param, v === "all" ? null : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function DashboardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [opts, setOpts] = useState<FiltrosData | null>(null);

  useEffect(() => {
    fetch("/api/filtros")
      .then((r) => r.json())
      .then(setOpts)
      .catch(() => {});
  }, []);

  const setParam = (key: string, value: string | null) => {
    const qs = new URLSearchParams(searchParams.toString());
    if (value) qs.set(key, value);
    else qs.delete(key);
    router.replace(`${pathname}?${qs.toString()}`);
  };

  const setRange = (desde: string, hasta: string) => {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("desde", desde);
    qs.set("hasta", hasta);
    router.replace(`${pathname}?${qs.toString()}`);
  };

  const clear = () => router.replace(pathname);
  const get = (k: string) => searchParams.get(k);
  const hasFilters = searchParams.toString().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const active =
            get("desde") === p.desde && get("hasta") === p.hasta;
          return (
            <Button
              key={p.label}
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => setRange(p.desde, p.hasta)}
            >
              {p.label}
            </Button>
          );
        })}
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clear}>
            Limpiar
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label>Desde</Label>
          <Input
            type="date"
            value={get("desde") ?? "2025-01-01"}
            onChange={(e) => setParam("desde", e.target.value || null)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Hasta</Label>
          <Input
            type="date"
            value={get("hasta") ?? "2025-12-31"}
            onChange={(e) => setParam("hasta", e.target.value || null)}
          />
        </div>
        {opts && (
          <>
            <FilterSelect label="Cliente" param="cliente" options={opts.clientes} current={get("cliente")} onChange={setParam} />
            <FilterSelect label="Categoría" param="categoria" options={opts.categorias} current={get("categoria")} onChange={setParam} />
            <FilterSelect label="Producto" param="producto" options={opts.productos} current={get("producto")} onChange={setParam} />
            <FilterSelect label="Zona" param="zona" options={opts.zonas} current={get("zona")} onChange={setParam} />
            <FilterSelect label="Canal venta" param="canalVenta" options={opts.canalesVenta} current={get("canalVenta")} onChange={setParam} />
            <FilterSelect label="Canal dist." param="canalDist" options={opts.canalesDist} current={get("canalDist")} onChange={setParam} />
            {opts.puntos.length > 0 && (
              <FilterSelect label="Punto" param="punto" options={opts.puntos} current={get("punto")} onChange={setParam} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
