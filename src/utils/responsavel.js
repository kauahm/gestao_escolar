// Responsável de um chamado de manutenção.
//
// O chamado guarda o identificador do prestador (responsavelId) e também o
// nome (responsavel), que serve de reserva e mantém funcionando os registros
// antigos, criados quando só o nome era gravado.

export const A_DEFINIR = 'A definir';

/** O prestador do chamado: pelo identificador; nos registros antigos, pelo nome. */
export const prestadorDoChamado = (chamado, prestadores = []) => {
  if (!chamado) return null;
  if (chamado.responsavelId) {
    const porId = prestadores.find((p) => p.id === chamado.responsavelId);
    if (porId) return porId;
  }
  const nome = chamado.responsavel;
  if (!nome || nome === A_DEFINIR) return null;
  return prestadores.find((p) => p.nome === nome) || null;
};

/** Nome atual do responsável (acompanha mudanças no cadastro do prestador). */
export const nomeDoResponsavel = (chamado, prestadores = []) =>
  prestadorDoChamado(chamado, prestadores)?.nome || chamado?.responsavel || A_DEFINIR;

/** Há um nome de responsável que não corresponde a nenhum prestador cadastrado. */
export const responsavelNaoCadastrado = (chamado, prestadores = []) =>
  Boolean(chamado?.responsavel && chamado.responsavel !== A_DEFINIR && !prestadorDoChamado(chamado, prestadores));
