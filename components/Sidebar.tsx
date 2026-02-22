
import React from 'react';
import { LayoutDashboard, Users, Settings, LogOut, ShoppingBag, ListOrdered, Wallet, BarChart3, Database, UploadCloud, CalendarDays, UserCheck } from 'lucide-react';
import { View } from '../types';

interface SidebarProps {
  currentView: View;
  setView: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'agenda', label: 'Agenda de Retorno', icon: CalendarDays },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'sellers', label: 'Vendedores', icon: UserCheck },
    { id: 'new_sale', label: 'Nova Venda', icon: ShoppingBag },
    { id: 'sales_list', label: 'Pedidos Realizados', icon: ListOrdered },
    { id: 'financeiro', label: 'Financeiro', icon: Wallet },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    { id: 'system', label: 'Sistema & Backup', icon: Database },
    { id: 'restore', label: 'Restaurar Dados', icon: UploadCloud },
  ];

  return (
    <div className="w-64 bg-slate-900 h-screen fixed left-0 top-0 flex flex-col text-white transition-all z-[150] shadow-2xl">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      
      <div className="p-5 border-b border-slate-800/50 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <span className="font-black text-lg text-white">C</span>
        </div>
        <h1 className="text-lg font-bold tracking-tight uppercase text-slate-100">Sistema Célia</h1>
      </div>
      
      <nav className="flex-1 mt-4 px-3 overflow-y-auto no-scrollbar">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setView(item.id as View)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  currentView === item.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                }`}
              >
                <item.icon size={18} strokeWidth={2} />
                <span className="font-bold text-[11px] uppercase tracking-wider">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-3 border-t border-slate-800/50 shrink-0 bg-slate-900/50 backdrop-blur-sm">
        <button 
          onClick={() => setView('system')}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-xl transition-all mb-1"
        >
          <Settings size={18} />
          <span className="font-bold text-[11px] uppercase tracking-wider">Ajustes</span>
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all">
          <LogOut size={18} />
          <span className="font-bold text-[11px] uppercase tracking-wider">Sair</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
