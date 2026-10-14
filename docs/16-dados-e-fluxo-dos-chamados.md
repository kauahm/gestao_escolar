# Dados e fluxo: competência, responsável, detalhe do chamado e senha

> Feito em 14/10/2026 (bloco D; achados M2, M3, M4, M5 e M7 da [auditoria visual](08-auditoria-visual-do-sistema-atual.md)).
> Voltar ao índice: [README](README.md) · Relacionado: [10 Registro de alterações](10-registro-de-alteracoes.md) · [15 Textos e estados de tela](15-textos-e-estados-de-tela.md)

## 1. Competência das contas (M2)

- Escolhida em **dois seletores, mês e ano**, e gravada sempre como "Outubro/2026". Acabou a mistura "ABRIL/2026", "abril/2025", "MAIO/26".
- Ao editar uma conta antiga, o texto é convertido (ex.: "MAIO/26" → Maio/2026); se não for reconhecido, a tela pede para escolher mês e ano.
- **Aviso** quando a competência está a mais de 3 meses do vencimento (o caso real "abril/2025 vencendo em maio/2026"). A importação de planilhas dá o mesmo aviso.
- O filtro de competências ficou em **ordem de data** (mais recente primeiro), não alfabética.

## 2. Tipo de conta (M3)

- A lista continua: CPFL, SABESP, Taxa de Limpeza, Nota Fiscal de Serviço e Outro.
- Em "Outro", o campo **sugere os tipos já usados**. Se digitarem um tipo igual a outro já existente com outra grafia ("Taxa de licença" × "TAXA DE LICENÇA"), grava com a grafia que já existe.
- **(a confirmar)** A lista oficial de categorias da AEMC para a prestação de contas; quando a mãe passar, viram opções fixas.

## 3. Responsável ligado ao prestador (M4)

- O chamado guarda o **identificador do prestador** (`responsavelId`) e o nome (`responsavel`). O nome mostrado, o WhatsApp e a O.S. impressa usam sempre o cadastro atual do prestador.
- Chamados antigos só com o nome são ligados automaticamente ao prestador de mesmo nome quando editados.
- Nome que não está no cadastro (o caso "Vitor") aparece como **"Vitor (não cadastrado)"**, na lista e no detalhe, com aviso para escolher um prestador. O mesmo vale para um prestador que foi excluído.
- O filtro "Responsável" da lista passou a usar o prestador (e "A definir").
- **Regras:** a diretora continua sem poder escolher o responsável (teste novo: chamado da diretora com `responsavelId` é recusado).

## 4. Tela de detalhe do chamado (M5)

- Página própria: **`/admin/manutencoes/<id>`**. A descrição na lista virou link, o ícone de olho também, e o "Resolver →" do painel para chamado parado abre direto o chamado.
- Mostra: status, prioridade, número da O.S., escola e local, responsável com telefone, prazo com dias de atraso, quando e por quem foi aberto, conclusão e observações internas.
- **Linha do tempo** a partir do histórico: "Status: Pendente → Em andamento · Ana · 12/10 14:30", "Responsável: Vitor → José Carlos", "Prazo: sem prazo → 10/10/2026". Chamados de antes do histórico (13/10/2026) têm a abertura e a conclusão reconstruídas pelas datas do próprio chamado.
- Ações: **mudar o status com um clique** (iniciar atendimento, concluir, reabrir), editar, enviar a O.S. por WhatsApp e imprimir. **Excluir** fica no fim da página, com confirmação, e vai para a lixeira.
- O envio por WhatsApp e a O.S. impressa saíram da tela de Manutenções para `src/utils/ordemDeServico.js`, usados pelas duas telas.

## 5. Para a diretora: "Meus chamados"

- O item do menu que levava a um endereço inexistente virou **Meus chamados** (`/diretora/manutencoes`): todos os chamados da escola, com filtros Em aberto / Concluídos / Todos e o botão **Nova solicitação**.
- Cada chamado abre com o andamento: o que o status significa, responsável, prazo previsto, quem abriu e quando, conclusão. (A diretora não vê o histórico completo: as regras reservam isso à administração.)
- O formulário de solicitação virou um componente único (`SolicitarManutencao`), usado no Início e em Meus chamados. Se o envio falhar, o texto digitado não se perde.
- Textos do formulário que estavam em português de Portugal ("o que se avariou", "reparação") foram trocados, e o teste de textos passou a barrar essas palavras.

## 6. "Esqueci minha senha" (M7)

- Link nos dois formulários de login. A pessoa digita o e-mail e o Firebase envia o link para criar uma senha nova, **em português**. Gratuito no plano atual.
- A resposta é sempre a mesma ("Se este e-mail estiver cadastrado, você vai receber..."), para ninguém descobrir quais e-mails têm conta.
- O login passou a explicar falta de internet, excesso de tentativas e conta desativada, em vez de sempre "E-mail ou senha incorretos".
- **Para ajustar o e-mail (opcional, a confirmar):** no console do Firebase, Authentication → Modelos → Redefinição de senha: dá para mudar o nome do remetente e o texto. O idioma já vai em português pelo próprio app.

## 7. Defeito antigo corrigido no caminho

A linha do tempo mostrou "id: — → teste-vitor": **editar qualquer registro gravava um campo `id` dentro do próprio documento**, porque os formulários copiavam o registro inteiro. A camada de gravação (`services/db.js`) passou a descartar esse campo em todas as telas. Registros que já têm o campo continuam funcionando normalmente.

## 8. Como foi verificado

- `npm test`: 53 testes (incluindo competência, responsável e linha do tempo). `npm run test:regras`: 52, todos passando.
- Na tela, no emulador local (14/10/2026): conta com "ABRIL/2025" abrindo em Abril/2025 com o aviso de 13 meses, corrigida e gravada como "Abril/2026"; filtro em ordem de data; chamado do "Vitor" na lista e no detalhe; ligado a um prestador pela edição (vindo do detalhe) e concluído com um clique, com a linha do tempo registrando as duas mudanças; edição sem gravar o campo `id`; diretora vendo "Meus chamados", abrindo uma solicitação e o chamado aparecendo na hora (com o histórico registrado); "Esqueci minha senha" gerando o e-mail no emulador, e a mesma resposta para um e-mail inexistente.
- Não conferido: o envio real do e-mail de redefinição (o emulador só registra o pedido) e a O.S. impressa a partir do detalhe (é o mesmo código da lista, apenas movido).

## 9. Para depois
- **M1:** vários itens num só chamado (checklist) e dividir em várias O.S.
- **M6:** separar tipos de unidade (escola, escritório).
