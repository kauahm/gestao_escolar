# Auditoria de segurança e infraestrutura do 1.0

> Inspeção feita em 13/10/2026, **somente leitura**, no console do Firebase (projeto `gestaoescolar-b84c2`) e no histórico do Git do projeto. Nada foi alterado, apagado ou criado.
> Nenhum valor secreto nem e-mail de pessoa foi copiado para este documento.
> Voltar ao índice: [README](README.md) · Relacionado: [06 Roadmap](06-funcionalidades-e-roadmap.md) · [07 Requisitos legais e técnicos](07-requisitos-legais-e-tecnicos.md)

Itens marcados **(a confirmar)** são inferências que não consegui verificar pelo console.

---

## 1. Resumo em 30 segundos

| Tema | Situação | Gravidade |
|---|---|---|
| Regras do Firestore | **Existem e são razoáveis** (negam por padrão, separam admin / diretora / administrativo e limitam a diretora à própria escola). Há uma brecha: `prestadores` aberta a qualquer conta logada | Média/Alta |
| Backup | **Não existe nenhum backup automático.** Recuperação pontual e backups agendados exigem upgrade de plano | **Alta** (é o medo da sua mãe) |
| Storage (fotos e anexos) | **Não está ativado** (exige upgrade). Hoje o sistema não consegue guardar foto nem boleto | Alta para o roadmap |
| Autenticação | 6 contas, todas e-mail/senha, sem MFA visível | Média |
| `.env` no Git | `.env` está versionado e no histórico (3 commits), mas contém **só a configuração pública do Firebase Web** | Baixa |
| Plano | Spark (gratuito) | Informativo |

**Conclusão:** a base de permissões é melhor do que eu supunha ao ler o código. O que realmente impede a adoção é a **ausência de rede de segurança para os dados**, e isso só se resolve saindo do plano gratuito.

---

## 2. Regras de segurança do Firestore

Estão publicadas no console (não no repositório; veja 2.3). Última publicação: **04/05/2026**, com 7 versões no histórico desde 17/04/2026.

### 2.1 O que está bem feito
- **Nega por padrão:** coleção sem `match` fica inacessível.
- **Funções reutilizáveis** (`isAdmin`, `isDiretora`, `isAdministrativo`, `isAtiva`, `minhaEscola`) deixam a leitura simples.
- **Diretora só enxerga a própria escola** em `manutencoes`, `contas` e `ciclos` (compara `unidadeId` do perfil com o `escolaId` do documento).
- **Conta inativa perde acesso** (`isAtiva`).
- **`usuarios`:** cada um lê só o próprio perfil; só admin cria/edita; **apagar é proibido** (`delete: if false`).
- **Candidatos, eventos e currículos** restritos a perfis certos.

### 2.2 Problemas encontrados

| # | Achado | Risco | Correção proposta |
|---|---|---|---|
| R1 | `prestadores`: `allow read, write: if request.auth != null`. **Qualquer conta autenticada** (inclusive uma diretora) lê, altera e apaga todos os prestadores (nomes, telefones, possivelmente CPF/CNPJ). Se o cadastro público por e-mail/senha estiver ligado (padrão do Firebase, **a confirmar**), até alguém de fora poderia criar uma conta e entrar nessa regra | Média/Alta. Hoje a coleção está **vazia** no banco, então o risco é latente | Trocar por `isAdmin() && isAtiva()` e fechar o cadastro público (bloquear *sign-up* ou usar funções de bloqueio) |
| R2 | A diretora pode **criar** `manutencoes` com **qualquer campo** (a regra só confere `escolaId`). Pode, por exemplo, já criar o chamado como "concluído" ou com texto gigante | Média (integridade dos dados) | Validar campos no `create` (status inicial fixo, tamanhos máximos, campos permitidos) |
| R3 | Cada acesso faz um `get()` no perfil do usuário: **1 leitura extra por operação** e limite de 10 `get()` por avaliação. Pesa na cota gratuita (50 mil leituras/dia) e na conta futura | Média (custo e escala) | Mover o perfil para *custom claims* (item 0.3 do roadmap) |
| R4 | Inconsistência: admin **lê** `manutencoes` sem checar `isAtiva`; nas outras coleções checa. Admin desativado ainda leria chamados | Baixa | Padronizar `isAtiva` em todas as regras |
| R5 | Currículos (dados pessoais de candidatos) dependem só do perfil; sem trilha de quem acessou | Média (LGPD) | Registrar acessos e definir prazo de retenção ([07](07-requisitos-legais-e-tecnicos.md)) |

### 2.3 Regras fora do controle de versão
O arquivo `firestore.rules` do projeto **não contém regras**: é a configuração do Firebase Web (veja 5). As regras reais vivem só no console. **Risco:** alguém edita no console e ninguém vê; não há revisão nem como voltar. **Proposta:** guardar as regras em `firestore.rules` de verdade, com `firebase.json`, e publicar pela CLI.

---

## 3. Backup e recuperação de dados

O console mostra, na aba *Recuperação de desastres*: **"Faça upgrade do plano para editar a recuperação pontual e os backups programados"**. Ou seja:

- **Backup agendado:** indisponível no plano atual.
- **Recuperação pontual (PITR):** indisponível no plano atual.
- **Importar/exportar gerenciado:** existe como serviço do Google Cloud, mas leva para o Google Cloud e normalmente exige faturamento ativo **(a confirmar)**.

**Hoje, se alguém apagar uma coleção ou a regra permitir uma alteração em massa, não há como voltar.** A preocupação da sua mãe é real e correta.

### Proposta (reforça o item 0.9 do roadmap)
1. Passar o projeto do 2.0 para o plano **Blaze** (pagamento por uso) **com alerta de orçamento e teto**, mantendo as mesmas cotas gratuitas **(a confirmar valores atuais)**.
2. Ativar **recuperação pontual** e **backup diário agendado** do Firestore.
3. No app: **lixeira com restauração** (arquivar em vez de apagar), **histórico de alterações** e **exportar tudo para Excel**.
4. Mostrar para a usuária um aviso simples: "Último backup: hoje, 03:00".

---

## 4. Storage e funções na nuvem

- **Storage está desativado**: a tela pede upgrade do projeto. Consequência: o sistema **não guarda fotos de chamado nem boletos/notas**, funcionalidades centrais da demonstração ([06](06-funcionalidades-e-roadmap.md)).
- *Cloud Functions* (criar usuário com segurança, *custom claims*, lembretes) também dependem do upgrade **(a confirmar)**.

**Decisão necessária:** o 2.0 precisa do Blaze. É a mesma decisão que destrava backup, fotos e funções. Recomendo configurar **orçamento mensal com alerta** antes de ligar qualquer recurso.

---

## 5. Autenticação

- **6 contas**, todas com provedor **e-mail/senha**. Criadas entre 17/04 e 27/08/2026; os últimos acessos são todos de 2026.
- Nenhum provedor corporativo (Google/Microsoft) e **nenhum MFA visível**. MFA no Firebase depende de ajustes que podem exigir upgrade **(a confirmar)**.
- A tela de configurações só mostrou vinculação de contas por e-mail; **não consegui verificar se o cadastro público está aberto** (ver R1).
- O console sugere configurar o **App Check** (proteção contra uso abusivo); aparenta **não estar ativo (a confirmar)**.

**Proposta:** fechar o cadastro público; MFA para administradores; avaliar login com conta Google da AEMC; App Check; política de senha e recuperação de acesso para a diretora.

---

## 6. `.env` e histórico do Git

Verificado reconstruindo o repositório a partir do histórico local, **sem exibir valores**:

- O repositório **não tem `.gitignore`**.
- O `.env` está **versionado** e aparece em **3 commits** (17/04 a 24/04/2026); o histórico tem 25 commits.
- O `.env` contém apenas **6 variáveis `VITE_FIREBASE_*`** (chave de API, domínio, id do projeto, bucket, id do remetente, id do app) e nenhum outro segredo.
- O código lê tudo de `import.meta.env`; não há chave escrita no código-fonte. A mesma configuração aparece também no arquivo `firestore.rules` (que é, na verdade, a configuração do Firebase Web).

**Avaliação:** a configuração web do Firebase **não é segredo**: ela é entregue a qualquer visitante dentro do JavaScript do site. Por isso, **não é preciso trocar chaves nem reescrever o histórico**. A segurança vem das **regras** e do App Check, não de esconder esses valores. Se o repositório é público ou privado **não verifiquei (a confirmar)**.

**Boas práticas ainda recomendadas:**
1. Criar `.gitignore` (incluindo `.env`, `node_modules`, `dist`) e um `.env.example` sem valores.
2. Remover `.env` do controle de versão daqui para frente (`git rm --cached .env`).
3. No Google Cloud, **restringir a chave de API por domínio** (referrer) e às APIs necessárias.
4. Para o 2.0, **não** reaproveitar o projeto: criar projeto novo com `.gitignore` desde o primeiro commit.
5. Qualquer segredo futuro (chaves de WhatsApp, e-mail, Admin SDK) fica **só em variáveis do servidor**, nunca no front-end.

---

## 7. Plano e uso

- Plano **Spark** ("sem custos"). Análise (Analytics) sem dados.
- Coleções com dados no Firestore: `ciclos`, `contas`, `escolas`, `eventos`, `manutencoes`, `usuarios`. **`prestadores`, `curriculos` e `candidatos` não aparecem** (vazias ou nunca usadas).
- Como o conteúdo é de teste, **nada precisa ser migrado**: o 2.0 pode nascer em projeto novo e o 1.0 fica intacto até a troca.

---

## 8. Ações priorizadas

| Prioridade | Ação | Onde entra no roadmap |
|---|---|---|
| 1 | Decidir a ida para o **Blaze com teto de orçamento** | Pré-requisito de 0.9, fotos e funções |
| 2 | Corrigir **R1** (prestadores) e **R2** (validação de campos) nas regras do 1.0 e do 2.0 | 0.1 |
| 3 | **Fechar cadastro público**, MFA para admin, App Check | 0.3 |
| 4 | Regras no repositório + publicação por CLI | 0.1 |
| 5 | `.gitignore` e `.env.example`; restringir chave de API por domínio | 0.4 |
| 6 | Backup diário, PITR, lixeira, histórico, exportar Excel | 0.9 |
| 7 | *Custom claims* no lugar do `get()` | 0.3 |

*Limites desta auditoria:* não testei as regras com o simulador do console, não vi o conteúdo de documentos de pessoas e não acessei o Google Cloud (faturamento, chaves de API, restrições). Isso fica para quando o 2.0 for configurado.
