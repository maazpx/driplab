'use strict';
const { created, noContent } = require('../lib/router');
const { E } = require('../lib/errors');
const { validate, intParam } = require('../lib/validate');
const { toDb, iso, parseDb } = require('../lib/dates');
const { award, XP } = require('../services/gamification');

const POLL = {
  title: { type: 'string', required: true, min: 3, max: 160 },
  description: { type: 'string', max: 255, nullable: true },
  starts_at: { type: 'datetime', required: true },
  ends_at: { type: 'datetime', required: true },
  min_level: { type: 'int', min: 1, max: 10, default: 1 },
};
const OPTION = {
  label: { type: 'string', required: true, min: 1, max: 80 },
  description: { type: 'string', max: 255, nullable: true },
};

function pollStatus(row, now = new Date()) {
  if (now < parseDb(row.starts_at)) return 'upcoming';
  if (now >= parseDb(row.ends_at)) return 'ended';
  return 'open';
}

async function pollView(db, row, user) {
  const opts = await db.all('SELECT option_id AS id, label, description, votes FROM v_poll_results WHERE poll_id = ? ORDER BY option_id', [row.id]);
  const total = opts.reduce((s, o) => s + Number(o.votes), 0);
  const mine = user ? await db.get('SELECT option_id FROM votes WHERE poll_id = ? AND user_id = ?', [row.id, user.id]) : null;
  return {
    id: row.id, title: row.title, description: row.description,
    starts_at: iso(row.starts_at), ends_at: iso(row.ends_at), min_level: row.min_level,
    status: pollStatus(row), total_votes: total,
    options: opts.map(o => ({ id: o.id, label: o.label, description: o.description, votes: Number(o.votes), percent: total ? Math.round((Number(o.votes) / total) * 100) : 0 })),
    my_vote: mine ? mine.option_id : null,
    server_time: new Date().toISOString(),
  };
}

module.exports = router => {
  router.get('/api/polls', { auth: 'optional' }, async ({ db, user, query }) => {
    const rows = await db.all('SELECT * FROM polls ORDER BY ends_at DESC');
    let list = await Promise.all(rows.map(r => pollView(db, r, user)));
    if (query.get('status')) list = list.filter(p => p.status === query.get('status'));
    return list;
  });

  router.get('/api/polls/current', { auth: 'optional' }, async ({ db, user }) => {
    const now = toDb(new Date());
    const row =
      await db.get('SELECT * FROM polls WHERE starts_at <= ? AND ends_at > ? ORDER BY ends_at ASC LIMIT 1', [now, now]) ||
      await db.get('SELECT * FROM polls ORDER BY ends_at DESC LIMIT 1');
    if (!row) throw E.notFound('Votação');
    return pollView(db, row, user);
  });

  router.get('/api/polls/:id', { auth: 'optional' }, async ({ db, user, params }) => {
    const row = await db.get('SELECT * FROM polls WHERE id = ?', [intParam(params.id, 'Votação')]);
    if (!row) throw E.notFound('Votação');
    return pollView(db, row, user);
  });

  router.post('/api/polls', { auth: 'admin' }, async ({ db, user, body }) => {
    const d = validate(body, POLL);
    if (d.ends_at <= d.starts_at) throw E.invalid('Dados inválidos', { ends_at: 'deve ser depois do início' });
    if (!Array.isArray(body.options) || body.options.length < 2 || body.options.length > 8) {
      throw E.invalid('Dados inválidos', { options: 'envie de 2 a 8 opções' });
    }
    const options = body.options.map(o => validate(o, OPTION));
    const id = await db.tx(async t => {
      const { insertId } = await t.run('INSERT INTO polls (title, description, starts_at, ends_at, min_level, created_at) VALUES (?,?,?,?,?,?)',
        [d.title, d.description ?? null, toDb(d.starts_at), toDb(d.ends_at), d.min_level, toDb(new Date())]);
      for (const o of options) await t.run('INSERT INTO poll_options (poll_id, label, description) VALUES (?,?,?)', [insertId, o.label, o.description ?? null]);
      return insertId;
    });
    return created(await pollView(db, await db.get('SELECT * FROM polls WHERE id = ?', [id]), user));
  });

  router.put('/api/polls/:id', { auth: 'admin' }, async ({ db, user, params, body }) => {
    const id = intParam(params.id, 'Votação');
    const d = validate(body, POLL, { partial: true });
    const cur = await db.get('SELECT * FROM polls WHERE id = ?', [id]);
    if (!cur) throw E.notFound('Votação');
    if ((d.ends_at || parseDb(cur.ends_at)) <= (d.starts_at || parseDb(cur.starts_at))) throw E.invalid('Dados inválidos', { ends_at: 'deve ser depois do início' });
    const sets = []; const vals = [];
    for (const [k, v] of Object.entries(d)) { sets.push(`${k} = ?`); vals.push(v instanceof Date ? toDb(v) : v); }
    if (sets.length) await db.run(`UPDATE polls SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
    return pollView(db, await db.get('SELECT * FROM polls WHERE id = ?', [id]), user);
  });

  router.delete('/api/polls/:id', { auth: 'admin' }, async ({ db, params }) => {
    const id = intParam(params.id, 'Votação');
    if (!await db.get('SELECT id FROM polls WHERE id = ?', [id])) throw E.notFound('Votação');
    await db.run('DELETE FROM polls WHERE id = ?', [id]);
    return noContent();
  });

  // ---- opções ----
  router.post('/api/polls/:id/options', { auth: 'admin' }, async ({ db, user, params, body }) => {
    const id = intParam(params.id, 'Votação');
    const d = validate(body, OPTION);
    if (!await db.get('SELECT id FROM polls WHERE id = ?', [id])) throw E.notFound('Votação');
    await db.run('INSERT INTO poll_options (poll_id, label, description) VALUES (?,?,?)', [id, d.label, d.description ?? null]);
    return created(await pollView(db, await db.get('SELECT * FROM polls WHERE id = ?', [id]), user));
  });

  router.put('/api/polls/:id/options/:optionId', { auth: 'admin' }, async ({ db, user, params, body }) => {
    const id = intParam(params.id, 'Votação'); const oid = intParam(params.optionId, 'Opção');
    const d = validate(body, OPTION, { partial: true });
    if (!await db.get('SELECT id FROM poll_options WHERE id = ? AND poll_id = ?', [oid, id])) throw E.notFound('Opção');
    const keys = Object.keys(d);
    if (keys.length) await db.run(`UPDATE poll_options SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map(k => d[k]), oid]);
    return pollView(db, await db.get('SELECT * FROM polls WHERE id = ?', [id]), user);
  });

  router.delete('/api/polls/:id/options/:optionId', { auth: 'admin' }, async ({ db, params }) => {
    const id = intParam(params.id, 'Votação'); const oid = intParam(params.optionId, 'Opção');
    if (!await db.get('SELECT id FROM poll_options WHERE id = ? AND poll_id = ?', [oid, id])) throw E.notFound('Opção');
    if ((await db.get('SELECT COUNT(*) AS n FROM votes WHERE option_id = ?', [oid])).n > 0) throw E.conflict('A opção já recebeu votos', 'OPTION_HAS_VOTES');
    if ((await db.get('SELECT COUNT(*) AS n FROM poll_options WHERE poll_id = ?', [id])).n <= 2) throw E.rule('Uma votação precisa de ao menos 2 opções', 'MIN_OPTIONS');
    await db.run('DELETE FROM poll_options WHERE id = ?', [oid]);
    return noContent();
  });

  //voto1 por usuario, so com a votaçao aberta e nivel suficiente
  router.post('/api/polls/:id/vote', { auth: 'user' }, async ({ db, user, params, body }) => {
    const id = intParam(params.id, 'Votação');
    const d = validate(body, { option_id: { type: 'int', required: true, min: 1 } });
    const poll = await db.get('SELECT * FROM polls WHERE id = ?', [id]);
    if (!poll) throw E.notFound('Votação');
    const status = pollStatus(poll);
    if (status === 'upcoming') throw E.rule('Esta votação ainda não começou', 'POLL_NOT_STARTED');
    if (status === 'ended') throw E.rule('Esta votação já foi encerrada', 'POLL_ENDED');
    if (user.level_number < poll.min_level) throw E.rule(`Esta votação exige nível ${poll.min_level}`, 'LEVEL_TOO_LOW');
    if (!await db.get('SELECT id FROM poll_options WHERE id = ? AND poll_id = ?', [d.option_id, id])) {
      throw E.invalid('Dados inválidos', { option_id: 'opção não pertence a esta votação' });
    }
    let gamification;
    try {
      gamification = await db.tx(async t => {
        const { insertId } = await t.run('INSERT INTO votes (poll_id, option_id, user_id, created_at) VALUES (?,?,?,?)', [id, d.option_id, user.id, toDb(new Date())]);
        return award(t, user.id, XP.VOTE, 'vote', `Voto: ${poll.title}`, insertId);
      });
    } catch (e) {
      if (e.isDuplicate) throw E.conflict('Você já votou nesta votação', 'ALREADY_VOTED');
      throw e;
    }
    return { poll: await pollView(db, poll, user), gamification };
  });
};
