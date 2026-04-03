/**
 * Catalogue Manager Service
 * Requirements: 9.1–9.8
 * Properties: 25, 26, 27, 28
 */

import { pool } from '../../db/client.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  stockQuantity: number;
  category: string | null;
  imageUrls: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface ProductFilters {
  name?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

export interface PromoCombo {
  id: string;
  businessId: string;
  name: string;
  promoPrice: number;
  currency: string;
  isActive: boolean;
  productIds: string[];
  createdAt: Date;
}

export interface CarouselItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  imageUrls: string[];
  isCombo: boolean;
}

export interface CsvImportResult {
  imported: number;
  errors: Array<{ row: number; reason: string }>;
}

export interface ProductRevenue {
  productId: string;
  unitsSold: number;
  totalRevenue: number;
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

interface ProductRow {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  stock_quantity: number;
  category: string | null;
  image_urls: string[] | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date | null;
}

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    currency: row.currency,
    stockQuantity: row.stock_quantity,
    category: row.category,
    imageUrls: row.image_urls ?? [],
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Task 8.1: Product CRUD ───────────────────────────────────────────────────

export async function createProduct(
  businessId: string,
  data: {
    name: string;
    description?: string;
    price: number;
    currency: string;
    stockQuantity: number;
    category?: string;
    imageUrls?: string[];
  },
): Promise<Product> {
  const result = await pool.query<ProductRow>(
    `INSERT INTO products (business_id, name, description, price, currency, stock_quantity, category, image_urls)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      businessId,
      data.name,
      data.description ?? null,
      data.price,
      data.currency,
      data.stockQuantity,
      data.category ?? null,
      data.imageUrls ?? [],
    ],
  );
  return rowToProduct(result.rows[0]);
}

export async function getProduct(businessId: string, productId: string): Promise<Product | null> {
  const result = await pool.query<ProductRow>(
    `SELECT * FROM products WHERE id = $1 AND business_id = $2`,
    [productId, businessId],
  );
  return result.rows.length > 0 ? rowToProduct(result.rows[0]) : null;
}

export async function updateProduct(
  businessId: string,
  productId: string,
  data: Partial<{
    name: string;
    description: string;
    price: number;
    currency: string;
    stockQuantity: number;
    category: string;
    imageUrls: string[];
    isActive: boolean;
  }>,
): Promise<Product | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
  if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
  if (data.price !== undefined) { fields.push(`price = $${idx++}`); values.push(data.price); }
  if (data.currency !== undefined) { fields.push(`currency = $${idx++}`); values.push(data.currency); }
  if (data.stockQuantity !== undefined) { fields.push(`stock_quantity = $${idx++}`); values.push(data.stockQuantity); }
  if (data.category !== undefined) { fields.push(`category = $${idx++}`); values.push(data.category); }
  if (data.imageUrls !== undefined) { fields.push(`image_urls = $${idx++}`); values.push(data.imageUrls); }
  if (data.isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.isActive); }

  if (fields.length === 0) return getProduct(businessId, productId);

  fields.push(`updated_at = NOW()`);
  values.push(productId, businessId);

  const result = await pool.query<ProductRow>(
    `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx++} AND business_id = $${idx} RETURNING *`,
    values,
  );
  return result.rows.length > 0 ? rowToProduct(result.rows[0]) : null;
}

export async function deleteProduct(businessId: string, productId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM products WHERE id = $1 AND business_id = $2`,
    [productId, businessId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Task 8.2: Out-of-Stock Enforcement (Property 25) ────────────────────────

/**
 * Returns only in-stock products for a business.
 * Property 25: stock_quantity=0 products must never appear.
 */
export async function getInStockProducts(businessId: string): Promise<Product[]> {
  const result = await pool.query<ProductRow>(
    `SELECT * FROM products
     WHERE business_id = $1 AND stock_quantity > 0 AND is_active = TRUE
     ORDER BY name`,
    [businessId],
  );
  return result.rows.map(rowToProduct);
}

// ─── Task 8.3: Product Search and Filter (Property 26) ───────────────────────

/**
 * Search and filter products for a business.
 * Property 26: every result satisfies all applied filters; no matching product absent.
 */
export async function searchProducts(
  businessId: string,
  filters: ProductFilters,
): Promise<Product[]> {
  const conditions: string[] = ['business_id = $1'];
  const values: unknown[] = [businessId];
  let idx = 2;

  if (filters.name !== undefined && filters.name !== '') {
    conditions.push(`name ILIKE $${idx++}`);
    values.push(`%${filters.name}%`);
  }
  if (filters.category !== undefined && filters.category !== '') {
    conditions.push(`category ILIKE $${idx++}`);
    values.push(`%${filters.category}%`);
  }
  if (filters.minPrice !== undefined) {
    conditions.push(`price >= $${idx++}`);
    values.push(filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    conditions.push(`price <= $${idx++}`);
    values.push(filters.maxPrice);
  }
  if (filters.inStock === true) {
    conditions.push(`stock_quantity > 0`);
  } else if (filters.inStock === false) {
    conditions.push(`stock_quantity = 0`);
  }

  const result = await pool.query<ProductRow>(
    `SELECT * FROM products WHERE ${conditions.join(' AND ')} ORDER BY name`,
    values,
  );
  return result.rows.map(rowToProduct);
}

// ─── Task 8.4: Promotional Combos ────────────────────────────────────────────

export async function createCombo(
  businessId: string,
  data: {
    name: string;
    promoPrice: number;
    currency: string;
    productIds: string[];
  },
): Promise<PromoCombo> {
  if (data.productIds.length < 2) {
    throw new Error('A combo must include at least 2 products.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const comboResult = await client.query<{
      id: string;
      business_id: string;
      name: string;
      promo_price: string;
      currency: string;
      is_active: boolean;
      created_at: Date;
    }>(
      `INSERT INTO promo_combos (business_id, name, promo_price, currency)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [businessId, data.name, data.promoPrice, data.currency],
    );
    const combo = comboResult.rows[0];

    for (const productId of data.productIds) {
      await client.query(
        `INSERT INTO promo_combo_products (combo_id, product_id) VALUES ($1, $2)`,
        [combo.id, productId],
      );
    }

    await client.query('COMMIT');

    return {
      id: combo.id,
      businessId: combo.business_id,
      name: combo.name,
      promoPrice: Number(combo.promo_price),
      currency: combo.currency,
      isActive: combo.is_active,
      productIds: data.productIds,
      createdAt: combo.created_at,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listCombos(businessId: string): Promise<PromoCombo[]> {
  const combosResult = await pool.query<{
    id: string;
    business_id: string;
    name: string;
    promo_price: string;
    currency: string;
    is_active: boolean;
    created_at: Date;
  }>(
    `SELECT * FROM promo_combos WHERE business_id = $1 ORDER BY created_at DESC`,
    [businessId],
  );

  const combos: PromoCombo[] = [];
  for (const row of combosResult.rows) {
    const productsResult = await pool.query<{ product_id: string }>(
      `SELECT product_id FROM promo_combo_products WHERE combo_id = $1`,
      [row.id],
    );
    combos.push({
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      promoPrice: Number(row.promo_price),
      currency: row.currency,
      isActive: row.is_active,
      productIds: productsResult.rows.map((r) => r.product_id),
      createdAt: row.created_at,
    });
  }
  return combos;
}

export async function updateCombo(
  businessId: string,
  comboId: string,
  data: Partial<{
    name: string;
    promoPrice: number;
    currency: string;
    productIds: string[];
    isActive: boolean;
  }>,
): Promise<PromoCombo | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
  if (data.promoPrice !== undefined) { fields.push(`promo_price = $${idx++}`); values.push(data.promoPrice); }
  if (data.currency !== undefined) { fields.push(`currency = $${idx++}`); values.push(data.currency); }
  if (data.isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.isActive); }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (fields.length > 0) {
      values.push(comboId, businessId);
      const result = await client.query(
        `UPDATE promo_combos SET ${fields.join(', ')} WHERE id = $${idx++} AND business_id = $${idx} RETURNING id`,
        values,
      );
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
    }

    if (data.productIds !== undefined) {
      if (data.productIds.length < 2) throw new Error('A combo must include at least 2 products.');
      await client.query(`DELETE FROM promo_combo_products WHERE combo_id = $1`, [comboId]);
      for (const productId of data.productIds) {
        await client.query(
          `INSERT INTO promo_combo_products (combo_id, product_id) VALUES ($1, $2)`,
          [comboId, productId],
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Re-fetch the updated combo
  const comboResult = await pool.query<{
    id: string;
    business_id: string;
    name: string;
    promo_price: string;
    currency: string;
    is_active: boolean;
    created_at: Date;
  }>(
    `SELECT * FROM promo_combos WHERE id = $1 AND business_id = $2`,
    [comboId, businessId],
  );
  if (comboResult.rows.length === 0) return null;
  const row = comboResult.rows[0];

  const productsResult = await pool.query<{ product_id: string }>(
    `SELECT product_id FROM promo_combo_products WHERE combo_id = $1`,
    [comboId],
  );

  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    promoPrice: Number(row.promo_price),
    currency: row.currency,
    isActive: row.is_active,
    productIds: productsResult.rows.map((r) => r.product_id),
    createdAt: row.created_at,
  };
}

export async function deleteCombo(businessId: string, comboId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM promo_combo_products WHERE combo_id = $1`, [comboId]);
    const result = await client.query(
      `DELETE FROM promo_combos WHERE id = $1 AND business_id = $2`,
      [comboId, businessId],
    );
    await client.query('COMMIT');
    return (result.rowCount ?? 0) > 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Task 8.5: Active Combo Carousel Items (Property 27) ─────────────────────

/**
 * Returns active combos formatted as carousel items.
 * Property 27: each combo appears as exactly one item with promo_price.
 */
export async function getActiveComboCarouselItems(businessId: string): Promise<CarouselItem[]> {
  const result = await pool.query<{
    id: string;
    name: string;
    promo_price: string;
    currency: string;
  }>(
    `SELECT id, name, promo_price, currency FROM promo_combos
     WHERE business_id = $1 AND is_active = TRUE
     ORDER BY created_at DESC`,
    [businessId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    price: Number(row.promo_price),
    currency: row.currency,
    imageUrls: [],
    isCombo: true,
  }));
}

// ─── Task 8.6: CSV Bulk Import (Property 28) ─────────────────────────────────

const REQUIRED_CSV_FIELDS = ['name', 'price', 'currency', 'stock_quantity'] as const;

/**
 * Parse a CSV string into rows of key-value pairs.
 * Returns header array and data rows.
 */
export function parseCsvRows(csvText: string): Array<Record<string, string>> {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

/**
 * Validate a CSV row and return a reason string if invalid, or null if valid.
 */
export function validateCsvRow(row: Record<string, string>): string | null {
  const missing: string[] = [];
  for (const field of REQUIRED_CSV_FIELDS) {
    if (!row[field] || row[field].trim() === '') {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(', ')}`;
  }
  const price = Number(row['price']);
  if (isNaN(price) || price < 0) {
    return 'Invalid price value';
  }
  const stock = Number(row['stock_quantity']);
  if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
    return 'Invalid stock_quantity value';
  }
  return null;
}

/**
 * Bulk import products from CSV text.
 * Property 28: each skipped row includes row number and reason.
 */
export async function importProductsFromCsv(
  businessId: string,
  csvText: string,
): Promise<CsvImportResult> {
  const rows = parseCsvRows(csvText);
  const errors: Array<{ row: number; reason: string }> = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // 1-indexed, row 1 is header
    const row = rows[i];
    const reason = validateCsvRow(row);

    if (reason !== null) {
      errors.push({ row: rowNumber, reason });
      continue;
    }

    await pool.query(
      `INSERT INTO products (business_id, name, description, price, currency, stock_quantity, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        businessId,
        row['name'],
        row['description'] || null,
        Number(row['price']),
        row['currency'],
        Number(row['stock_quantity']),
        row['category'] || null,
      ],
    );
    imported++;
  }

  return { imported, errors };
}

// ─── Task 8.7: Revenue Summary ────────────────────────────────────────────────

/**
 * Returns units sold and total revenue for a product.
 * Queries order_items joined with completed orders.
 */
export async function getProductRevenue(
  businessId: string,
  productId: string,
): Promise<ProductRevenue> {
  const result = await pool.query<{ units_sold: string; total_revenue: string }>(
    `SELECT
       COALESCE(SUM(oi.quantity), 0) AS units_sold,
       COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id = $1
       AND o.business_id = $2
       AND o.status = 'completed'`,
    [productId, businessId],
  );

  const row = result.rows[0];
  return {
    productId,
    unitsSold: Number(row.units_sold),
    totalRevenue: Number(row.total_revenue),
  };
}
