# Alertas que cobram

> Feito em 14/10/2026 (bloco E). Sem custo: os alertas são calculados no próprio sistema, quando alguém o abre.
> Voltar ao índice: [README](README.md) · Relacionado: [10 Registro de alterações](10-registro-de-alteracoes.md) · [16 Dados e fluxo dos chamados](16-dados-e-fluxo-dos-chamados.md)

## 1. O que aparece

No painel da administração, o quadro **"Precisa de atenção hoje"** substituiu a antiga lista "Itens Críticos". Cada item tem cor de gravidade e a ação que resolve ali mesmo:

| Alerta | Quando | Gravidade | Ação no próprio quadro |
|---|---|---|---|
| Chamado pendente sem atendimento | Mais dias do que o prazo da prioridade (abaixo) | Crítico se prioridade Alta; senão atenção | Abrir chamado |
| Prazo do chamado estourado | Prazo passou e não está concluído | Crítico | Abrir chamado |
| Chamado em andamento parado | 7 dias ou mais sem nenhuma atualização | Atenção | Abrir chamado |
| Ciclo vencido | Próxima execução já passou | Crítico (atenção, se já há chamado aberto para ele) | **Já foi feito** (registra hoje e calcula a próxima) · **Abrir chamado** (ou Ver chamado) |
| Ciclo perto de vencer | Até 7 dias | Aviso | Já foi feito · Abrir chamado |
| Contas vencidas | Qualquer conta vencida sem envio (um alerta só, com total e a mais antiga) | Crítico | Ver contas (já filtrada em "Vencidas") |
| Conta perto de vencer | Até 3 dias (hoje e amanhã = atenção) | Atenção / aviso | Marcar como enviada |
| ASO vencido ([19](19-funcionarios.md)) | Exame periódico de funcionário ativo vencido (um alerta só, com os primeiros nomes) | Atenção | Ver funcionários (já filtrada) |
| ASO perto de vencer | Até 30 dias (um alerta só) | Aviso | Ver funcionários (já filtrada) |
| Verba estourada ([20](20-controle-de-saldo.md)) | O lançado numa área passou da verba do período | Atenção | Ver controle de saldo |
| Contrato vencendo ([21](21-visao-da-sede.md)) | Fim da vigência em até 90 dias (atenção a partir de 30) | Aviso / atenção | Ver contratos |
| Contrato vencido com escolas | Vigência acabou e ainda há escolas ativas ligadas | Atenção | Ver contratos |
| Área acima do teto do mês | O gasto do mês atual passou do teto (os meses seguintes se ajustam sozinhos) | Aviso | Ver controle de saldo |

Vários motivos no mesmo chamado (prazo estourado e pendente há muito tempo) viram um alerta só, com os dois motivos.

**Prazos por prioridade** (padrão combinado em 14/10/2026; ajustáveis em `src/utils/alertas.js`): Alta 2 dias, Média 5, Baixa 10 (e Urgente 1, para o caso de aparecer).

## 2. Ciclo vencido → chamado → ciclo em dia

"Abrir chamado" num ciclo vencido cria o chamado já preenchido (escola, tipo do serviço, data em que venceu) e abre a página dele. **Ao concluir esse chamado, o ciclo é atualizado sozinho** (última execução = hoje, próxima calculada). Enquanto o chamado está aberto, o alerta do ciclo fica como "encaminhado" (deixa de ser crítico) e mostra "Ver chamado".

Isso é o que dá para fazer sem custo. A versão automática (o sistema abrir o chamado sozinho à noite) precisa de Cloud Functions, do plano pago, e está na lista "depois da venda" do [roadmap](06-funcionalidades-e-roadmap.md).

## 3. "Ciente, lembrar depois"

Em cada alerta, **Ciente** tira o item do quadro por 1, 3 ou 7 dias; no dia marcado, ele volta a cobrar sozinho. Os adiados ficam num atalho ("2 adiados"), com "Voltar a cobrar". Fica gravado na coleção `alertasAdiados` (só a administração lê e grava; data no formato conferido pelas regras, com teste no emulador).

## 4. Contador

O número de alertas **críticos e de atenção** (sem os adiados e sem os avisos leves) aparece:
- num selo vermelho ao lado de **Painel**, no menu;
- na aba do navegador: **"(7) Painel · Gestão Escolar"**, visível mesmo com outra aba aberta;
- no título do quadro, com os avisos leves à parte ("+ 2 avisos").

## 5. Para a diretora

O Início da diretora mostra **"Precisa de atenção"** com os alertas da escola dela: chamados atrasados (com "a administração também está vendo este atraso" e o link para Meus chamados), ciclos vencidos ou perto de vencer e contas vencidas. Sem botões de administração.

## 6. Como foi construído

- `src/utils/alertas.js`: regras e cálculo (função pura, com 10 testes).
- `src/contexts/AlertasContext.jsx`: lê chamados, contas, ciclos e adiados **uma vez** e compartilha com o painel, o menu e a aba (o painel deixou de ter leituras próprias dessas três coleções). Recalcula a cada 10 minutos, para "vence hoje" virar "venceu" depois da meia-noite.
- `src/services/acoesDosAlertas.js`: registrar execução, abrir chamado do ciclo, marcar conta como enviada, adiar e voltar a cobrar. O que mexe em dados do trabalho passa pela camada com histórico.
- `src/components/shared/PainelDeAlertas.jsx`: o quadro.
- O diálogo de confirmação ganhou um tom "normal" (azul, "Registrar") para confirmações que não apagam nada.

## 7. Como foi verificado

- `npm test`: 63 testes (10 dos alertas). `npm run test:regras`: 55 (3 dos adiados).
- Na tela, no emulador local (14/10/2026): quadro com 7 cobrando + 2 avisos, mesmo número no menu e na aba; "Já foi feito" num ciclo (gravou hoje e a próxima data, e o alerta sumiu); "Abrir chamado" num ciclo vencido, iniciar atendimento e concluir (o ciclo foi atualizado para o ano seguinte); "Ciente" por 3 dias e "Voltar a cobrar"; "Marcar como enviada"; "Ver contas" abrindo já filtrado em vencidas; alertas da escola no início da diretora.
- Corrigidos durante o teste: o número do quadro não batia com o do menu; ao "voltar a cobrar" o último adiado, o quadro ficava preso numa lista vazia; ao sair do sistema, a aba continuava com o contador.
- Regras publicadas nos dois projetos (real e demonstração), conferidas por hash, antes do envio do código.

## 8. Limites
- Os alertas só aparecem com o sistema aberto. Avisos por e-mail ou celular com o sistema fechado dependem do plano pago (lista "depois da venda").
- Os prazos valem para todos; não há prazo diferente por escola ou por tipo de serviço.
