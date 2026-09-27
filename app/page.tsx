import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Page() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>EggSeller</CardTitle>
          <CardDescription>
            Sugerencias de pedidos con IA sobre Neo4j.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Link href="/subir" className={buttonVariants()}>
            Subir CSV / Excel
          </Link>
          <p className="text-xs text-muted-foreground">
            API: POST /api/compras · POST /api/upload-csv · POST
            /api/upload-excel · GET /api/health
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
