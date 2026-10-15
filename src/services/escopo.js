// Município ativo: de qual município são os dados que as telas leem e gravam.
//
// - Administração, RH e diretora: o município do próprio perfil (fixo).
// - Sede: o município que ela escolheu na Visão da sede (ou nenhum, quando
//   está vendo todos).
//
// Quem define é o AuthContext. As consultas (services/consulta.js) filtram por
// ele, e a camada de gravação (services/db.js) carimba o município em tudo o
// que é criado. As regras do Firestore conferem as duas coisas.
// Ver docs/22-acesso-por-municipio.md.
//
// Este arquivo não importa o Firebase de propósito: também é usado na
// importação de planilhas e nos testes, que rodam fora do navegador.

let atual = null;

export const municipioAtivo = () => atual;

export const definirMunicipioAtivo = (id) => {
  atual = id || null;
};

/** Coleções em que cada registro pertence a um município (campo municipioId). */
export const COLECOES_DO_MUNICIPIO = new Set([
  'escolas', 'manutencoes', 'contas', 'ciclos', 'prestadores', 'eventos',
  'curriculos', 'candidatos', 'funcionarios', 'rubricas', 'gastos', 'contratos',
  'usuarios', 'historico', 'lixeira', 'importacoes',
]);

/** Acrescenta o município ativo aos dados de um registro novo (se ainda não tiver). */
export const comMunicipio = (colecao, dados) => {
  if (!COLECOES_DO_MUNICIPIO.has(colecao) || !atual || !dados || dados.municipioId) return dados;
  return { ...dados, municipioId: atual };
};
