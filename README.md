# Registo de Serviços

App pessoal (PWA) para registar, ao fim do dia, as **instalações**, **suportes** e **adicionais** feitos, com WO opcional por serviço.

- **Registo** — botões + / − por tipo; WO por serviço; «Anular» depois de apagar.
- **Calendário** — resumo de cada dia do mês; tocar num dia abre-o para editar.
- **Painel** — instalações no mês, comparação com o mês anterior, média por dia, gráficos.
- **Exportar** — CSV para Excel (`Data;Tipo de serviço;WO`, UTF-8 com BOM) e cópia de segurança em JSON.

Os dados ficam guardados só no telemóvel (IndexedDB) e a app funciona sem rede.

## Instalar no telemóvel
Abrir o endereço do GitHub Pages no Chrome (Android) → menu ⋮ → **Instalar app** / **Adicionar ao ecrã principal**.
No iPhone: Safari → Partilhar → **Adicionar ao ecrã principal**.

## Atualizar
Depois de alterar ficheiros, aumentar `VERSION` em `sw.js` para os telemóveis receberem a nova versão.

Fontes: Barlow e Barlow Condensed (SIL Open Font License, ver `fonts/OFL.txt`).
