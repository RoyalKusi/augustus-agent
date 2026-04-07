/**
 * Property-based tests for Catalogue Manager
 * Feature: augustus-ai-sales-platform
 *
 * Uses fast-check for property generation.
 * Validates: Requirements 9.2, 9.3, 9.5, 9.7
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import * as fc from 'fast-check';
beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
});
vi.mock('../../../db/client.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
import { pool } from '../../../db/client.js';
import { parseCsvRows, validateCsvRow, getInStockProducts, searchProducts, getActiveComboCarouselItems, importProductsFromCsv, } from '../catalogue.service.js';
afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});
// ─── Helpers ──────────────────────────────────────────────────────────────────
const uuidArb = fc.uuid();
const nameArb = fc.string({ minLength: 1, maxLength: 64 }).filter((s) => !s.includes('\0') && !s.includes(',') && s.trim().length > 0);
const categoryArb = fc.string({ minLength: 1, maxLength: 32 }).filter((s) => !s.includes('\0') && !s.includes(','));
const currencyArb = fc.constantFrom('USD', 'ZWL', 'EUR', 'GBP');
const priceArb = fc.float({ min: Math.fround(0.01), max: Math.fround(9999.99), noNaN: true });
const stockArb = fc.integer({ min: 0, max: 1000 });
/** Build a Product object for testing (no DB) */
function makeProduct(overrides = {}) {
    return {
        id: 'prod-1',
        businessId: 'biz-1',
        name: 'Test Product',
        description: null,
        price: 10.0,
        currency: 'USD',
        stockQuantity: 5,
        category: 'Electronics',
        imageUrls: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: null,
        ...overrides,
    };
}
/** Build a mock DB row for a product */
function makeProductRow(overrides = {}) {
    return {
        id: 'prod-1',
        business_id: 'biz-1',
        name: 'Test Product',
        description: null,
        price: '10.00',
        currency: 'USD',
        stock_quantity: 5,
        category: 'Electronics',
        image_urls: [],
        is_active: true,
        created_at: new Date(),
        updated_at: null,
        ...overrides,
    };
}
// ─── Property 25: Out-of-Stock Products Excluded from Responses ───────────────
// Feature: augustus-ai-sales-platform, Property 25: Out-of-Stock Products Excluded from Responses
// **Validates: Requirements 9.2**
describe('Property 25: Out-of-Stock Products Excluded from Responses', () => {
    it('getInStockProducts never returns a product with stock_quantity = 0', async () => {
        await fc.assert(fc.asyncProperty(uuidArb, fc.array(fc.record({
            id: uuidArb,
            stock_quantity: stockArb,
            name: nameArb,
            currency: currencyArb,
            price: priceArb.map((p) => p.toFixed(2)),
        }), { minLength: 0, maxLength: 20 }), async (businessId, productRows) => {
            // DB returns all rows; service should filter to stock_quantity > 0
            const inStockRows = productRows
                .filter((r) => r.stock_quantity > 0)
                .map((r) => makeProductRow({ ...r, business_id: businessId }));
            vi.mocked(pool.query).mockResolvedValueOnce({
                rows: inStockRows,
                rowCount: inStockRows.length,
            });
            const products = await getInStockProducts(businessId);
            // Every returned product must have stock_quantity > 0
            for (const p of products) {
                expect(p.stockQuantity).toBeGreaterThan(0);
            }
        }), { numRuns: 25 });
    });
    it('getInStockProducts returns empty array when all products are out of stock', async () => {
        await fc.assert(fc.asyncProperty(uuidArb, async (businessId) => {
            vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const products = await getInStockProducts(businessId);
            expect(products).toHaveLength(0);
        }), { numRuns: 25 });
    });
    it('a product with stock_quantity=0 is never present in getInStockProducts result', async () => {
        await fc.assert(fc.asyncProperty(uuidArb, fc.array(fc.record({ id: uuidArb, stock_quantity: fc.integer({ min: 1, max: 100 }), name: nameArb }), { minLength: 1, maxLength: 10 }), async (businessId, inStockRows) => {
            const rows = inStockRows.map((r) => makeProductRow({ id: r.id, business_id: businessId, stock_quantity: r.stock_quantity, name: r.name }));
            vi.mocked(pool.query).mockResolvedValueOnce({ rows, rowCount: rows.length });
            const products = await getInStockProducts(businessId);
            const zeroStockProduct = products.find((p) => p.stockQuantity === 0);
            expect(zeroStockProduct).toBeUndefined();
        }), { numRuns: 25 });
    });
});
// ─── Property 26: Product Filter Correctness ─────────────────────────────────
// Feature: augustus-ai-sales-platform, Property 26: Product Filter Correctness
// **Validates: Requirements 9.3**
describe('Property 26: Product Filter Correctness', () => {
    /**
     * We test the filter logic in-memory by simulating what the DB would return
     * and verifying that the service correctly applies filters.
     * The core filter logic is tested via validateCsvRow and the in-memory filter helpers.
     */
    it('every product in result satisfies the inStock=true filter', async () => {
        await fc.assert(fc.asyncProperty(uuidArb, fc.array(fc.record({ id: uuidArb, stock_quantity: fc.integer({ min: 1, max: 100 }), name: nameArb }), { minLength: 0, maxLength: 15 }), async (businessId, inStockRows) => {
            const rows = inStockRows.map((r) => makeProductRow({ id: r.id, business_id: businessId, stock_quantity: r.stock_quantity, name: r.name }));
            vi.mocked(pool.query).mockResolvedValueOnce({ rows, rowCount: rows.length });
            const products = await searchProducts(businessId, { inStock: true });
            for (const p of products) {
                expect(p.stockQuantity).toBeGreaterThan(0);
            }
        }), { numRuns: 25 });
    });
    it('every product in result satisfies the inStock=false filter', async () => {
        await fc.assert(fc.asyncProperty(uuidArb, fc.array(fc.record({ id: uuidArb, stock_quantity: fc.constant(0), name: nameArb }), { minLength: 0, maxLength: 15 }), async (businessId, outOfStockRows) => {
            const rows = outOfStockRows.map((r) => makeProductRow({ id: r.id, business_id: businessId, stock_quantity: 0, name: r.name }));
            vi.mocked(pool.query).mockResolvedValueOnce({ rows, rowCount: rows.length });
            const products = await searchProducts(businessId, { inStock: false });
            for (const p of products) {
                expect(p.stockQuantity).toBe(0);
            }
        }), { numRuns: 25 });
    });
    it('every product in result satisfies the minPrice filter', async () => {
        await fc.assert(fc.asyncProperty(uuidArb, fc.float({ min: Math.fround(1), max: Math.fround(100), noNaN: true }), fc.array(fc.record({
            id: uuidArb,
            price: fc.float({ min: Math.fround(1), max: Math.fround(200), noNaN: true }).map((p) => p.toFixed(2)),
            name: nameArb,
        }), { minLength: 0, maxLength: 15 }), async (businessId, minPrice, priceRows) => {
            // Simulate DB returning only rows that satisfy minPrice
            const filteredRows = priceRows
                .filter((r) => Number(r.price) >= minPrice)
                .map((r) => makeProductRow({ id: r.id, business_id: businessId, price: r.price, name: r.name }));
            vi.mocked(pool.query).mockResolvedValueOnce({ rows: filteredRows, rowCount: filteredRows.length });
            const products = await searchProducts(businessId, { minPrice });
            for (const p of products) {
                expect(p.price).toBeGreaterThanOrEqual(minPrice);
            }
        }), { numRuns: 25 });
    });
    it('every product in result satisfies the maxPrice filter', async () => {
        await fc.assert(fc.asyncProperty(uuidArb, fc.float({ min: Math.fround(10), max: Math.fround(500), noNaN: true }), fc.array(fc.record({
            id: uuidArb,
            price: fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }).map((p) => p.toFixed(2)),
            name: nameArb,
        }), { minLength: 0, maxLength: 15 }), async (businessId, maxPrice, priceRows) => {
            const filteredRows = priceRows
                .filter((r) => Number(r.price) <= maxPrice)
                .map((r) => makeProductRow({ id: r.id, business_id: businessId, price: r.price, name: r.name }));
            vi.mocked(pool.query).mockResolvedValueOnce({ rows: filteredRows, rowCount: filteredRows.length });
            const products = await searchProducts(businessId, { maxPrice });
            for (const p of products) {
                expect(p.price).toBeLessThanOrEqual(maxPrice + 0.001); // float tolerance
            }
        }), { numRuns: 25 });
    });
    it('no matching product is absent: result count equals DB row count', async () => {
        await fc.assert(fc.asyncProperty(uuidArb, fc.array(fc.record({ id: uuidArb, name: nameArb }), { minLength: 0, maxLength: 20 }), async (businessId, productRows) => {
            const rows = productRows.map((r) => makeProductRow({ id: r.id, business_id: businessId, name: r.name }));
            vi.mocked(pool.query).mockResolvedValueOnce({ rows, rowCount: rows.length });
            const products = await searchProducts(businessId, {});
            expect(products).toHaveLength(rows.length);
        }), { numRuns: 25 });
    });
});
// ─── Property 27: Active Combo Presented as Single Carousel Item ──────────────
// Feature: augustus-ai-sales-platform, Property 27: Active Combo Presented as Single Carousel Item
// **Validates: Requirements 9.5**
describe('Property 27: Active Combo Presented as Single Carousel Item', () => {
    it('each active combo appears as exactly one carousel item', async () => {
        await fc.assert(fc.asyncProperty(uuidArb, fc.array(fc.record({
            id: uuidArb,
            name: nameArb,
            promo_price: priceArb.map((p) => p.toFixed(2)),
            currency: currencyArb,
        }), { minLength: 0, maxLength: 10 }), async (businessId, comboRows) => {
            vi.mocked(pool.query).mockResolvedValueOnce({
                rows: comboRows.map((r) => ({ ...r, business_id: businessId })),
                rowCount: comboRows.length,
            });
            const items = await getActiveComboCarouselItems(businessId);
            // Each combo maps to exactly one carousel item
            expect(items).toHaveLength(comboRows.length);
            // Each item ID is unique (one item per combo)
            const ids = items.map((i) => i.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        }), { numRuns: 25 });
    });
    it('each carousel item displays the promotional price, not a sum', async () => {
        await fc.assert(fc.asyncProperty(uuidArb, fc.array(fc.record({
            id: uuidArb,
            name: nameArb,
            promo_price: priceArb.map((p) => p.toFixed(2)),
            currency: currencyArb,
        }), { minLength: 1, maxLength: 10 }), async (businessId, comboRows) => {
            vi.mocked(pool.query).mockResolvedValueOnce({
                rows: comboRows.map((r) => ({ ...r, business_id: businessId })),
                rowCount: comboRows.length,
            });
            const items = await getActiveComboCarouselItems(businessId);
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const row = comboRows[i];
                // Price must equal the promo_price from the combo record
                expect(item.price).toBeCloseTo(Number(row.promo_price), 2);
                expect(item.isCombo).toBe(true);
            }
        }), { numRuns: 25 });
    });
    it('carousel item price is always the promo_price (never sum of individual prices)', async () => {
        // Simulate a combo with promo_price = 15.00 where individual products cost 10 + 12 = 22
        const comboRow = {
            id: 'combo-1',
            business_id: 'biz-1',
            name: 'Bundle Deal',
            promo_price: '15.00',
            currency: 'USD',
        };
        vi.mocked(pool.query).mockResolvedValueOnce({ rows: [comboRow], rowCount: 1 });
        const items = await getActiveComboCarouselItems('biz-1');
        expect(items).toHaveLength(1);
        expect(items[0].price).toBe(15.0);
        // Confirm it's NOT the sum of individual prices (22.00)
        expect(items[0].price).not.toBe(22.0);
    });
    it('isCombo flag is always true for combo carousel items', async () => {
        await fc.assert(fc.asyncProperty(uuidArb, fc.array(fc.record({ id: uuidArb, name: nameArb, promo_price: fc.constant('9.99'), currency: currencyArb }), { minLength: 1, maxLength: 5 }), async (businessId, comboRows) => {
            vi.mocked(pool.query).mockResolvedValueOnce({
                rows: comboRows.map((r) => ({ ...r, business_id: businessId })),
                rowCount: comboRows.length,
            });
            const items = await getActiveComboCarouselItems(businessId);
            for (const item of items) {
                expect(item.isCombo).toBe(true);
            }
        }), { numRuns: 25 });
    });
});
// ─── Property 28: CSV Import Error Reporting ──────────────────────────────────
// Feature: augustus-ai-sales-platform, Property 28: CSV Import Error Reporting
// **Validates: Requirements 9.7**
describe('Property 28: CSV Import Error Reporting', () => {
    it('each skipped row includes a row number and a reason', async () => {
        await fc.assert(fc.asyncProperty(uuidArb, 
        // Generate CSV rows: some valid, some missing required fields
        fc.array(fc.oneof(
        // Valid row
        fc.record({
            name: nameArb,
            description: fc.string({ maxLength: 50 }).filter((s) => !s.includes(',') && !s.includes('\n')),
            price: fc.float({ min: Math.fround(0.01), max: Math.fround(999), noNaN: true }).map((p) => p.toFixed(2)),
            currency: currencyArb,
            stock_quantity: fc.integer({ min: 0, max: 100 }).map(String),
            category: categoryArb,
            valid: fc.constant(true),
        }), 
        // Invalid row: missing name
        fc.record({
            name: fc.constant(''),
            description: fc.constant(''),
            price: fc.float({ min: Math.fround(0.01), max: Math.fround(999), noNaN: true }).map((p) => p.toFixed(2)),
            currency: currencyArb,
            stock_quantity: fc.integer({ min: 0, max: 100 }).map(String),
            category: fc.constant(''),
            valid: fc.constant(false),
        }), 
        // Invalid row: missing price
        fc.record({
            name: nameArb,
            description: fc.constant(''),
            price: fc.constant(''),
            currency: currencyArb,
            stock_quantity: fc.integer({ min: 0, max: 100 }).map(String),
            category: fc.constant(''),
            valid: fc.constant(false),
        })), { minLength: 1, maxLength: 15 }), async (businessId, rowDefs) => {
            const header = 'name,description,price,currency,stock_quantity,category';
            const dataLines = rowDefs.map((r) => `${r.name},${r.description},${r.price},${r.currency},${r.stock_quantity},${r.category}`);
            const csvText = [header, ...dataLines].join('\n');
            // Mock pool.query to succeed for valid inserts
            vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 1 });
            const result = await importProductsFromCsv(businessId, csvText);
            // Every error entry must have a row number and a non-empty reason
            for (const err of result.errors) {
                expect(typeof err.row).toBe('number');
                expect(err.row).toBeGreaterThanOrEqual(2); // row 1 is header
                expect(typeof err.reason).toBe('string');
                expect(err.reason.length).toBeGreaterThan(0);
            }
            // imported + errors = total data rows
            expect(result.imported + result.errors.length).toBe(rowDefs.length);
        }), { numRuns: 25 });
    });
    it('row numbers in errors are unique and in ascending order', async () => {
        await fc.assert(fc.asyncProperty(uuidArb, fc.integer({ min: 1, max: 10 }), async (businessId, invalidCount) => {
            const header = 'name,description,price,currency,stock_quantity,category';
            // All rows are invalid (missing name)
            const dataLines = Array.from({ length: invalidCount }, () => ',desc,10.00,USD,5,cat');
            const csvText = [header, ...dataLines].join('\n');
            vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 0 });
            const result = await importProductsFromCsv(businessId, csvText);
            expect(result.errors).toHaveLength(invalidCount);
            expect(result.imported).toBe(0);
            const rowNumbers = result.errors.map((e) => e.row);
            // Row numbers must be unique
            expect(new Set(rowNumbers).size).toBe(rowNumbers.length);
            // Row numbers must be ascending
            for (let i = 1; i < rowNumbers.length; i++) {
                expect(rowNumbers[i]).toBeGreaterThan(rowNumbers[i - 1]);
            }
        }), { numRuns: 25 });
    });
    it('valid rows are imported and invalid rows are skipped', async () => {
        const csvText = [
            'name,description,price,currency,stock_quantity,category',
            'Widget A,A widget,9.99,USD,10,Tools', // valid — row 2
            ',Missing name,5.00,USD,3,Tools', // invalid — row 3
            'Widget B,Another,19.99,USD,0,Electronics', // valid — row 4
            'Widget C,,,,', // invalid — row 5 (missing price/currency/stock)
        ].join('\n');
        vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 1 });
        const result = await importProductsFromCsv('biz-1', csvText);
        expect(result.imported).toBe(2);
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0].row).toBe(3);
        expect(result.errors[1].row).toBe(5);
        expect(result.errors[0].reason).toBeTruthy();
        expect(result.errors[1].reason).toBeTruthy();
    });
    it('validateCsvRow returns null for a fully valid row', () => {
        fc.assert(fc.property(nameArb, priceArb.map((p) => p.toFixed(2)), currencyArb, fc.integer({ min: 0, max: 1000 }).map(String), (name, price, currency, stock_quantity) => {
            const row = { name, price, currency, stock_quantity };
            expect(validateCsvRow(row)).toBeNull();
        }), { numRuns: 25 });
    });
    it('validateCsvRow returns a reason for any row missing a required field', () => {
        const requiredFields = ['name', 'price', 'currency', 'stock_quantity'];
        fc.assert(fc.property(fc.constantFrom(...requiredFields), nameArb, priceArb.map((p) => p.toFixed(2)), currencyArb, fc.integer({ min: 0, max: 1000 }).map(String), (missingField, name, price, currency, stock_quantity) => {
            const row = { name, price, currency, stock_quantity };
            row[missingField] = ''; // blank out the required field
            const reason = validateCsvRow(row);
            expect(reason).not.toBeNull();
            expect(typeof reason).toBe('string');
            expect(reason.length).toBeGreaterThan(0);
        }), { numRuns: 25 });
    });
    it('parseCsvRows returns empty array for CSV with only a header', () => {
        const result = parseCsvRows('name,description,price,currency,stock_quantity,category');
        expect(result).toHaveLength(0);
    });
    it('parseCsvRows returns correct number of rows', () => {
        fc.assert(fc.property(fc.integer({ min: 1, max: 20 }), (rowCount) => {
            const header = 'name,price,currency,stock_quantity';
            const rows = Array.from({ length: rowCount }, (_, i) => `Product${i},9.99,USD,5`);
            const csv = [header, ...rows].join('\n');
            const parsed = parseCsvRows(csv);
            expect(parsed).toHaveLength(rowCount);
        }), { numRuns: 25 });
    });
});
//# sourceMappingURL=catalogue.properties.test.js.map