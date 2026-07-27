const db = require('./config/db');

(async () => {
  const [cats] = await db.query('SELECT COUNT(*) as count FROM categories');
  const [prods] = await db.query('SELECT COUNT(*) as count FROM products');
  const [bids] = await db.query('SELECT COUNT(*) as count FROM bids');
  console.log(`Categories: ${cats[0].count}`);
  console.log(`Products: ${prods[0].count}`);
  console.log(`Bids: ${bids[0].count}`);
  process.exit(0);
})();
