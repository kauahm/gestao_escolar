# Auditoria visual do sistema atual (1.0 em produção)

> Feita em 13/10/2026 (por volta de 21h55) navegando pelo sistema publicado (gestao-escolar-phi.vercel.app) com a conta de administração, **somente para olhar**: não criei, editei, salvei nem apaguei nada (abri formulários e janelas de detalhes e fechei sem salvar).
> Voltar ao índice: [README](README.md) · Relacionados: [01 Entendimento](01-entendimento-do-projeto.md) · [05 Design](05-referencias-de-design.md) · [06 Roadmap](06-funcionalidades-e-roadmap.md)
>
> **Privacidade:** o sistema tem dados reais (nomes de diretoras, e-mails, valores de contas). Este documento **não repete dados pessoais** e **não guardei capturas de tela** na pasta.
> **Limites:** a tela da **diretora** não foi vista (não tenho acesso a essa conta; análise só pelo código). O mobile foi **simulado** com a tela do próprio sistema em largura de 390px, não num aparelho real. Não abri os formulários de escola, ciclo e manutenção, nem a impressão da O.S.

---

## 1. Resumo em 6 linhas

1. **O visual atual é limpo e organizado**, com a identidade da AEMC (logo, azul). Não é feio, é **genérico**: parece um painel administrativo padrão, não um produto.
2. **O sistema tem uso real, mas parece ter parado em meados de 2026.** Há 9 escolas, 20 contas (vencimentos de 13/05 a 15/06/2026), 2 manutenções e 1 ciclo; **nenhum prestador, candidato ou entrevista**. Nada com data posterior a junho nas listas que vi.
3. **O mais grave não é visual, é de lógica:** o painel diz **"Contas a Enviar: 0 / R$ 0,00"**, mas a tela de contas mostra **20 contas, todas "Vencidas", somando R$ 18.148,46**. O painel esconde o problema.
4. Os **alertas e "próximos eventos" mostram coisas de abril e maio** em outubro. Nada avisa que há uma manutenção parada há 173 e 178 dias e um ciclo vencido há 162 dias.
5. No **celular** funciona (menu hambúrguer), mas as tabelas cortam colunas e os filtros ocupam a tela inteira antes da lista.
6. Há **muitas vitórias rápidas**: textos, títulos, status, importação de planilhas e um painel de verdade já mudariam a primeira impressão.

---

## 2. O que existe hoje (observado)

| Tela | O que vi |
|---|---|
| Login | Tela limpa com o logo da AEMC, título "Administração", campos arredondados, botão azul; faixa azul no topo com "Acessar como Diretora" |
| Dashboard | Saudação, 4 cartões (Manutenções abertas 2, Contas a enviar 0, Ciclos críticos 1, Entrevistas 0), caixa amarela "Atenção: Itens Críticos", listas de manutenções, ciclos, contas e eventos |
| Escolas | 9 escolas em cartões (nome, código, bairro, diretora, nº de alunos "Não informado"); inclui uma unidade administrativa ("Escritório") |
| Manutenções | Tabela com 2 chamados, filtros (unidade, responsável, status, prioridade), botões WhatsApp / Gerar / ver / editar / excluir |
| Prestadores | Vazio, com mensagem "Nenhum prestador encontrado" |
| Contas a pagar | Tabela com 20 contas (CPFL, SABESP, taxa de licença/limpeza), todas "Vencida" |
| Ciclos | 1 ciclo (limpeza de caixa d'água) vencido há 162 dias, agrupado por unidade |
| Banco de Talentos / Processo seletivo | Vazios |
| Agenda | Calendário mensal (FullCalendar) com filtros por categoria e lista de "Próximos" |
| Usuários | 4 usuários (administradora, 2 diretoras, 1 RH inativo) com perfil, unidade e situação |

---

## 3. Achados por severidade

### 3.1 Alta: lógica que engana quem decide

| # | Achado | Por que importa | Proposta |
|---|---|---|---|
| A1 | **Contas "A enviar" viram "Vencida" automaticamente e o painel só soma "A enviar".** Resultado: painel mostra 0 enquanto há 20 vencidas (R$ 18.148,46) | Para a sede, o painel passa "tudo em dia" quando pode ser o contrário. Em demonstração, qualquer pessoa que abra a tela de contas percebe a contradição | "Vencida" deve ser **condição calculada** (vencimento passou e não foi enviada), não um status que sobrescreve; o painel mostra **vencidas em destaque**, com valor e dias de atraso |
| A2 | **Sem como saber se as contas vencidas foram de fato enviadas/pagas.** Todas as 20 estão "Vencida" | Pode ser atraso real ou **ninguém marcou como "Enviada"**; os dois cenários pedem coisas diferentes | Perguntar à sua mãe (seção 6) e tornar "marcar como enviada" **um toque** com anexo do comprovante |
| A3 | **Painel e agenda mostram eventos passados como "próximos"** (ex.: reunião de 07/05/2026 e prazos de 30/04 e 04/05, em outubro) | Parece sistema abandonado ou bugado | Filtrar só datas futuras; eventos passados em seção "Atrasado/Passou" |
| A4 | **Nenhum alerta ativo** para: manutenção parada há 173/178 dias; ciclo vencido há 162 dias | O sistema registra, mas **não cobra ninguém** | Alertas e escalonamento ([06](06-funcionalidades-e-roadmap.md) 2.3 e 2.5) |

### 3.2 Média: dados e fluxo

| # | Achado | Proposta |
|---|---|---|
| M1 | **Uma manutenção tem ~15 problemas misturados numa só descrição** (puxador, lâmpadas, mesas, vazamento, ventiladores, pintura…), com local "circuito de banho, corredor, salas, refeitório, parque…" | Permitir **itens/checklist dentro do chamado** e **dividir em várias O.S.**; fotos por item |
| M2 | **Competência digitada à mão e inconsistente** ("ABRIL/2026", "abril/2025", "MAIO/26", "JUNHO/26"); há conta que vence em maio/2026 com competência "abril/2025" (provável erro) | Campo de **mês/ano em seletor**; validação |
| M3 | **Tipos de conta fora do padrão**: aparece "TAXA DE LICENÇA" (provável tipo "Outro" digitado), enquanto a lista oficial tem "Taxa de Limpeza" | Lista fechada de categorias, alinhada às da AEMC ([04](04-pesquisa-de-mercado.md), prestação de contas) |
| M4 | **Responsável "Vitor" numa manutenção, mas a lista de Prestadores está vazia** | Responsável sempre ligado a um prestador cadastrado (ou a um usuário) |
| M5 | **Detalhes da manutenção mostram só a descrição** (sem status, prioridade, prazo, histórico); o botão **Excluir** fica na janela de visualização | Tela de detalhe com **linha do tempo**; exclusão escondida e com confirmação forte, preferir "arquivar" |
| M6 | **Dados cadastrais incompletos**: "Não informado" para número de alunos nas escolas visíveis; unidade administrativa misturada com escolas | Importar planilha; separar tipos de unidade (escola, escritório) |
| M7 | **Sem recuperação de senha** (não encontrei no código da tela de login) | Fluxo "Esqueci minha senha" |

### 3.3 Média: visual e consistência (desktop)

| # | Achado | Proposta |
|---|---|---|
| V1 | ✅ Feito em 14/10 ([15](15-textos-e-estados-de-tela.md)). **Títulos duplicados e diferentes**: barra superior diz "Gestão de Escolas", "Sistema de Gestão", "Ciclos Periódicos", "Agenda Escolar", "Gestão de Usuários"; o título da página diz "Escolas", "Prestadores de Serviço", "Controle de Ciclos"… | Um título por tela; barra superior com **migalhas** e busca global |
| V2 | ✅ Feito em 14/10 ([15](15-textos-e-estados-de-tela.md)). **Data com maiúsculas indevidas**: "Terça-Feira, 13 De Outubro De 2026" | "terça-feira, 13 de outubro de 2026" |
| V3 | ✅ Feito em 14/10 ([15](15-textos-e-estados-de-tela.md)). **Saudação usa nome completo** ("Boa noite, Alessandra Martins!") | Primeiro nome |
| V4 | **Painel sem hierarquia**: quatro cartões iguais, uma caixa amarela com texto longo; sem número-estrela, tendência, visão por escola ou gráfico | Painel da sede ([05](05-referencias-de-design.md)): 1 indicador principal, lista "precisa de atenção" com ação, ranking de unidades |
| V5 | **Caixa de alerta com o texto inteiro de uma descrição** (linhas e linhas) | Resumir (título + local + dias) e abrir o detalhe |
| V6 | **Escolas**: nomes em CAIXA ALTA e truncados com "…" (ex.: "E.E.I DAVID MIGUEL LINARDI…"); "Não informado" repetido em todo cartão | Cartão com **mini-status da escola** (chamados abertos, contas, ciclos) em vez de campos vazios; nome completo ao passar o mouse; padronizar caixa |
| V7 | **Barra lateral**: o item **Usuários** não aparece sem rolar a própria barra (em tela de ~760px de altura); o logo tem o texto "Associação Educacional" quase ilegível | Agrupar menu (Operação / Pessoas / Administração), fixar itens, versão compacta do logo |
| V8 | **Tabelas**: Contas lista 20 linhas sem agrupamento, todas com o mesmo selo "Vencida", sem destaque por valor ou dias de atraso; ícones de ação (olho, lápis, lixeira vermelha) sempre visíveis | Ordenar por urgência, agrupar por unidade ou mês, ações em menu "⋯", seleção em lote |
| V9 | **Usuários**: ícones de ação (chave, lápis, desligar) sem rótulo visível; "Acesso Geral" em itálico cinza | Rótulos/tooltips e selos de perfil mais claros |
| V10 | ✅ Feito em 14/10 ([15](15-textos-e-estados-de-tela.md)). **Estados vazios fracos** (Banco de Talentos, Processo Seletivo, Prestadores): só texto cinza (Prestadores tem botão) | Estados vazios que ensinam o próximo passo, com ilustração e botão "Importar planilha" |
| V11 | **Ciclos**: bom agrupamento por unidade/tipo, mas os contadores do topo são minúsculos e a ação "Hoje" não é autoexplicativa | Cartões de resumo maiores; botão "Marcar como feito" com data |

### 3.4 Média: celular (simulado a 390px)

| # | Achado | Proposta |
|---|---|---|
| C1 | O menu vira hambúrguer e o layout se adapta (**bom ponto de partida**) | Manter |
| C2 | **Cartões do painel um embaixo do outro**: quatro telas de rolagem antes de chegar às listas | Grade 2×2 e lista "atenção" no topo |
| C3 | **Filtros ocupam a tela toda** (quatro seletores empilhados) antes de aparecer o primeiro resultado | Filtros recolhidos em um botão "Filtrar"; busca no topo |
| C4 | **Tabelas cortam colunas** (cabeçalhos truncados como "N° D…", valor e status fora da tela) | Tabelas viram **cartões** no celular |
| C5 | Não vi a tela da diretora (a mais importante no celular) | Auditar assim que houver acesso a uma conta de teste |

---

## 4. O que está bom e deve ser preservado

- **Identidade da AEMC** (logo, azul) reconhecível e coerente.
- **Tom e organização** da navegação lateral; nomes de módulos claros.
- **Fluxo de O.S. por WhatsApp e "Gerar"** (impressão) já pensados para o dia a dia.
- **Agenda unificada** (vencimentos, ciclos, manutenções, entrevistas) com filtros por categoria: diferencial raro.
- **Ciclos agrupados** por unidade ou por tipo, com cor por situação.
- **Filtros combináveis** em Manutenções e Contas.
- **Formulários curtos**, com campos obrigatórios marcados (ex.: Registrar Conta).
- **Linhas com cor de urgência** (rosa/amarelo) e selos de status.

---

## 5. Vitórias rápidas (alto impacto, baixo esforço) **[proposta]**

| # | Ação | Esforço |
|---|---|---|
| 1 | Corrigir a conta do painel ("vencidas" visíveis, com valor) e a regra de "Vencida" | P |
| 2 | "Próximos" só com datas futuras (painel e agenda) | P |
| 3 | Padronizar títulos, data, saudação e vocabulário em português do Brasil | P |
| 4 | Competência e tipo de conta como seletores, não texto livre | P |
| 5 | Alerta do painel resumido e clicável | P |
| 6 | Cartões do painel em grade 2×2 no celular; filtros recolhidos | P–M |
| 7 | Tabelas viram cartões no celular | M |
| 8 | Menu lateral reagrupado e sempre mostrando "Usuários" | P |
| 9 | "Esqueci minha senha" | P |
| 10 | Ação de excluir fora da janela de visualização; preferir arquivar | P |

---

## 6. Perguntas para a sua mãe (podem mudar as prioridades)

1. **Por que o uso parece ter diminuído depois de junho?** Falta de tempo, de hábito, o formulário/planilha era mais rápido, ninguém cobrava?
2. As **20 contas "Vencida"** realmente passaram da data sem ser enviadas, ou foram enviadas e ninguém marcou no sistema?
3. O que ela **mais abre** no sistema e o que **nunca** usou (prestadores, banco de talentos, ciclos)?
4. As **diretoras** chegaram a usar? Alguma vez abriram um chamado pelo sistema?
5. O que ela ainda faz **no Excel/Drive/Formulários** que o sistema deveria substituir?
6. Quem é o "Vitor" (responsável da manutenção) e quem faz os serviços nas escolas?

---

## 7. Como isto entra no plano
- Os itens **A1–A4** entram na **Fase 0/1** do [roadmap](06-funcionalidades-e-roadmap.md) (itens 0.8 e 1.2), porque comprometem uma demonstração.
- **V1–V11** e **C1–C5** alimentam o design system e o painel da sede ([05](05-referencias-de-design.md)).
- **M1–M7** definem melhorias de modelo de dados e formulários (fotos, itens de chamado, seletores, importação).
- O fato de o uso ter caído reforça que o 2.0 precisa **ser tão fácil quanto um formulário** e **importar o que já existe** ([03](03-objetivos-do-2.0.md)).
