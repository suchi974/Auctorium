const db = require('../config/db');

function parseNotification(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    user_type: row.user_type,
    title: row.title,
    message: row.message,
    type: row.type,
    data: (() => {
      if (!row.data) return null;
      if (typeof row.data === 'object') return row.data; // MySQL2 already parsed JSON
      try { return JSON.parse(row.data); } catch (_) { return null; }
    })(),
    is_read: !!row.is_read,
    created_at: row.created_at,
  };
}

// GET /api/notifications
exports.list = async (req, res) => {
  const [rows] = await db.query(
    `SELECT * FROM notifications
     WHERE user_id = ? AND user_type = ?
       AND NOT (user_type = 'buyer' AND title = 'New Auction Available')
       AND NOT (user_type = 'seller' AND title = 'New highest bid')
     ORDER BY created_at DESC
     LIMIT 100`,
    [req.user.id, req.user.role]
  );
  res.json(rows.map(parseNotification));
};

// GET /api/notifications/unread-count
exports.unreadCount = async (req, res) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS n FROM notifications
     WHERE user_id = ? AND user_type = ? AND is_read = 0
       AND NOT (user_type = 'seller' AND title = 'New highest bid')`,
    [req.user.id, req.user.role]
  );
  res.json({ count: rows[0].n });
};

// POST /api/notifications/:id/read
exports.markRead = async (req, res) => {
  await db.query(
    `UPDATE notifications SET is_read = 1
     WHERE id = ? AND user_id = ? AND user_type = ?`,
    [req.params.id, req.user.id, req.user.role]
  );
  res.json({ ok: true });
};

// POST /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  await db.query(
    `UPDATE notifications SET is_read = 1
     WHERE user_id = ? AND user_type = ? AND is_read = 0`,
    [req.user.id, req.user.role]
  );
  res.json({ ok: true });
};

// DELETE /api/notifications/:id
exports.remove = async (req, res) => {
  const [result] = await db.query(
    'DELETE FROM notifications WHERE id = ? AND user_id = ? AND user_type = ?',
    [req.params.id, req.user.id, req.user.role]
  );
  if (!result.affectedRows) return res.status(404).json({ message: 'Notification not found' });
  res.json({ ok: true });
};

// DELETE /api/notifications
exports.clear = async (req, res) => {
  await db.query(
    'DELETE FROM notifications WHERE user_id = ? AND user_type = ?',
    [req.user.id, req.user.role]
  );
  res.json({ ok: true });
};
