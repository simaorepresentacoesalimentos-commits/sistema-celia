import React, { useState } from 'react';
import { 
  Database, Download, ShieldCheck, HardDrive, 
  Clock, AlertCircle, CheckCircle2, Loader2, 
  Info, RefreshCw, FileText, Smartphone, Laptop,
  Users, DollarSign, ArrowRightLeft, UserCheck, CalendarDays
} from 'lucide-react';
import { backupService } from '../services/backupService';

const SystemSettings: React.FC = () => {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(() => localStorage.getItem('nexus_last_backup'));

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      await backupService.runFullBackup();
      const now = new Date().toLocaleString('pt-BR');
      setLastBackup(now);
      localStorage.setItem('nexus_last_backup', now);
    } catch (error) {
      alert("Erro ao gerar backup. Verifique sua conexão.");
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
        <div className="w-16 h-16 bg-slate-900 text-white rounded-3xl flex items-center justify-center shadow-2xl">
          <Database size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Sistema & Segurança</h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Gestão de Dados e Backups Externos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* BLOCO DE BACKUP */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><HardDrive size={24} /></div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Backup do Sistema</h3>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed mb-6 font-medium">
              Gere arquivos de segurança para salvar em dispositivos externos. 
              O backup agora inclui a <span className="text-slate-900 font-bold">Agenda de Retorno</span> e a lista de <span className="text-slate-900 font-bold">Vendedores</span>.
            </p>
            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <CheckCircle2 size={14} className="text-emerald-500" /> Formato: Excel / CSV (separado por tipo)
              </div>
              <div className="flex items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <CheckCircle2 size={14} className="text-emerald-500" /> Compatível com módulo de restauração
              </div>
              <div className="flex items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <CheckCircle2 size={14} className="text-emerald-500" /> UTF-8 BOM (Pronto para o Excel)
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <button 
              onClick={handleBackup}
              disabled={isBackingUp}
              className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-indigo-600 transition-all uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl disabled:opacity-50 group"
            >
              {isBackingUp ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} className="group-hover:translate-y-1 transition-transform" />}
              Gerar Backup Agora
            </button>
            {lastBackup && (
              <p className="text-center mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Último backup: {lastBackup}
              </p>
            )}
          </div>
        </div>

        {/* INFO DE SAÚDE DOS DADOS */}
        <div className="space-y-6">
          <div className="bg-emerald-50 p-8 rounded-[2rem] border border-emerald-100">
            <div className="flex items-center gap-4 mb-4 text-emerald-600">
              <ShieldCheck size={32} />
              <h4 className="font-black text-xs uppercase tracking-widest">Conexão Segura</h4>
            </div>
            <p className="text-sm font-medium text-emerald-800/70 leading-relaxed">
              Seus dados estão sincronizados em tempo real com criptografia ponta a ponta. 
              O backup manual permite a restauração total através do módulo "Restaurar Dados" no menu lateral.
            </p>
          </div>

          <div className="bg-amber-50 p-8 rounded-[2rem] border border-amber-100 flex items-start gap-4">
            <div className="p-3 bg-amber-200/50 text-amber-700 rounded-2xl"><Info size={24} /></div>
            <div>
              <h4 className="font-black text-[10px] text-amber-800 uppercase tracking-widest mb-2">Aviso Importante</h4>
              <p className="text-xs font-medium text-amber-700 leading-relaxed">
                Mantenha seus backups atualizados semanalmente. Os arquivos gerados são compatíveis com qualquer planilha eletrônica e podem ser usados para auditoria ou recuperação emergencial.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden relative">
         <div className="absolute right-0 top-0 p-8 opacity-10"><RefreshCw size={100} /></div>
         <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em] mb-8">Conteúdo Protegido no Backup</h3>
         <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
           {[
             { label: 'Clientes', icon: Users, count: 'Documentos' },
             { label: 'Vendas', icon: FileText, count: 'Histórico' },
             { label: 'Financeiro', icon: DollarSign, count: 'Lançamentos' },
             { label: 'Vendedores', icon: UserCheck, count: 'Equipe' },
             { label: 'Agenda', icon: CalendarDays, count: 'Retornos' },
           ].map((item, idx) => (
             <div key={idx} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col items-center text-center transition-all hover:bg-indigo-50/50">
               <item.icon size={24} className="text-indigo-500 mb-3" />
               <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">{item.label}</p>
               <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{item.count}</p>
             </div>
           ))}
         </div>
      </div>
    </div>
  );
};

export default SystemSettings;