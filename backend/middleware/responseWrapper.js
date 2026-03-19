/**
 * Response wrapper middleware for consistent API envelope.
 * Adds res.ok(data, meta) and res.fail(status, message, code) helpers.
 *
 * Envelope format:
 * { success: bool, data: any, error: { message, code } | null, meta: object | null }
 */
export function responseWrapper(req, res, next) {
  res.ok = (data, meta = null) => {
    res.json({ success: true, data, error: null, meta });
  };

  res.fail = (status, message, code = null) => {
    res.status(status).json({
      success: false,
      data: null,
      error: { message, code: code || `ERR_${status}` },
      meta: null,
    });
  };

  next();
}

/**
 * Pagination helper. Returns { rows, meta } for paginated queries.
 * @param {import('better-sqlite3').Database} db
 * @param {string} countSql - SQL that returns { total } (single row)
 * @param {string} dataSql - SQL with LIMIT ? OFFSET ? at the end
 * @param {Array} params - Bind params (excluding limit/offset)
 * @param {object} query - req.query with page/limit
 */
export function paginate(db, countSql, dataSql, params, query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50));
  const offset = (page - 1) * limit;

  const { total } = db.prepare(countSql).get(...params);
  const rows = db.prepare(dataSql).all(...params, limit, offset);

  return {
    rows,
    meta: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}
