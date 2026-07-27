const db = require('./config/db');

(async () => {
  const [products] = await db.query('SELECT id, name, category_id, status FROM products ORDER BY category_id, id LIMIT 50');
  console.log('Products in database:');
  products.forEach(p => {
    console.log(`  [${p.id}] ${p.name} (Category ${p.category_id}, Status: ${p.status})`);
  });
  process.exit(0);
})();
