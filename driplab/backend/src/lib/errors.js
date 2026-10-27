'use strict';
class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
const E = {
  badRequest: (m = 'Requisição inválida', d) => new HttpError(400, 'BAD_REQUEST', m, d),
  unauthorized: (m = 'Autenticação necessária') => new HttpError(401, 'UNAUTHORIZED', m),
  forbidden: (m = 'Você não tem permissão para isso', code = 'FORBIDDEN') => new HttpError(403, code, m),
  notFound: (what = 'Recurso') => new HttpError(404, 'NOT_FOUND', `${what} não encontrado(a)`),
  conflict: (m, code = 'CONFLICT') => new HttpError(409, code, m),
  invalid: (m = 'Dados inválidos', d) => new HttpError(422, 'VALIDATION_ERROR', m, d),
  rule: (m, code) => new HttpError(422, code, m), // violação de regra de negócio
};
module.exports = { HttpError, E };
