import { Router } from 'express';
import { pool } from '../../utils/db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.get('/', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const result = await pool.query(`SELECT * FROM UserBadges WHERE user_id = $1 ORDER BY earned_at DESC`, [userId]);
    return res.json(result.rows);
  } catch (err) { next(err); }
});

router.post('/', authRequired, async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const result = await pool.query('SELECT * FROM check_and_award_badges($1)', [userId]);
    return res.json({ message: 'Badge check complete', new_badges: result.rows });
  } catch (err) { next(err); }
});

export default router;
