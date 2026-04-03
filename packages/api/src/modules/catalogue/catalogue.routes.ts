/**
 * Catalogue Manager HTTP Routes
 * Requirements: 9.1–9.8
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../auth/middleware.js';
import {
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  createCombo,
  listCombos,
  updateCombo,
  deleteCombo,
  getActiveComboCarouselItems,
  importProductsFromCsv,
  getProductRevenue,
} from './catalogue.service.js';
import { uploadFile } from '../../storage/upload.js';
import { randomUUID } from 'crypto';

export async function catalogueRoutes(app: FastifyInstance): Promise<void> {
  // ── Products ──────────────────────────────────────────────────────────────

  // POST /catalogue/upload-image — upload a product image to S3/MinIO
  app.post('/catalogue/upload-image', { preHandler: authenticate }, async (request, reply) => {
    try {
      if (!request.isMultipart()) {
        return reply.status(400).send({ error: 'Request must be multipart/form-data.' });
      }
      const data = await request.file();
      if (!data) return reply.status(400).send({ error: 'No file provided.' });

      const ext = data.filename.split('.').pop() ?? 'jpg';
      const key = `products/${request.businessId}/${randomUUID()}.${ext}`;
      const buffer = await data.toBuffer();

      const url = await uploadFile(key, buffer, data.mimetype);
      return reply.send({ url });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      return reply.status(500).send({ error: message });
    }
  });

  // POST /catalogue/products — create product
  app.post('/catalogue/products', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const body = request.body as {
      name?: string;
      description?: string;
      price?: number;
      currency?: string;
      stock_quantity?: number;
      category?: string;
      image_urls?: string[];
    };

    if (!body.name || body.price === undefined || !body.currency || body.stock_quantity === undefined) {
      return reply.status(400).send({ error: 'Missing required fields: name, price, currency, stock_quantity.' });
    }

    try {
      const product = await createProduct(businessId, {
        name: body.name,
        description: body.description,
        price: body.price,
        currency: body.currency,
        stockQuantity: body.stock_quantity,
        category: body.category,
        imageUrls: body.image_urls,
      });
      return reply.status(201).send(product);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create product.';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /catalogue/products — search/filter products
  app.get('/catalogue/products', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const query = request.query as {
      name?: string;
      category?: string;
      minPrice?: string;
      maxPrice?: string;
      inStock?: string;
    };

    const filters = {
      name: query.name,
      category: query.category,
      minPrice: query.minPrice !== undefined ? Number(query.minPrice) : undefined,
      maxPrice: query.maxPrice !== undefined ? Number(query.maxPrice) : undefined,
      inStock: query.inStock !== undefined ? query.inStock === 'true' : undefined,
    };

    try {
      const products = await searchProducts(businessId, filters);
      return reply.send({ products });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search products.';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /catalogue/products/:id — get product
  app.get('/catalogue/products/:id', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const { id } = request.params as { id: string };

    const product = await getProduct(businessId, id);
    if (!product) return reply.status(404).send({ error: 'Product not found.' });
    return reply.send(product);
  });

  // PUT /catalogue/products/:id — update product
  app.put('/catalogue/products/:id', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      description?: string;
      price?: number;
      currency?: string;
      stock_quantity?: number;
      category?: string;
      image_urls?: string[];
      is_active?: boolean;
    };

    try {
      const product = await updateProduct(businessId, id, {
        name: body.name,
        description: body.description,
        price: body.price,
        currency: body.currency,
        stockQuantity: body.stock_quantity,
        category: body.category,
        imageUrls: body.image_urls,
        isActive: body.is_active,
      });
      if (!product) return reply.status(404).send({ error: 'Product not found.' });
      return reply.send(product);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update product.';
      return reply.status(500).send({ error: message });
    }
  });

  // DELETE /catalogue/products/:id — delete product
  app.delete('/catalogue/products/:id', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const { id } = request.params as { id: string };

    const deleted = await deleteProduct(businessId, id);
    if (!deleted) return reply.status(404).send({ error: 'Product not found.' });
    return reply.status(204).send();
  });

  // POST /catalogue/products/import — CSV bulk import
  app.post('/catalogue/products/import', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const body = request.body as { csv?: string };

    if (!body.csv) {
      return reply.status(400).send({ error: 'Missing csv field in request body.' });
    }

    try {
      const result = await importProductsFromCsv(businessId, body.csv);
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'CSV import failed.';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /catalogue/products/:id/revenue — revenue summary
  app.get('/catalogue/products/:id/revenue', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const { id } = request.params as { id: string };

    try {
      const revenue = await getProductRevenue(businessId, id);
      return reply.send(revenue);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch revenue.';
      return reply.status(500).send({ error: message });
    }
  });

  // ── Combos ────────────────────────────────────────────────────────────────

  // GET /catalogue/combos/active — active combos as carousel items
  app.get('/catalogue/combos/active', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    try {
      const items = await getActiveComboCarouselItems(businessId);
      return reply.send({ items });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch active combos.';
      return reply.status(500).send({ error: message });
    }
  });

  // POST /catalogue/combos — create combo
  app.post('/catalogue/combos', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const body = request.body as {
      name?: string;
      promo_price?: number;
      currency?: string;
      product_ids?: string[];
    };

    if (!body.name || body.promo_price === undefined || !body.currency || !body.product_ids) {
      return reply.status(400).send({ error: 'Missing required fields: name, promo_price, currency, product_ids.' });
    }
    if (body.product_ids.length < 2) {
      return reply.status(400).send({ error: 'A combo must include at least 2 products.' });
    }

    try {
      const combo = await createCombo(businessId, {
        name: body.name,
        promoPrice: body.promo_price,
        currency: body.currency,
        productIds: body.product_ids,
      });
      return reply.status(201).send(combo);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create combo.';
      return reply.status(500).send({ error: message });
    }
  });

  // GET /catalogue/combos — list combos
  app.get('/catalogue/combos', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    try {
      const combos = await listCombos(businessId);
      return reply.send({ combos });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list combos.';
      return reply.status(500).send({ error: message });
    }
  });

  // PUT /catalogue/combos/:id — update combo
  app.put('/catalogue/combos/:id', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      promo_price?: number;
      currency?: string;
      product_ids?: string[];
      is_active?: boolean;
    };

    try {
      const combo = await updateCombo(businessId, id, {
        name: body.name,
        promoPrice: body.promo_price,
        currency: body.currency,
        productIds: body.product_ids,
        isActive: body.is_active,
      });
      if (!combo) return reply.status(404).send({ error: 'Combo not found.' });
      return reply.send(combo);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update combo.';
      return reply.status(400).send({ error: message });
    }
  });

  // DELETE /catalogue/combos/:id — delete combo
  app.delete('/catalogue/combos/:id', { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.businessId;
    const { id } = request.params as { id: string };

    const deleted = await deleteCombo(businessId, id);
    if (!deleted) return reply.status(404).send({ error: 'Combo not found.' });
    return reply.status(204).send();
  });
}
