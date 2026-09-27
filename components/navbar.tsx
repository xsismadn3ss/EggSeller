"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
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
]

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="border-b">
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
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
