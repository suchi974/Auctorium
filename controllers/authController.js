const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

const tableFor = (role) => (role === 'seller' ? 'sellers' : 'buyers');

function signToken(user, role) {
  return jwt.sign(
    { id: user.id, role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register  { name, email, password, phone, role: 'seller'|'buyer' }
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'name, email, password and role are required' });
    }
    if (!['seller', 'buyer'].includes(role)) {
      return res.status(400).json({ message: "role must be 'seller' or 'buyer'" });
    }

    const table = tableFor(role);
    const [existing] = await db.query(`SELECT id FROM ${table} WHERE email = ?`, [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `INSERT INTO ${table} (name, email, password, phone) VALUES (?, ?, ?, ?)`,
      [name, email, hashed, phone || null]
    );

    const user = { id: result.insertId, email };
    const token = signToken(user, role);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { id: user.id, name, email, role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// POST /api/auth/login  { email, password, role }
exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ message: 'email, password and role are required' });
    }

    const table = tableFor(role);
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE email = ?`, [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = rows[0];
    if (user.is_blocked) {
      return res.status(403).json({ message: 'This account has been blocked by admin' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signToken(user, role);
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during login' });
  }
};
