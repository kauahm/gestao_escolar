# Documentação — Gestão Escolar 2.0

Toda a documentação do projeto fica nesta pasta.

| Arquivo | Conteúdo |
|---|---|
| [01-entendimento-do-projeto.md](01-entendimento-do-projeto.md) | O que o sistema faz, quem usa, módulos, stack, modelo de dados e pontos de atenção do código |
| [02-associacao-aemc.md](02-associacao-aemc.md) | Quem é a Associação Educacional Maria do Carmo (AEMC), onde atua, escala e o que isso significa para o produto |
| [03-objetivos-do-2.0.md](03-objetivos-do-2.0.md) | Contexto de origem, objetivo do 2.0 (vender para a sede em São Paulo e ativar nas escolas) e decisões em aberto |
| [04-pesquisa-de-mercado.md](04-pesquisa-de-mercado.md) | Sistemas parecidos (manutenção, creches, ERPs escolares, prestação de contas, recrutamento): o que fazem, o que os usuários reclamam e onde podemos ser melhores |
| [05-referencias-de-design.md](05-referencias-de-design.md) | Referências de design e UX (Linear, Stripe, Vercel, gov.br, shadcn/ui), regras de dashboard e direção de design proposta |
| [06-funcionalidades-e-roadmap.md](06-funcionalidades-e-roadmap.md) | Funcionalidades propostas por fase, diferenciais, roteiro de demonstração para São Paulo e riscos |
| [07-requisitos-legais-e-tecnicos.md](07-requisitos-legais-e-tecnicos.md) | LGPD, ECA Digital, prestação de contas (MROSC), WhatsApp, segurança com Firebase e arquitetura |
| [08-auditoria-visual-do-sistema-atual.md](08-auditoria-visual-do-sistema-atual.md) | O que vi navegando pelo sistema em produção: achados por severidade (lógica, dados, visual, celular), o que preservar, vitórias rápidas e perguntas para a mãe |
| [09-auditoria-de-seguranca-e-infraestrutura.md](09-auditoria-de-seguranca-e-infraestrutura.md) | Regras do Firestore, backup, Storage, autenticação, `.env` no Git e plano do Firebase: achados e ações priorizadas |
| [10-registro-de-alteracoes.md](10-registro-de-alteracoes.md) | O que já foi alterado no código, por data (base segura, painel honesto, lixeira, histórico, cópia em Excel), e o que falta você fazer uma vez |
| [11-prompt-para-claude-code.md](11-prompt-para-claude-code.md) | Texto pronto para retomar o projeto numa nova sessão, com as regras de trabalho e a ordem das próximas entregas |
| [12-revisao-e-testes-das-regras.md](12-revisao-e-testes-das-regras.md) | Revisão das regras do Firestore contra o código das telas, achados, e os testes automatizados (61 passando no emulador; como rodar) |
| [13-ambiente-de-demonstracao.md](13-ambiente-de-demonstracao.md) | Segundo projeto Firebase só com dados fictícios: o que vem nos dados, travas contra mistura com o sistema real, passo a passo para criar o projeto e como restaurar |
| [14-importacao-de-planilhas.md](14-importacao-de-planilhas.md) | Importação de Excel/CSV em Escolas, Contas, Ciclos e Banco de Talentos: o que cada módulo aceita, conversões, desfazer, leitor próprio de planilhas, testes e como testar no emulador local |
| [15-textos-e-estados-de-tela.md](15-textos-e-estados-de-tela.md) | Português do Brasil, um nome por tela, data e saudação, estados vazios que ensinam o próximo passo e o que a tela mostra quando os dados não chegam (sem internet, sem servidor, sem permissão) |
| [16-dados-e-fluxo-dos-chamados.md](16-dados-e-fluxo-dos-chamados.md) | Competência em seletor, tipo de conta, responsável ligado ao prestador, página de detalhe do chamado com linha do tempo, "Meus chamados" da diretora e "Esqueci minha senha" |
| [17-alertas.md](17-alertas.md) | Alertas que cobram: quadro "Precisa de atenção hoje" com ações, prazos por prioridade, ciclo vencido → chamado → ciclo em dia, "Ciente, lembrar depois", contador no menu e na aba, alertas da diretora |
| [18-design.md](18-design.md) | Design: base visual (Inter, cinzas azulados, textos), telas de impacto, celular da diretora, sistema instalável (PWA), auditoria de acessibilidade e prints de antes e depois em `design/` |
| [19-funcionarios.md](19-funcionarios.md) | Aba Funcionários com a estrutura da planilha "Colaboradores": campos, cargos sugeridos, filtros, ASO e afastamento, alertas, importação da planilha real, cuidados de LGPD e testes |
| [20-controle-de-saldo.md](20-controle-de-saldo.md) | Controle de saldo das verbas por área (base: planilha "Controle de Saldo"): período, áreas, lançamentos à vista e parcelados, teto do mês recalculado sozinho, mês a mês, importação da planilha, alertas e testes |

**Convenção:** arquivos numerados em ordem de criação (`NN-assunto.md`), escritos em português, com "(a confirmar)" onde houver inferência.
