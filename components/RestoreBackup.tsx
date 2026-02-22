import React, { useState, useRef } from 'react';
import { 
  Upload, FileUp, ShieldAlert, CheckCircle2, 
  Loader2, Info, AlertTriangle, Database, 
  Trash2, FileJson, ArrowRight, Table, UserCheck, CalendarDays
} from 'lucide-react';
import { dbService } from '../services/dbService';

interface RestoreState {
  type: 'customers' | 'orders' | 'finance' | 'sellers' | 'agenda' | null;
  data: any[];
  fileName: string;
}

const RestoreBackup: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restores, setRestores] = useState<RestoreState[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): any[] => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    
    // Remove o BOM se existir e separa os headers
    const rawHeader = lines[0].replace(/^\ufeff/, '');
    const headers = rawHeader.split(';').map(h => h.replace(/^"|"$/g, ''));
    
    return lines.slice(1).filter(line => line.trim() !== "").map(line => {
      const values = line.split(';').map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
      const obj: any = {};
      headers.forEach((header, i) => {
        let val: any = values[i];
        
        // Tenta converter JSON strings de volta (ex: itens do pedido)
        if (val && (val.startsWith('[') || val.startsWith('{'))) {
          try {
            val = JSON.parse(val);
          } catch (e) {}
        }
        
        // Trata nulos e tipos
        if (val === "null") val = null;
        if (!isNaN(Number(val)) && val !== "" && header !== 'id' && !header.includes('id') && !header.includes('telefone') && !header.includes('cnpj')) {
          val = Number(val);
        }

        obj[header] = val;
      });
      return obj;
    });
  };

  const identifyFileType = (data: any[]): 'customers' | 'orders' | 'finance' | 'sellers' | 'agenda' | null => {
    if (!data.length) return null;
    const keys = Object.keys(data[0]);
    
    if (keys.includes('cnpj') && keys.includes('cidade')) return 'customers';
    if (keys.includes('data_pedido') && keys.includes('itens')) return 'orders';
    if (keys.includes('pedido_id') && keys.includes('parcela_numero')) return 'finance';
    if (keys.includes('nome') && keys.includes('status') && !keys.includes('cidade')) return 'sellers';
    if (keys.includes('cliente') && keys.includes('data_retorno')) return 'agenda';
    
    return null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const data = parseCSV(text);
        const type = identifyFileType(data);
        
        if (type) {
          setRestores(prev => {
            // Evita duplicar o mesmo tipo de arquivo na fila de prévia
            const filtered = prev.filter(p => p.type !== type);
            return [...filtered, { type, data, fileName: file.name }];
          });
        } else {
          alert(`O arquivo ${file.name} não foi reconhecido como um backup válido.`);
        }
      };
      reader.readAsText(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const executeRestore = async () => {
    if (!confirm("Isso irá sobrescrever dados com o mesmo ID ou CNPJ. Deseja continuar?")) return;
    
    setRestoring(true);
    try {
      for (const item of restores) {
        if (item.type === 'customers') {
          await dbService.upsertCustomers(item.data);
        } else if (item.type === 'orders') {
          await dbService.upsertSaleOrders(item.data);
        } else if (item.type === 'finance') {
          // Remove campos de join que podem quebrar o upsert
          const cleanFinance = item.data.map(({ base_cliente, ...rest }: any) => rest);
          await dbService.upsertFinanceiroRecords(cleanFinance);
        } else if (item.type === 'sellers') {
          await dbService.upsertSellers(item.data);
        } else if (item.type === 'agenda') {
          await dbService.upsertAgenda(item.data);
        }
      }
      alert("Restauração concluída com sucesso!");
      setRestores([]);
    } catch (error: any) {
      alert("Erro ao restaurar: " + error.message);
    } finally {
      setRestoring(false);
    }
  };

  const removeRestore = (index: number) => {
    setRestores(prev => prev.filter((_, i) => i !== index));
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'customers': return <Database size={20}/>;
      case 'orders': return <FileUp size={20}/>;
      case 'finance': return <Table size={20}/>;
      case 'sellers': return <UserCheck size={20}/>;
      case 'agenda': return <CalendarDays size={20}/>;
      default: return <Table size={20}/>;
    }
  };

  const getLabel = (type: string) => {
    switch(type) {
      case 'customers': return 'Base de Clientes';
      case 'orders': return 'Pedidos de Venda';
      case 'finance': return 'Lançamentos Financeiros';
      case 'sellers': return 'Vendedores';
      case 'agenda': return 'Agenda de Retorno';
      default: return 'Desconhecido';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
        <div className="w-16 h-16 bg-rose-600 text-white rounded-3xl flex items-center justify-center shadow-2xl">
          <Upload size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Restaurar Backup</h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Recuperação e Migração de Dados</p>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-200 text-center space-y-6">
        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-slate-200">
          <FileUp size={40} className="text-slate-300" />
        </div>
        <div className="max-w-md mx-auto">
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest mb-2">Importar Arquivos CSV</h2>
          <p className="text-sm text-slate-400 font-medium leading-relaxed">
            Selecione os arquivos gerados pelo sistema (Clientes, Vendas, Financeiro, Vendedores ou Agenda). 
            O sistema reconhecerá o conteúdo automaticamente.
          </p>
        </div>
        
        <div className="flex justify-center pt-4">
          <label className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-600 transition-all cursor-pointer flex items-center gap-3">
            <Table size={20} />
            Selecionar Arquivos
            <input 
              type="file" 
              multiple 
              accept=".csv" 
              className="hidden" 
              onChange={handleFileUpload}
              ref={fileInputRef}
            />
          </label>
        </div>
      </div>

      {restores.length > 0 && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Resumo para Importação</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Revise os arquivos antes de processar</p>
            </div>
            <button onClick={() => setRestores([])} className="text-rose-500 text-[10px] font-black uppercase tracking-widest hover:underline">Limpar Fila</button>
          </div>
          
          <div className="p-8 space-y-4">
            {restores.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${
                    item.type === 'customers' ? 'bg-indigo-100 text-indigo-600' : 
                    item.type === 'orders' ? 'bg-emerald-100 text-emerald-600' : 
                    item.type === 'sellers' ? 'bg-purple-100 text-purple-600' :
                    item.type === 'agenda' ? 'bg-rose-100 text-rose-600' :
                    'bg-amber-100 text-amber-600'
                  }`}>
                    {getIcon(item.type!)}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 uppercase tracking-widest">
                      {getLabel(item.type!)}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{item.fileName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                   <div className="text-right">
                     <p className="text-lg font-black text-slate-900 leading-none">{item.data.length}</p>
                     <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Registros</p>
                   </div>
                   <button onClick={() => removeRestore(idx)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18}/></button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-8 bg-slate-900 border-t border-slate-800">
            <div className="flex items-center gap-4 mb-8 text-amber-400">
               <ShieldAlert size={24} />
               <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                 Atenção: A restauração utiliza "UPSERT". Registros com o mesmo ID serão ATUALIZADOS com os dados do arquivo.
               </p>
            </div>
            <button 
              onClick={executeRestore}
              disabled={restoring}
              className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {restoring ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>}
              Confirmar e Restaurar Dados
            </button>
          </div>
        </div>
      )}

      <div className="bg-amber-50 p-8 rounded-[2rem] border border-amber-100 flex items-start gap-4">
        <div className="p-3 bg-amber-200/50 text-amber-700 rounded-2xl"><Info size={24} /></div>
        <div>
          <h4 className="font-black text-[10px] text-amber-800 uppercase tracking-widest mb-2">Orientações de Recuperação</h4>
          <p className="text-xs font-medium text-amber-700 leading-relaxed">
            A restauração inteligente permite sincronizar bases offline com o banco de dados principal. 
            É ideal para recuperar informações após formatações ou para transferir dados entre contas Nexus. 
            Não altere a primeira linha (cabeçalhos) dos arquivos CSV para não invalidar a detecção.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RestoreBackup;