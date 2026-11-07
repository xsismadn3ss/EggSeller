"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, Menu } from "lucide-react"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ModeToggle } from "@/components/mode-toggle"

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/upload", label: "Subir datos" },
  { href: "/chat", label: "Chat IA" },
  { href: "/sugerencias", label: "Sugerencias" },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  // Relee la sesión al montar y en cada cambio de ruta (p. ej. tras login,
  // el Navbar no se remonta y el estado quedaría desactualizado).
  useEffect(() => {
    let activo = true
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (activo) {
          setUsername(
            data && typeof data.username === "string" ? data.username : null
          )
        }
      })
      .catch(() => {
        if (activo) setUsername(null)
      })
    return () => {
      activo = false
    }
  }, [pathname])

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null)
    setUsername(null)
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-2">
        <Link href="/" className="font-semibold">
          EggSeller
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          <NavigationMenu>
            <NavigationMenuList>
              {LINKS.map((l) => (
                <NavigationMenuItem key={l.href}>
                  <NavigationMenuLink
                    render={<Link href={l.href} />}
                    className={navigationMenuTriggerStyle()}
                  >
                    {l.label}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
          <ModeToggle />
          {username ? (
            <>
              <span className="px-2 text-sm text-muted-foreground">
                {username}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                onClick={handleLogout}
              >
                <LogOut className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <ModeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Abrir menú">
                  <Menu className="size-5" />
                </Button>
              }
            />
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>EggSeller</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2 text-base font-medium hover:bg-muted"
                  >
                    {l.label}
                  </Link>
                ))}
                {username ? (
                  <>
                    <span className="px-3 py-2 text-sm text-muted-foreground">
                      {username}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        void handleLogout()
                      }}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-base font-medium hover:bg-muted"
                    >
                      <LogOut className="size-4" />
                      Salir
                    </button>
                  </>
                ) : null}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
