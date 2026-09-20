"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard, Phone, Users, ShoppingCart,
  FileText, UserCog, BarChart3, LogOut, ChevronDown, ChevronRight,
} from "lucide-react";

type LinkItem = { href: string; label: string; icon: any };
type GroupItem = { label: string; icon: any; children: { href: string; label: string }[] };
const links: (LinkItem | GroupItem)[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agenda", label: "Fichário de Ligações", icon: Phone },
  {
    label: "Clientes",
    icon: Users,
    children: [
      { href: "/clientes", label: "Cadastro de Cliente" },
      { href: "/clientes/consultar", label: "Consultar Clientes" },
    ],
  },
  {
    label: "Pedidos",
    icon: ShoppingCart,
    children: [
      { href: "/pedidos", label: "Pedidos" },
      { href: "/pedidos/devolucoes", label: "Devoluções" },
    ],
  },
  { href: "/rascunho", label: "Rascunho", icon: FileText },
  { href: "/vendedores", label: "Vendedores", icon: UserCog },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

function isGroup(item: LinkItem | GroupItem): item is GroupItem {
  return (item as GroupItem).children !== undefined;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState<string | null>(
    pathname.startsWith("/pedidos") ? "Pedidos" : pathname.startsWith("/clientes") ? "Clientes" : null
  );

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }
  return (
    <aside className="w-60 bg-white border-r border-gray-100 h-screen sticky top-0 flex flex-col">
      <div className="px-5 py-5 border-b border-gray-100">
        <h1 className="text-lg font-bold text-brand-700">Sistema Vendas</h1>
        <p className="text-xs text-gray-400">Gestão comercial</p>
      </div>
      <nav className="flex-1 py-3">
        {links.map((item) => {
          if (isGroup(item)) {
            const Icon = item.icon;
            const grupoAtivo = item.children.some((c) => pathname === c.href);
            const expandido = aberto === item.label;
            return (
              <div key={item.label}>
                <button
                  onClick={() => setAberto(expandido ? null : item.label)}
                  className={`w-full flex items-center justify-between gap-3 px-5 py-2.5 text-sm font-medium transition ${
                    grupoAtivo ? "text-brand-700" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={18} />
                    {item.label}
                  </span>
                  {expandido ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {expandido && (
                  <div className="pb-1">
                    {item.children.map((c) => {
                      const active = pathname === c.href;
                      return (
                        <button
                          key={c.href}
                          type="button"
                          onClick={() => router.push(c.href)}
                          className={`w-full text-left flex items-center gap-3 pl-12 pr-5 py-2 text-sm font-medium transition ${
                            active
                              ? "bg-brand-50 text-brand-700 border-r-2 border-brand-600"
                              : "text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const { href, label, icon: Icon } = item;
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-brand-50 text-brand-700 border-r-2 border-brand-600"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
      <button onClick={sair} className="flex items-center gap-3 px-5 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50 border-t border-gray-100">
        <LogOut size={18} /> Sair
      </button>
    </aside>
  );
}
