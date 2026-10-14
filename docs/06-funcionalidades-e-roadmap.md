# Funcionalidades e roadmap proposto para o 2.0

> Baseado em: [01 Entendimento](01-entendimento-do-projeto.md), [02 AEMC](02-associacao-aemc.md), [03 Objetivos](03-objetivos-do-2.0.md), [04 Mercado](04-pesquisa-de-mercado.md), [05 Design](05-referencias-de-design.md) e [07 Legal/técnico](07-requisitos-legais-e-tecnicos.md).
> Voltar ao índice: [README](README.md)
>
> **Tudo aqui é proposta** para discutirmos. Tamanhos (P/M/G) são estimativas grosseiras de esforço, não prazos. A priorização final depende do que sua mãe e a sede disserem.

> **Ordem combinada (13/10/2026): design visual por último.** Mudança no roadmap abaixo: a **confiança** (não perder dados) vem primeiro, porque é o motivo pelo qual o 1.0 nunca foi adotado ([03](03-objetivos-do-2.0.md)). Onde o texto abaixo coloca "design system" na Fase 1, leia: **estrutura e fluxos primeiro; acabamento visual depois da Fase 3**.

## 1. Estratégia em uma frase

Entregar **uma demonstração irresistível para a sede** (visual + visão geral + relatório de prestação de contas) sobre **uma base segura e multiunidade**, e só depois ampliar os módulos.

Ordem lógica: **Base segura → Impacto visual e executivo → Fluxos que a escola usa → Diferenciais → Escala.**

---

> **Contexto confirmado (13/10/2026):** hoje a AEMC trabalha com **Word, Excel, Drive e Formulários Google**. Por isso o 2.0 deve (a) ser tão simples quanto um formulário para quem pede, (b) **importar planilhas e arquivos existentes** (escolas, contas, currículos, ciclos) e (c) **exportar para Excel/PDF/Word** no formato que a sede já usa. Ver [03](03-objetivos-do-2.0.md).

## 2. Mapa: o que temos × o que o mercado oferece × o que propomos

| Módulo | Hoje (1.0) | Mercado (04) | Proposta 2.0 |
|---|---|---|---|
| Manutenção | Chamados com prioridade, status, responsável, prazo; O.S. por WhatsApp e impressa | Fotos, QR por sala, SLA, aprovações, histórico por local, app offline | Fotos, histórico por local/ativo, SLA, comentários, link do prestador, QR code |
| Contas | Cadastro manual, status, vencida automática | Poucos produtos; energia com anomalias | Anexo do boleto/NF, alertas, tendência de consumo, categoria p/ prestação de contas |
| Ciclos | Periodicidade e próxima execução | Preventiva por ativo; **não** gera OS ao vencer (FMX) | Ciclo vencido gera chamado; cadastro de ativos (caixa d'água, extintores) |
| RH | Banco de currículos, entrevista, feedback | ATS: funil, vagas, admissão digital | Funil (kanban), vagas, checklist de admissão, PCD, mensagens prontas |
| Agenda | Calendário que junta tudo | Calendário por escola | Manter; filtros por município/unidade; convites |
| Usuários | 3 perfis; 1 diretora por escola | RBAC granular | Perfis ampliados + município/contrato + auditoria |
| Painel | Indicadores básicos | Operacional com próxima ação | Painel da sede por município; "precisa de atenção hoje" |
| Relatórios | Quase nenhum | 500+ relatórios (MicroMain) | **Relatório mensal de prestação de contas** + exportação |
| Comunicação | WhatsApp manual | Notificações in-app, push | Central de avisos + WhatsApp automatizado |
| Segurança | Regras não conferidas; rota sem proteção | MFA, auditoria | Regras do Firestore, claims, MFA, log de auditoria |

---

## 3. Funcionalidades por fase

### Fase 0 — Base segura (antes de qualquer demonstração real)
Sem isso, nada mais importa: um erro de segurança numa demo com dados reais custa a venda.

| # | Item | Por quê | Esforço |
|---|---|---|---|
| 0.1 | ✅ **Feito (13/10)** — **Versionar e endurecer as regras do Firestore**: as regras existem só no console (o arquivo `firestore.rules` do repositório não as contém); corrigir `prestadores` aberta a qualquer logado e validar campos dos chamados ([09](09-auditoria-de-seguranca-e-infraestrutura.md)) | Proteção real dos dados ([07](07-requisitos-legais-e-tecnicos.md)) | M |
| 0.2 | ✅ **Feito (13/10)** — Corrigir `PrivateRoute` (`allowedRole` × `allowedRoles`) | Hoje qualquer logado abre `/admin` | P |
| 0.3 | Perfis como *custom claims* + MFA para administradores | Permissão sólida, sem leituras extras | M |
| 0.4 | ✅ **Feito (13/10)** — Criar `.gitignore` e `.env.example`; restringir a chave de API por domínio. Verificado: `.env` está no Git, mas só com a configuração pública do Firebase Web ([09](09-auditoria-de-seguranca-e-infraestrutura.md)) | Higiene e boa prática | P |
| 0.5 | **Ambiente de demonstração** (projeto Firebase separado + dados fictícios + botão "resetar") | Mostrar sem expor nada real | M |
| 0.6 | Padronizar textos em PT-BR e estados de erro/vazio | Primeira impressão | P |
| 0.7 | **Importação de planilhas** (Excel/CSV) para escolas, contas, ciclos e currículos, com pré-visualização e validação | A AEMC vive em Excel/Drive; sem importar, a adoção trava | M |
| 0.8 | ✅ **Feito (13/10)** — **Corrigir a lógica que engana o painel**: "Vencida" como condição calculada (não sobrescreve "A enviar"), painel mostrando contas vencidas com valor, "próximos" só com datas futuras ([08](08-auditoria-visual-do-sistema-atual.md), A1–A3) | Hoje o painel mostra 0 contas enquanto há 20 vencidas | P |
| 0.9 | **Rede de segurança contra perda de dados** (a barreira real de adoção; exige plano Blaze com teto de orçamento, pois hoje não há backup: [09](09-auditoria-de-seguranca-e-infraestrutura.md)): **backup automático diário** do banco e dos arquivos, **lixeira com restauração** (arquivar em vez de apagar), **histórico de alterações**, **exportar tudo para Excel** a qualquer momento, aviso de status do sistema | A mãe não usa por medo de perder tudo | M |

### Fase 1 — "Uau" para a sede (demonstração)
| # | Item | Por quê | Esforço |
|---|---|---|---|
| 1.1 | **Design system** novo (tokens, componentes, tema claro/escuro) | [05](05-referencias-de-design.md) | G |
| 1.2 | **Painel da sede**: número-estrela, "precisa de atenção hoje" com ação direta, visão por unidade | Quem decide a compra olha isto primeiro | G |
| 1.3 | **Município → Contrato → Unidade** no modelo de dados | A AEMC atua em ~16 municípios ([02](02-associacao-aemc.md)) | G |
| 1.4 | **Relatório mensal de prestação de contas** (por contrato, por categoria; PDF/Excel) | Maior dor e maior brecha de mercado ([04](04-pesquisa-de-mercado.md)) | G |
| 1.5 | **Chamado com foto** + linha do tempo + comentários | Padrão de mercado, grande ganho de clareza | M |
| 1.6 | **Início da diretora** simplificado, mobile-first | Garantir adoção nas escolas | M |
| 1.7 | Busca global (Ctrl+K) e filtros salvos | Sensação de produto maduro | M |
| 1.8 | Responsivo/PWA instalável | Diretora usa o celular | M |

### Fase 2 — Fluxos que o dia a dia exige
| # | Item | Por quê | Esforço |
|---|---|---|---|
| 2.1 | **Anexos** em contas (boleto/NF em PDF/foto) e em chamados | Comprovante = prestação de contas | M |
| 2.2 | **Ciclo vencido → cria chamado automaticamente** (Cloud Function agendada) | Brecha do FMX; hoje a "vencida" só atualiza quando alguém abre a tela | M |
| 2.3 | **Alertas automáticos** (conta vence em 7/3/1 dias; chamado parado; ciclo perto de vencer) | Hoje depende de alguém olhar | M |
| 2.4 | **Link do prestador** (sem conta) para ver a O.S., aceitar, atualizar status, anexar foto | Visibilidade do trabalho de terceiros (queixa do Fiix) | M |
| 2.5 | **SLA por prioridade** (ex.: alta = 48h) com escalonamento | Governança | M |
| 2.6 | Aprovação de **custos** em chamados acima de um valor | Controle financeiro | M |
| 2.7 | **Cadastro de ativos** (caixa d'água, extintores, ar-condicionado, filtros) com histórico | Preventiva por ativo; a capacidade da caixa d'água já existe | M |
| 2.8 | **Funil de recrutamento (kanban)**, vagas, tag **PCD**, checklist de documentos de admissão, mensagens prontas de WhatsApp | Alinha ao que a AEMC já faz (processos seletivos e Banco PCD) | M |
| 2.9 | **Notificações**: sino no sistema + push (PWA) | Engajamento | M |
| 2.10 | **Log de auditoria** (quem mudou o quê e quando) | Confiança e conformidade | M |
| 2.11 | Perfis ampliados: coordenação regional, diretor educacional, supervisor | Estruturas reais da AEMC | M |

### Fase 3 — Diferenciais (o que o mercado quase não faz)
| # | Item | Por quê | Esforço |
|---|---|---|---|
| 3.1 | **Extração automática de dados do boleto/NF** (código de barras, valor, vencimento; OCR/IA) | Menos digitação, menos erro | M–G |
| 3.2 | **Detecção de anomalia de consumo** (energia/água) e alerta/chamado | O Brightly gera OS em picos de consumo; aqui na realidade CPFL/SABESP | M |
| 3.3 | **QR code por espaço**: qualquer funcionária abre o chamado sem login, pelo celular | Click Maint e OperationsHERO oferecem; não encontrei em português | M |
| 3.4 | **Chamado por WhatsApp** (a diretora manda a mensagem e o sistema cria o chamado) | Onde as pessoas já estão | G |
| 3.5 | **Painel de qualidade e metas** do plano de trabalho (vagas preenchidas, formações, satisfação) | A AEMC reporta metas à prefeitura ([02](02-associacao-aemc.md)) | G |
| 3.6 | **Custo por unidade / por aluno / por categoria** com comparação entre unidades | Visão financeira que o CFO usa (caso Greenhill) | M |
| 3.7 | **Modo offline** (rascunho de chamado sem sinal) | Escolas com sinal ruim; eMaint cobra por isso | M |

### Fase 4 — Escala e novos módulos (avaliar depois)
- **Multi-cliente** (outras OSC): isolamento por organização, cobrança, marca personalizável.
- **Escala da equipe e razão adulto/criança** (inspirado no Famly).
- **Ocupação e lista de espera** (inspirado nas centrais públicas de vagas).
- **Integrações**: contabilidade, Transferegov/portais municipais, assinatura eletrônica, e-mail/calendário.
- **API pública** e exportação de dados abertos (a AEMC já publica dados em formato aberto).
- **Diário e comunicação com famílias** — só se a AEMC quiser; envolve dados de crianças e exige o cuidado jurídico do [documento 07](07-requisitos-legais-e-tecnicos.md).

---

## 4. Diferenciais "que ninguém tem" (nosso discurso para a sede)

1. **"O relatório do mês já nasce pronto"**: cada conta, serviço e manutenção entra com categoria e comprovante; a prestação de contas por município sai quase automática.
2. **"Nada vence sem aviso"**: contas, ciclos e prazos geram alertas e chamados sozinhos.
3. **"Uma visão, todos os municípios"**: Município → Contrato → Unidade, com semáforo.
4. **"Feito para a diretora"**: abrir um chamado em segundos, no celular, sem treinamento; **quem pede não paga licença**.
5. **"Feito no Brasil"**: CPFL, SABESP, WhatsApp, MROSC, LGPD, português correto.
6. **"Auditável"**: quem fez o quê, quando, com anexos guardados.

---

## 5. Roteiro de uma demonstração de 10 minutos para São Paulo **[proposta]**

1. **Painel da sede** (1 min): "estas 7 coisas precisam de você hoje".
2. **Uma diretora abre um chamado no celular com foto** (1 min), aparece na sede em tempo real.
3. **Sede atribui ao prestador e envia por WhatsApp**; o prestador atualiza pelo link (2 min).
4. **Conta vencendo** com alerta e comprovante anexado (1 min).
5. **Ciclo da caixa d'água vencido** gera chamado sozinho (1 min).
6. **Relatório mensal por contrato** em PDF/Excel (2 min). *Este é o momento de venda.*
7. **Segurança e controle**: perfis, auditoria (1 min).
8. Fechar com o que vem depois (1 min).

(Tudo no ambiente de demonstração com dados fictícios.)

---

## 6. Riscos e cuidados
- **Escopo:** querer fazer tudo antes da demonstração. Mitigar com a Fase 1 enxuta.
- **Dados reais** misturados com demonstração. Mitigar com ambiente separado (0.5).
- **Promessas à sede** sem saber como eles trabalham hoje. Mitigar com as perguntas abaixo.
- **Dependência do Firebase**: o modelo de regras fica mais complexo com multi-contrato. Avaliar custo/limite (ver [07](07-requisitos-legais-e-tecnicos.md)).
- **WhatsApp automatizado** tem custo e regras da Meta (ver [07](07-requisitos-legais-e-tecnicos.md)).

---

## 7. Perguntas que mais mudam este roadmap
1. Quais sistemas/planilhas a **sede** usa hoje para contas, manutenção, RH e prestação de contas?
2. Como é o **relatório mensal** que eles preparam? (modelo real, mesmo que anonimizado)
3. Quem na sede aprovaria e usaria o painel? Quantas pessoas, que cargos?
4. A venda é **licença única, mensalidade ou serviço**? (influencia multi-cliente e suporte)
5. As diretoras de Hortolândia estão dispostas a **testar o 2.0** antes da apresentação?
6. A sede aceitaria **WhatsApp automatizado** (custo + número oficial)?


---

## Pendente para depois da venda (exige gasto)

**Regra definida em 13/10/2026: nenhum gasto com o projeto até haver certeza da venda.** Tudo abaixo depende do plano Blaze do Firebase (pagamento por uso, com teto de orçamento) e fica **adiado até o fechamento com a AEMC**:

| Item | Por que depende de pagamento | Alternativa sem custo até lá |
|---|---|---|
| Backup diário agendado e recuperação pontual do Firestore | Indisponíveis no plano Spark ([09](09-auditoria-de-seguranca-e-infraestrutura.md)) | Exportar tudo para Excel/JSON pelo próprio app; lixeira e histórico de alterações |
| Storage (fotos de chamado, boletos, notas) | Desativado no Spark | Na demonstração, usar fotos de exemplo; anexos como link do Drive (a confirmar) |
| Cloud Functions (criar usuário com segurança, *custom claims*, lembretes) | Exigem Blaze (a confirmar) | Manter criação de usuário pelo admin no app, com regras reforçadas |
| MFA para administradores | Pode exigir upgrade (a confirmar) | Senhas fortes e cadastro público fechado |
| WhatsApp Business Platform (envio automático) | Cobrança por mensagem | `wa.me` (manual e gratuito) |

Quando a venda fechar, a primeira ação é ligar o Blaze **com alerta e teto de orçamento** e ativar o que está acima.
