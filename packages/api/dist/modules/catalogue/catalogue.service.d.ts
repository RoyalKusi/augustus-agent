/**
 * Catalogue Manager Service
 * Requirements: 9.1–9.8
 * Properties: 25, 26, 27, 28
 */
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
    errors: Array<{
        row: number;
        reason: string;
    }>;
}
export interface ProductRevenue {
    productId: string;
    unitsSold: number;
    totalRevenue: number;
}
export declare function createProduct(businessId: string, data: {
    name: string;
    description?: string;
    price: number;
    currency: string;
    stockQuantity: number;
    category?: string;
    imageUrls?: string[];
}): Promise<Product>;
export declare function getProduct(businessId: string, productId: string): Promise<Product | null>;
export declare function updateProduct(businessId: string, productId: string, data: Partial<{
    name: string;
    description: string;
    price: number;
    currency: string;
    stockQuantity: number;
    category: string;
    imageUrls: string[];
    isActive: boolean;
}>): Promise<Product | null>;
export declare function deleteProduct(businessId: string, productId: string): Promise<boolean>;
/**
 * Returns only in-stock products for a business.
 * Property 25: stock_quantity=0 products must never appear.
 */
export declare function getInStockProducts(businessId: string): Promise<Product[]>;
/**
 * Search and filter products for a business.
 * Property 26: every result satisfies all applied filters; no matching product absent.
 */
export declare function searchProducts(businessId: string, filters: ProductFilters): Promise<Product[]>;
export declare function createCombo(businessId: string, data: {
    name: string;
    promoPrice: number;
    currency: string;
    productIds: string[];
}): Promise<PromoCombo>;
export declare function listCombos(businessId: string): Promise<PromoCombo[]>;
export declare function updateCombo(businessId: string, comboId: string, data: Partial<{
    name: string;
    promoPrice: number;
    currency: string;
    productIds: string[];
    isActive: boolean;
}>): Promise<PromoCombo | null>;
export declare function deleteCombo(businessId: string, comboId: string): Promise<boolean>;
/**
 * Returns active combos formatted as carousel items.
 * Property 27: each combo appears as exactly one item with promo_price.
 */
export declare function getActiveComboCarouselItems(businessId: string): Promise<CarouselItem[]>;
/**
 * Parse a CSV string into rows of key-value pairs.
 * Returns header array and data rows.
 */
export declare function parseCsvRows(csvText: string): Array<Record<string, string>>;
/**
 * Validate a CSV row and return a reason string if invalid, or null if valid.
 */
export declare function validateCsvRow(row: Record<string, string>): string | null;
/**
 * Bulk import products from CSV text.
 * Property 28: each skipped row includes row number and reason.
 */
export declare function importProductsFromCsv(businessId: string, csvText: string): Promise<CsvImportResult>;
/**
 * Returns units sold and total revenue for a product.
 * Queries order_items joined with completed orders.
 */
export declare function getProductRevenue(businessId: string, productId: string): Promise<ProductRevenue>;
//# sourceMappingURL=catalogue.service.d.ts.map