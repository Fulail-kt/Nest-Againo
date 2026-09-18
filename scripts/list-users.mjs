import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query(`
  SELECT
    id,
    email,
    name,
    role,
    status,
    "gymId",
    "shopId",
    phone,
    ("emailVerifiedAt" IS NOT NULL) AS verified,
    ("googleId" IS NOT NULL) AS google,
    "createdAt"
  FROM "User"
  ORDER BY id
`);
console.table(rows);
await client.end();
