// Um rótulo curto para identificar um registro no histórico e na lixeira.
// Fica separado de services/db.js para poder ser usado também pela
// importação de planilhas e pelos testes (que rodam fora do navegador).

export const tituloDoRegistro = (dados = {}) => {
  const candidato =
    dados.nome || dados.titulo || dados.descricao || dados.tipoCustomizado ||
    dados.tipo || dados.email || dados.escolaNome || '';
  const texto = String(candidato).replace(/\s+/g, ' ').trim();
  const complemento = dados.escolaNome && candidato !== dados.escolaNome ? ` · ${dados.escolaNome}` : '';
  const completo = `${texto}${complemento}`;
  return completo.length > 90 ? `${completo.slice(0, 90)}…` : completo;
};
