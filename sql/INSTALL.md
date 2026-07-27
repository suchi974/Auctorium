# How to install the database (Auctorium)

> **TL;DR** — Do NOT copy-paste SQL into Workbench / phpMyAdmin. Use the shell:
>
> ```bash
> mysql -u root -p < sql/install.sql
> ```

That single command creates the database, tables, indexes and seed data. Nothing to paste.

---

## 1. What each file does

| File | Purpose | Use when |
|------|---------|----------|
| **`sql/install.sql`** | Drops + recreates everything (schema + seed) in the correct order | Fresh install (recommended) |
| `sql/schema.sql` | Legacy — schema only, no seed | Kept for backward compat |
| `sql/seed.sql`   | Legacy — sample products only | Kept for backward compat |
| `sql/migration.sql` | Adds new columns/indexes to an existing older DB | You already ran the old schema and want to upgrade |

For a first-time setup, **only `install.sql` is needed**.

---

## 2. Recommended install — command line (Windows / Mac / Linux)

Open a **normal terminal** (Command Prompt, PowerShell, Terminal, bash — NOT the `mysql>` prompt), navigate to the project folder, then run:

```bash
mysql -u root -p < sql/install.sql
```

You'll be prompted for the MySQL root password. On success you'll see:
```
status                                          products  categories  sellers  buyers
auction_system database installed successfully  27        20          2        2
```

That's it. The app is ready to run.

### If `mysql` command is not found
- **Windows**: MySQL usually installs at `C:\Program Files\MySQL\MySQL Server 8.0\bin\`. Add that folder to your `PATH`, or run the full path:
  ```bat
  "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p < sql\install.sql
  ```
- **Mac (Homebrew)**: `brew install mysql-client` and follow the PATH hint it prints.
- **Linux**: `sudo apt install mysql-client`.

---

## 3. Alternative — from inside the `mysql>` prompt

If you prefer to stay inside `mysql>`:

```bash
mysql -u root -p
```

then at the `mysql>` prompt:

```sql
SOURCE C:/full/path/to/auction-system/sql/install.sql;
-- Mac/Linux example: SOURCE /Users/you/auction-system/sql/install.sql;
```

Use **forward slashes even on Windows**, and give the FULL absolute path.

---

## 4. MySQL Workbench

1. Open MySQL Workbench and connect to your local instance.
2. **File → Run SQL Script…** → pick `sql/install.sql`.
3. Leave "Default Schema" empty (the script creates its own database).
4. Click **Run**.

⚠ Do NOT open the file, select all, and paste into a query tab. Workbench's paste sometimes drops the delimiter between `CREATE TABLE` statements. Use *Run SQL Script* which reads the file properly.

---

## 5. phpMyAdmin

1. Log in.
2. Click **Import** at the top.
3. Choose file → `sql/install.sql`.
4. Format: **SQL**.
5. Click **Go**.

⚠ Don't paste into the SQL window. Use the **Import** tab — it handles multi-statement files correctly.

---

## 6. Upgrading an existing older database

Only if you had a previous build with the older `notifications` schema:

```bash
mysql -u root -p auction_system < sql/migration.sql
```

If you see errors like `Duplicate column name 'title'` or `Duplicate key name` — those mean the migration was already applied. Safe to ignore.

To be 100% safe, or if the migration errors are confusing, wipe and reinstall:

```bash
mysql -u root -p -e "DROP DATABASE IF EXISTS auction_system;"
mysql -u root -p < sql/install.sql
```

---

## 7. Verifying

```bash
mysql -u root -p -e "USE auction_system; SHOW TABLES;"
```
should list: `admins, bids, buyers, categories, notifications, payments, products, sellers`.

```bash
mysql -u root -p -e "USE auction_system; SELECT COUNT(*) FROM products;"
```
should return `27`.

---

## 8. Demo credentials created by `install.sql`

| Role   | Email                 | Password        |
|--------|-----------------------|-----------------|
| Seller | seller@auction.com    | Password@123    |
| Seller | seller2@auction.com   | Password@123    |
| Buyer  | buyer@auction.com     | Password@123    |
| Buyer  | buyer2@auction.com    | Password@123    |
| Admin  | admin@auction.com     | Password@123    |

Change these in `install.sql` before running in production.

---

## 9. Why pasting was failing (common causes)

1. **Statement splitting in Workbench / phpMyAdmin's query window** — multi-statement pastes sometimes stop at the first empty line, silently skipping later statements.
2. **The previous `migration.sql` used `PREPARE ... EXECUTE stmt`** — some client UIs do not preserve the required session context between statements. That file is now plain SQL.
3. **`seed.sql` alone will fail** because it references seller_id = 1/2 which don't exist yet. Use `install.sql` — it seeds sellers first, then products.
4. **Comments with `--` need a trailing space** in some very old clients. Every `--` in these files is followed by a space.

If you still get an error, copy the **exact** MySQL error message and share it — I'll trace the specific line.
