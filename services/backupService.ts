import { dbService } from './dbService';

export const backupService = {
  /**
   * Converte um array de objetos para uma string CSV formatada
   */
  toCSV(data: any[]) {
    if (!data || data.length === 0) return 'Nenhum dado encontrado';
    
    // Extrai cabeçalhos e limpa os dados para evitar quebras no CSV
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    // Adiciona cabeçalho
    csvRows.push(headers.join(';'));

    // Adiciona linhas de dados
    for (const row of data) {
      const values = headers.map(header => {
        let val = row[header];
        
        // Trata objetos aninhados (ex: base_cliente)
        if (typeof val === 'object' && val !== null) {
          val = JSON.stringify(val);
        }
        
        // Escapa aspas e remove quebras de linha para não quebrar o arquivo
        const escaped = ('' + (val ?? '')).replace(/"/g, '""').replace(/\n/g, ' ');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(';'));
    }
    
    // Adiciona o BOM para garantir que o Excel abra com acentuação correta (UTF-8)
    return '\ufeff' + csvRows.join('\n');
  },

  /**
   * Gera o download do arquivo no navegador
   */
  downloadFile(content: string, fileName: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  },

  /**
   * Executa o backup completo de todas as tabelas do sistema
   */
  async runFullBackup() {
    // Gera timestamp formatado: DD-MM-YYYY_HH-mm
    const now = new Date();
    const timestamp = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;

    try {
      // Busca todos os dados brutos de forma independente
      const [customers, orders, financeiro, sellers, agenda] = await Promise.all([
        dbService.getCustomers(),
        dbService.getSaleOrders(),
        dbService.getFinanceiro(),
        dbService.getSellers(),
        dbService.getAgenda()
      ]);

      // 1. Clientes
      this.downloadFile(this.toCSV(customers), `NEXUS_BACKUP_CLIENTES_${timestamp}.csv`);
      
      // 2. Vendas (Pedidos Completos)
      this.downloadFile(this.toCSV(orders), `NEXUS_BACKUP_VENDAS_${timestamp}.csv`);
      
      // 3. Financeiro (Parcelas, Pagamentos, Comissões e Repasses)
      this.downloadFile(this.toCSV(financeiro), `NEXUS_BACKUP_FINANCEIRO_${timestamp}.csv`);

      // 4. Vendedores
      this.downloadFile(this.toCSV(sellers), `NEXUS_BACKUP_VENDEDORES_${timestamp}.csv`);

      // 5. Agenda de Retorno
      this.downloadFile(this.toCSV(agenda), `NEXUS_BACKUP_AGENDA_${timestamp}.csv`);

      return true;
    } catch (error) {
      console.error("Erro no Backup:", error);
      throw error;
    }
  }
};