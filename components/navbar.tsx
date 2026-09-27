"use client"

import Link from "next/link"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { ModeToggle } from "@/components/mode-toggle"

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/upload", label: "Subir datos" },
]

export function Navbar() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-2">
        <Link href="/" className="font-semibold">
          EggSeller
        </Link>
        <div className="flex items-center gap-1">
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
      </div>
    </header>
  )
}
