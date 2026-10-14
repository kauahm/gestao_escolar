# Importação de planilhas

> Criado em 14/10/2026 (item 0.7 do [roadmap](06-funcionalidades-e-roadmap.md)). Sem custo e sem biblioteca nova.
> Voltar ao índice: [README](README.md) · Relacionado: [10 Registro de alterações](10-registro-de-alteracoes.md) · [12 Testes das regras](12-revisao-e-testes-das-regras.md) · [13 Ambiente de demonstração](13-ambiente-de-demonstracao.md)

## 1. Para que serve

A AEMC trabalha em Excel. Esta função leva o que já está em planilhas para dentro do sistema, sem redigitar: **Escolas, Contas a pagar, Ciclos e Banco de Talentos** têm o botão **"Importar planilha"**.

## 2. Como funciona (para quem usa)

1. **Baixar o modelo** (opcional). Vem com as colunas certas, uma aba "Como preencher" e, para contas e ciclos, a lista das escolas ativas com nome e código.
2. **Enviar o arquivo:** Excel (`.xlsx`) ou CSV. Não precisa ser o modelo: o sistema reconhece títulos parecidos ("Unidade", "Mês de referência", "Valor total"...) e ignora linhas de título acima do cabeçalho.
3. **Conferir as colunas**, se o sistema não reconhecer alguma obrigatória. Dá para trocar a aba e a linha dos títulos.
4. **Pré-visualizar:** cada linha aparece como **Pronta**, **Com aviso** (entra, com observação) ou **Com erro** (não entra), com o motivo. **Nada é gravado antes de clicar em "Importar".**
5. **Importar:** só as linhas sem erro entram. O **relatório para corrigir** (Excel) traz as linhas com problema, o motivo e os valores originais, para ajustar e reenviar.
6. **Desfazer:** logo depois de importar, "Desfazer esta importação" manda tudo o que foi criado para a **lixeira** (pode ser restaurado em Segurança dos dados).

Limite: **2.000 linhas por arquivo**, para não esgotar a cota gratuita diária do Firebase num clique.

## 3. O que cada módulo aceita

| Módulo | Obrigatórias | Outras colunas | Mesmo registro (não importa de novo) |
|---|---|---|---|
| Escolas | Nome | Código, Situação, Endereço, Bairro, CEP, Telefone, E-mail, Diretora, Celular e e-mail da diretora, Nº de alunos, Caixa d'água, Observações | Mesmo nome ou mesmo código |
| Contas a pagar | Escola, Tipo, Competência, Valor, Vencimento | Nº do documento, Status, Observações | Mesma escola, tipo e competência, com o mesmo documento (ou o mesmo valor, se não houver documento) |
| Ciclos | Escola, Tipo de ciclo, Última execução | Periodicidade (dias), Observações | Mesmo tipo na mesma escola |
| Banco de Talentos | Nome, Telefone, Vaga pretendida | E-mail, Tem experiência?, Indicação, Observações | Mesmo telefone ou mesmo e-mail |

Conversões automáticas:
- **Datas:** célula de data do Excel, `31/12/2026`, `31/12/26`, `2026-12-31`.
- **Valores:** `1234,56`, `1.234,56`, `R$ 1.234,56`, número do Excel.
- **Competência:** `10/2026`, `out/2026`, `Outubro/2026`, `outubro de 2026`, `2026-10` → gravada como `Outubro/2026`, igual à tela.
- **Tipo de conta:** "energia"/"luz" → CPFL; "água" → SABESP; "nota fiscal"/"NF" → Nota Fiscal de Serviço; qualquer outro texto → "Outro", com o texto guardado (aviso).
- **Tipo de ciclo:** reconhecido por palavra-chave (caixa, extintor, filtro, DR/DS). A próxima execução é calculada; a periodicidade em branco usa o padrão do tipo.
- **Escola:** pelo código ou pelo nome, sem diferenciar acentos e maiúsculas. Nome parcial que só combina com uma escola é aceito com aviso. **Escola inativa não recebe lançamentos** (erro com explicação).
- **Telefone e CEP** ganham a máscara da tela; e-mail vira minúsculas. Telefone sem DDD e e-mail estranho viram aviso, não erro.

Escolas importadas **sem endereço, bairro ou diretora** entram com aviso: a tela de edição pede esses campos, então complete-os depois.

## 4. Segurança e rastreabilidade

- Cada importação fica registrada na coleção `importacoes`: quem importou, quando, de qual arquivo, quantos registros e quais.
- Cada registro importado leva o campo `importacaoId` (escondido na cópia em Excel) e ganha uma linha no **histórico**, gravada **junto** com o registro: se o histórico falhar, o registro também não é gravado.
- **Desfazer** move para a lixeira (com o motivo "importação desfeita") e registra a exclusão no histórico. Também leva registros que tenham sido editados depois da importação.
- **Regras:** o admin importa nos quatro módulos; o RH (perfil administrativo) só currículos; a diretora não importa. O registro da importação não pode ser forjado (autor, data e situação inicial são conferidos), só tem o status alterado e nunca é apagado (exceto pela restauração da demonstração).
- Se a gravação parar no meio (queda de internet), a importação fica marcada como "incompleta" e pode ser desfeita.

## 5. Como foi construído (para quem mantém)

| Arquivo | Papel |
|---|---|
| `src/utils/lerPlanilha.js` | Leitor próprio de `.xlsx` (abre o ZIP com o descompactador do navegador e lê os XMLs) e de CSV (detecta `;`, `,` ou tabulação e a codificação UTF-8 ou Windows) |
| `src/importacao/normalizar.js` | Conversões de data, dinheiro, competência, telefone, CEP, e-mail, Sim/Não |
| `src/importacao/esquemas.js` | Colunas, nomes alternativos, obrigatórios, conversão e duplicidade de cada módulo |
| `src/importacao/processar.js` | Acha o cabeçalho, liga colunas a campos e valida linha a linha |
| `src/importacao/gravar.js` | Grava em lotes (registro + histórico) e desfaz |
| `src/importacao/arquivos.js` | Modelo e relatório em Excel |
| `src/components/shared/ImportarPlanilha.jsx` | A tela (janela) da importação |

**Por que um leitor próprio:** a biblioteca mais conhecida (`xlsx`/SheetJS) parou de ser atualizada no npm numa versão com falhas de segurança conhecidas. O formato `.xlsx` é um ZIP com XMLs, e o navegador já descompacta sozinho, então o leitor tem cerca de 340 linhas e nenhuma dependência.

Limites conhecidos do leitor:
- não lê o `.xls` antigo (mostra como salvar em `.xlsx`);
- fórmula sem resultado salvo vira célula vazia (o Excel sempre salva o resultado; só arquivos gerados por programas raros não salvam);
- células mescladas: o valor fica só na primeira célula.

## 6. Testes

- **Leitura e validação** (`npm test`, sem emulador): 35 testes, com planilhas de exemplo em `tests/importacao/fixtures/` (uma gerada por outra biblioteca, uma no formato exato do Excel, um CSV na codificação antiga do Windows e uma planilha de contas com erros de propósito). O script `gerar_fixtures.py` recria essas planilhas.
- **Regras e gravação** (`npm run test:regras`, com emulador): importar, importar em vários lotes, desfazer, RH só currículos, diretora nada, registro da importação imutável e restauração da demonstração.
- **Na tela, no emulador local (14/10/2026):** contas com erros de propósito (cabeçalho na linha 3 achado sozinho, 3 prontas, 1 com aviso, 4 com erro), importação e desfazer conferidos direto no banco; ciclos com escola inativa e repetidos; RH importando currículos.

### Testar no computador, sem tocar em nenhum projeto real
Precisa de Java 11+ (ver [12](12-revisao-e-testes-das-regras.md)).
1. Terminal 1: `npm run emulador` (sobe Auth e Firestore locais).
2. Terminal 2: `npm run emulador:dados` (cria 3 usuários de teste e os dados fictícios; e-mails e senha estão em `scripts/semear-emulador.mjs`).
3. Terminal 2: `npm run dev:emulador` e entre com um dos usuários.

O modo emulador usa o arquivo `.env.emulador`, que não tem segredo nenhum (projeto fictício `demo-gestao-escolar`) e por isso está no Git.

## 7. Ideias para depois
- Importar para **atualizar** registros existentes (por exemplo, a data da última execução dos ciclos), não só criar.
- Lista das importações anteriores, com "desfazer", na tela Segurança dos dados.
- Importação de manutenções e prestadores.
