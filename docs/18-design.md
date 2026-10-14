# Design: base visual, celular, instalação e acessibilidade

> Feito em 14/10/2026 (bloco F). Decisão: **evoluir o visual atual** (mesmo azul, mesmo menu, mesmas telas), sem tema escuro por enquanto e com o sistema **instalável no celular**. Direção geral em [05](05-referencias-de-design.md).
> Voltar ao índice: [README](README.md) · Relacionado: [10 Registro de alterações](10-registro-de-alteracoes.md)

## 1. Antes e depois

Prints tirados no emulador local, com os dados fictícios (pasta `docs/design/`):

| Tela | Antes | Depois |
|---|---|---|
| Login | [antes](design/antes/01-login.png) | [depois](design/depois/01-login.png) |
| Painel | [antes](design/antes/02-painel.png) | [depois](design/depois/02-painel.png) |
| Contas a pagar | [antes](design/antes/03-contas.png) | [depois](design/depois/03-contas.png) |
| Ciclos | [antes](design/antes/04-ciclos.png) | [depois](design/depois/04-ciclos.png) |
| Página do chamado | [antes](design/antes/05-chamado.png) | [depois](design/depois/05-chamado.png) |
| Login no celular | [antes](design/antes/06-login-celular.png) | [depois](design/depois/06-login-celular.png) |
| Início da diretora no celular | [antes](design/antes/07-diretora-celular.png) | [depois](design/depois/07-diretora-celular.png) |
| Meus chamados no celular | [antes](design/antes/08-meus-chamados-celular.png) | [depois](design/depois/08-meus-chamados-celular.png) |

## 2. Base visual (vale para todas as telas)

- **Fonte Inter** (gratuita, licença OFL), servida pelo próprio sistema, sem depender do Google Fonts.
- **Cinzas levemente azulados** no lugar dos cinzas neutros, aplicados de uma vez a todas as telas (configuração do Tailwind).
- **Azul da marca `#185FA5`** mantido, agora com escala completa de tons.
- **Sombras mais suaves**, foco visível ao navegar pelo teclado e respeito a quem pediu "menos movimento" no sistema.
- **Textos com maiúscula só onde o português pede:** 83 rótulos ajustados ("Nova Escola" → "Nova escola", "Todos os Tipos" → "Todos os tipos"). Valores gravados, como "Taxa de Limpeza", não foram tocados.
- **Esqueletos de carregamento** nas listas, no lugar do círculo girando sozinho no meio da tela.

## 3. Telas

- **Login:**
  - botões sem caixa alta;
  - no painel azul, o que a escola ganha ("Peça uma manutenção em segundos"...);
  - campos com rótulo e preenchimento automático (o navegador e os gerenciadores de senha reconhecem);
  - **no celular abre direto na área da escola**, com abas "Escola | Administração" no topo.
- **Painel:**
  - os quatro cartões viraram atalhos clicáveis;
  - **o cartão "Entrevistas do mês" sempre mostrava 0**, porque lia uma coleção (`candidatos`) que nada grava. Agora lê o Banco de Talentos e diz quantas ainda estão agendadas.
- **Menu lateral:** itens mais compactos (cabem todos numa tela de notebook) e o perfil aparece em português.
- **Celular da diretora:**
  - **barra de navegação inferior** com Início, um botão grande **"Pedir manutenção"** (abre o formulário direto) e Meus chamados;
  - os três cartões do Início numa linha só;
  - o selo de demonstração sobe para não cobrir a barra;
  - em Meus chamados, o chamado aberto mostra a descrição inteira, uma vez só.

## 4. Instalável no celular (PWA)

- Ícone próprio (escola estilizada no azul da marca), gerado por `scripts/gerar-icones.py`, em `public/icones/`: aba do navegador, Android (inclusive o formato recortado) e iPhone.
- `public/manifest.webmanifest` com nome, cores e ícones, e as metatags do iPhone no `index.html`. No celular, "Adicionar à tela inicial" cria um atalho com ícone que abre o sistema em tela cheia, sem a barra do navegador.
- **De propósito, sem "service worker" (cache de páginas).** Ele permitiria abrir sem internet, mas, mal calibrado, faz o celular continuar mostrando uma versão antiga depois de uma atualização, e o sistema não funciona sem internet de qualquer forma (os dados vêm do Firebase). Avaliar junto com o modo offline (item 3.7 do roadmap).
- **(a confirmar no aparelho)** O Chrome do Android passou a oferecer a instalação sem exigir o service worker; no iPhone é pelo menu Compartilhar → "Adicionar à Tela de Início".

## 5. Acessibilidade (meta WCAG 2.2 AA)

Auditoria automática com o **axe-core** (gratuito, instalado só para desenvolvimento), rodada em todas as telas logadas, como administração e como diretora:

| Problema encontrado | Correção |
|---|---|
| Botões só com ícone, sem nome para leitor de tela (menu ☰, fechar menu, fechar janela, fechar aviso, editar/excluir prestador) | Nome acessível em cada um |
| Seletores de filtro sem nome (15, em 6 telas) | Nome em cada filtro ("Filtrar por escola"...) |
| Texto cinza-claro com contraste 2,5:1 (66 lugares) | Tom mais escuro (≥ 4,5:1) |
| Verde, laranja e vermelho de texto e o cinza secundário abaixo de 4,5:1 sobre fundos coloridos claros | Paleta ajustada no Tailwind: o tom usado sobe um nível; vale para o sistema todo |
| Cores dos eventos automáticos da Agenda com texto branco ilegível (até 2,2:1) | Mesmas famílias de cor, em tons mais fortes |
| Janelas sem papel de "diálogo" | `role="dialog"` com o título |
| Ponto colorido de gravidade com rótulo inválido | Corrigido |

**Resultado:** zero violações nas telas da diretora, no login e em todas as telas da administração, **exceto a Agenda**. Lá restam itens internos da biblioteca do calendário (FullCalendar): ícones das setas e o nome dos dias para leitores de tela. Não dá para corrigir sem alterar a biblioteca. Os dias do mês vizinho, que estavam quase invisíveis, foram corrigidos.

A auditoria automática não substitui o teste com pessoas: leitor de tela real, zoom de 200% e uso só pelo teclado ficam **(a confirmar)**.

## 6. Ficou para depois
- Tema escuro (decisão de 14/10/2026).
- Busca global (Ctrl+K), notificações dentro do sistema e o painel da sede por município (Fase 1 do [roadmap](06-funcionalidades-e-roadmap.md)).
- Componentes padronizados (botão, campo, cartão) aplicados a todas as telas: hoje a base visual uniformiza cores, fonte e textos, mas cada tela ainda monta seus próprios botões e campos.

## 7. Como verificar
- `npm run build` e `npm test` (63 testes) passando.
- Prints de antes e depois em `docs/design/`.
- Para repetir a auditoria: modo emulador (ver [14](14-importacao-de-planilhas.md)), abrir uma tela e rodar o axe pelo console do navegador (`/node_modules/axe-core/axe.min.js`).
