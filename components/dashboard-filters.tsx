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

const fmtLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Mismo cálculo que el servidor: hasta = hoy, desde = hoy menos un año. */
function defaultRange(): { desde: string; hasta: string } {
  const hasta = new Date();
  const desde = new Date(hasta);
  desde.setFullYear(desde.getFullYear() - 1);
  return { desde: fmtLocal(desde), hasta: fmtLocal(hasta) };
}

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

  const clear = () => router.replace(pathname);
  const get = (k: string) => searchParams.get(k);
  const hasFilters = searchParams.toString().length > 0;
  const def = defaultRange();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label>Desde</Label>
          <Input
            type="date"
            value={get("desde") ?? def.desde}
            onChange={(e) => setParam("desde", e.target.value || null)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Hasta</Label>
          <Input
            type="date"
            value={get("hasta") ?? def.hasta}
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
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clear}>
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}
