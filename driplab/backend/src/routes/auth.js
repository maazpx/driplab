'use strict';
const { created } = require('../lib/router');
const { E } = require('../lib/errors');
const { validate } = require('../lib/validate');
const { hashPassword, verifyPassword, DUMMY_HASH, signJwt, randomCode } = require('../lib/security');
const { toDb } = require('../lib/dates');
const { award, XP } = require('../services/gamification');
const { userView } = require('../services/presenters');

const PASSWORD_RULE = { type: 'string', required: true, min: 8, max: 72, pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, patternMsg: 'use letras e números' };

module.exports = router => {
  router.post('/api/auth/register', { rateLimit: 'auth' }, async ({ db, config, body }) => {
    const d = validate(body, {
      name: { type: 'string', required: true, min: 2, max: 100 },
      email: { type: 'email', required: true, max: 160 },
      password: PASSWORD_RULE,
      referral_code: { type: 'string', max: 12 },
    });
    const hash = await hashPassword(d.password);
    const result = await db.tx(async t => {
      let referrer = null;
      if (d.referral_code) {
        referrer = await t.get('SELECT id FROM users WHERE referral_code = ?', [d.referral_code.toUpperCase()]);
        if (!referrer) throw E.invalid('Dados inválidos', { referral_code: 'código de indicação não existe' });
      }
      if (await t.get('SELECT id FROM users WHERE email = ?', [d.email])) throw E.conflict('Este e-mail já está cadastrado', 'EMAIL_TAKEN');
      let id;
      for (let tries = 0; ; tries++) {
        try {
          ({ insertId: id } = await t.run(
            'INSERT INTO users (name, email, password_hash, role, xp, referral_code, referred_by, created_at) VALUES (?,?,?,?,?,?,?,?)',
            [d.name, d.email, hash, 'user', 0, randomCode(8), referrer ? referrer.id : null, toDb(new Date())]));
          break;
        } catch (e) {
          if (e.isDuplicate && tries < 5) {
            if (await t.get('SELECT id FROM users WHERE email = ?', [d.email])) throw E.conflict('Este e-mail já está cadastrado', 'EMAIL_TAKEN');
            continue; 
          }
          throw e;
        }
      }
      const gamification = await award(t, id, XP.REGISTER, 'register', 'Boas-vindas à DripLab');
      if (referrer) await award(t, referrer.id, XP.REFERRAL, 'referral', `Indicou ${d.name}`, id);
      return { id, gamification };
    });
    const user = await userView(db, await db.get('SELECT * FROM users WHERE id = ?', [result.id]));
    const token = signJwt({ sub: user.id, role: user.role }, config.jwtSecret, config.jwtExpiresSeconds);
    return created({ token, user, gamification: result.gamification });
  });

  router.post('/api/auth/login', { rateLimit: 'auth' }, async ({ db, config, body }) => {
    const d = validate(body, { email: { type: 'email', required: true }, password: { type: 'string', required: true, max: 200 } });
    const row = await db.get('SELECT * FROM users WHERE email = ?', [d.email]);
    const ok = await verifyPassword(d.password, row ? row.password_hash : DUMMY_HASH);
    if (!row || !ok) throw new (require('../lib/errors').HttpError)(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos');
    const token = signJwt({ sub: row.id, role: row.role }, config.jwtSecret, config.jwtExpiresSeconds);
    return { token, user: await userView(db, row) };
  });

  router.get('/api/auth/me', { auth: 'user' }, async ({ db, user }) => userView(db, user));
};
