import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { apiFetch } from '../api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  stockQuantity: number;
  category: string;
  imageUrls: string[];
  isActive: boolean;
}

interface Combo {
  id: string;
  name: string;
  promoPrice: number;
  currency: string;
  productIds: string[];
  isActive: boolean;
}

const EMPTY_PRODUCT = {
  name: '', description: '', price: '', currency: 'USD',
  stock_quantity: '', category: '', images: [] as (File | null)[],
  existingImageUrls: [] as (string | null)[],  // existing URLs per slot when editing
};

const EXCEL_COLUMNS = ['name', 'description', 'price', 'currency', 'stock_quantity', 'category'];

// ─── Image Upload Helper ──────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL || '';

async function uploadImages(files: File[], token: string): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${BASE_URL}/catalogue/upload-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: fd,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `Image upload failed (HTTP ${res.status})`);
    }
    const data = await res.json() as { url: string };
    urls.push(data.url);
  }
  return urls;
}


// ─── Main Component ───────────────────────────────────────────────────────────

export default function Catalogue() {
  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [editId, setEditId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ id: string; field: string; value: string } | null>(null);
  const [comboForm, setComboForm] = useState({ name: '', promo_price: '', currency: 'USD', product_ids: [] as string[] });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'products' | 'import' | 'combos'>('products');
  const [excelRows, setExcelRows] = useState<Record<string, string>[]>([]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const imageRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const excelRef = useRef<HTMLInputElement>(null);

  const token = localStorage.getItem('augustus_token') ?? '';

  const loadProducts = () =>
    apiFetch<{ products: Product[] }>('/catalogue/products')
      .then((r) => setProducts(r.products ?? []))
      .catch(() => {});

  const loadCombos = () =>
    apiFetch<{ combos: Combo[] }>('/catalogue/combos')
      .then((r) => setCombos(r.combos ?? []))
      .catch(() => {});

  useEffect(() => { loadProducts(); loadCombos(); }, []);

  // ── Product Form ────────────────────────────────────────────────────────────

  const setF = (k: keyof typeof EMPTY_PRODUCT) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleImageChange = (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => {
      const imgs = [...f.images];
      imgs[idx] = file;
      return { ...f, images: imgs };
    });
  };

  const clearImageSlot = (idx: number) => {
    setForm((f) => {
      const imgs = [...f.images];
      const existing = [...f.existingImageUrls];
      imgs[idx] = null;
      existing[idx] = null;
      return { ...f, images: imgs, existingImageUrls: existing };
    });
    if (imageRefs[idx].current) imageRefs[idx].current!.value = '';
  };

  const submitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMsg(''); setLoading(true);
    try {
      // Build final image_urls: for each slot, use new upload if selected, else keep existing URL
      const finalUrls: string[] = [];
      for (let i = 0; i < 3; i++) {
        const newFile = form.images[i];
        const existingUrl = form.existingImageUrls[i];
        if (newFile) {
          // Upload new file for this slot
          const uploaded = await uploadImages([newFile], token);
          if (uploaded[0]) finalUrls.push(uploaded[0]);
        } else if (existingUrl) {
          finalUrls.push(existingUrl);
        }
      }

      const body = {
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        currency: form.currency,
        stock_quantity: parseInt(form.stock_quantity),
        category: form.category,
        image_urls: finalUrls,
      };
      if (editId) {
        await apiFetch(`/catalogue/products/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
        setMsg('Product updated.');
      } else {
        await apiFetch('/catalogue/products', { method: 'POST', body: JSON.stringify(body) });
        setMsg('Product added.');
      }
      setForm(EMPTY_PRODUCT);
      setEditId(null);
      imageRefs.forEach((r) => { if (r.current) r.current.value = ''; });
      loadProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (p: Product) => {
    setEditId(p.id);
    // Populate existing image URLs into slots so they're preserved unless replaced
    const existingUrls: (string | null)[] = [
      p.imageUrls[0] ?? null,
      p.imageUrls[1] ?? null,
      p.imageUrls[2] ?? null,
    ];
    setForm({
      name: p.name, description: p.description ?? '',
      price: String(p.price), currency: p.currency,
      stock_quantity: String(p.stockQuantity), category: p.category ?? '',
      images: [null, null, null],
      existingImageUrls: existingUrls,
    });
    setTab('products');
    window.scrollTo(0, 0);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      await apiFetch(`/catalogue/products/${id}`, { method: 'DELETE' });
      loadProducts();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  };

  // ── Inline field editing ────────────────────────────────────────────────────

  const startInlineEdit = (id: string, field: string, value: string) =>
    setEditingField({ id, field, value });

  const saveInlineEdit = async () => {
    if (!editingField) return;
    const { id, field, value } = editingField;
    const body: Record<string, unknown> = {};
    if (field === 'stock_quantity') body.stock_quantity = parseInt(value);
    else if (field === 'price') body.price = parseFloat(value);
    else body[field] = value;
    try {
      await apiFetch(`/catalogue/products/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      setEditingField(null);
      loadProducts();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  };


  // ── Excel Import ────────────────────────────────────────────────────────────

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      EXCEL_COLUMNS,
      ['Example Product', 'A sample product description', '9.99', 'USD', '100', 'Electronics'],
    ]);
    // Style the header row
    ws['!cols'] = EXCEL_COLUMNS.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'augustus_products_template.xlsx');
  };

  const handleExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
      setExcelRows(rows);
    };
    reader.readAsArrayBuffer(file);
  };

  const importExcel = async () => {
    if (!excelRows.length) return;
    setLoading(true); setError(''); setMsg('');
    try {
      // Convert to CSV for the existing import endpoint
      const header = EXCEL_COLUMNS.join(',');
      const lines = excelRows.map((r) =>
        EXCEL_COLUMNS.map((col) => String(r[col] ?? r[col.toLowerCase()] ?? '')).join(',')
      );
      const csv = [header, ...lines].join('\n');
      const result = await apiFetch<{ imported: number; errors: Array<{ row: number; reason: string }> }>(
        '/catalogue/products/import',
        { method: 'POST', body: JSON.stringify({ csv }) },
      );
      setMsg(`Imported ${result.imported} products.${result.errors.length ? ` ${result.errors.length} rows skipped.` : ''}`);
      if (result.errors.length) {
        setError(result.errors.map((e) => `Row ${e.row}: ${e.reason}`).join(' | '));
      }
      setExcelRows([]);
      setExcelFile(null);
      if (excelRef.current) excelRef.current.value = '';
      loadProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Combos ──────────────────────────────────────────────────────────────────

  const toggleComboProduct = (id: string) =>
    setComboForm((f) => ({
      ...f,
      product_ids: f.product_ids.includes(id)
        ? f.product_ids.filter((x) => x !== id)
        : [...f.product_ids, id],
    }));

  const submitCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (comboForm.product_ids.length < 2) { setError('Select at least 2 products for a combo.'); return; }
    setError('');
    try {
      await apiFetch('/catalogue/combos', {
        method: 'POST',
        body: JSON.stringify({ ...comboForm, promo_price: parseFloat(comboForm.promo_price) }),
      });
      setComboForm({ name: '', promo_price: '', currency: 'USD', product_ids: [] });
      loadCombos();
      setMsg('Combo created.');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
  };


  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 900 }}>
      <h2>Catalogue</h2>
      {error && <p style={errStyle}>{error}</p>}
      {msg && <p style={okStyle}>{msg}</p>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e2e8f0' }}>
        {(['products', 'import', 'combos'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ ...tabBtn, borderBottom: tab === t ? '2px solid #3182ce' : '2px solid transparent', color: tab === t ? '#3182ce' : '#718096' }}>
            {t === 'products' ? 'Products' : t === 'import' ? 'Excel Import' : 'Promo Combos'}
          </button>
        ))}
      </div>

      {/* ── Products Tab ── */}
      {tab === 'products' && (
        <>
          <h3 style={{ marginTop: 0 }}>{editId ? 'Edit Product' : 'Add Product'}</h3>
          <form onSubmit={submitProduct} style={formStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input value={form.name} onChange={setF('name')} required style={inputStyle} placeholder="Product name" />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <input value={form.category} onChange={setF('category')} style={inputStyle} placeholder="e.g. Electronics" />
              </div>
              <div>
                <label style={labelStyle}>Price *</label>
                <input type="number" step="0.01" value={form.price} onChange={setF('price')} required style={inputStyle} placeholder="0.00" />
              </div>
              <div>
                <label style={labelStyle}>Currency *</label>
                <input value={form.currency} onChange={setF('currency')} required style={inputStyle} placeholder="USD" />
              </div>
              <div>
                <label style={labelStyle}>Stock Quantity *</label>
                <input type="number" value={form.stock_quantity} onChange={setF('stock_quantity')} required style={inputStyle} placeholder="0" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea value={form.description} onChange={setF('description')} style={{ ...inputStyle, height: 72, resize: 'vertical' }} placeholder="Product description" />
            </div>

            {/* 3 image slots */}
            <div>
              <label style={labelStyle}>Product Images (up to 3)</label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[0, 1, 2].map((i) => {
                  const newFile = form.images[i];
                  const existingUrl = form.existingImageUrls[i];
                  const preview = newFile ? URL.createObjectURL(newFile) : existingUrl ?? null;
                  return (
                    <div key={i} style={{ position: 'relative' }}>
                      <div style={imageSlot}>
                        {preview ? (
                          <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                        ) : (
                          <span style={{ color: '#a0aec0', fontSize: 12 }}>Image {i + 1}</span>
                        )}
                        <input
                          ref={imageRefs[i]}
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange(i)}
                          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                        />
                      </div>
                      {preview && (
                        <button
                          type="button"
                          onClick={() => clearImageSlot(i)}
                          style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#e53e3e', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                          title="Remove image"
                        >✕</button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: 12, color: '#718096', margin: '4px 0 0' }}>Click each slot to upload an image</p>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={loading} style={btnStyle}>{loading ? 'Saving…' : editId ? 'Update Product' : 'Add Product'}</button>
              {editId && (
                <button type="button" onClick={() => { setEditId(null); setForm(EMPTY_PRODUCT); }} style={{ ...btnStyle, background: '#718096' }}>Cancel</button>
              )}
            </div>
          </form>

          {/* Products Table */}
          <h3>Products ({products.length})</h3>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>{['Images', 'Name', 'Price', 'Stock', 'Category', 'Actions'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(p.imageUrls ?? []).slice(0, 3).map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt=""
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }}
                        />
                      ))}
                      {(p.imageUrls ?? []).length === 0 && <span style={{ color: '#a0aec0', fontSize: 11 }}>No images</span>}
                    </div>
                  </td>
                  <td style={td}>{p.name}</td>
                  <td style={td}>
                    {editingField?.id === p.id && editingField.field === 'price' ? (
                      <input autoFocus type="number" step="0.01" value={editingField.value} onChange={(e) => setEditingField({ ...editingField, value: e.target.value })} onBlur={saveInlineEdit} onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()} style={{ ...inputStyle, width: 80, padding: '2px 6px' }} />
                    ) : (
                      <span onClick={() => startInlineEdit(p.id, 'price', String(p.price))} style={editableCell}>{p.currency} {p.price}</span>
                    )}
                  </td>
                  <td style={td}>
                    {editingField?.id === p.id && editingField.field === 'stock_quantity' ? (
                      <input autoFocus type="number" value={editingField.value} onChange={(e) => setEditingField({ ...editingField, value: e.target.value })} onBlur={saveInlineEdit} onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()} style={{ ...inputStyle, width: 70, padding: '2px 6px' }} />
                    ) : (
                      <span onClick={() => startInlineEdit(p.id, 'stock_quantity', String(p.stockQuantity))} style={{ ...editableCell, color: p.stockQuantity === 0 ? '#e53e3e' : undefined }}>{p.stockQuantity}</span>
                    )}
                  </td>
                  <td style={td}>
                    {editingField?.id === p.id && editingField.field === 'category' ? (
                      <input autoFocus value={editingField.value} onChange={(e) => setEditingField({ ...editingField, value: e.target.value })} onBlur={saveInlineEdit} onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()} style={{ ...inputStyle, width: 100, padding: '2px 6px' }} />
                    ) : (
                      <span onClick={() => startInlineEdit(p.id, 'category', p.category ?? '')} style={editableCell}>{p.category || '—'}</span>
                    )}
                  </td>
                  <td style={td}>
                    <button onClick={() => startEdit(p)} style={smallBtn}>Edit</button>{' '}
                    <button onClick={() => deleteProduct(p.id)} style={{ ...smallBtn, background: '#e53e3e' }}>Delete</button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan={6} style={{ ...td, color: '#a0aec0', textAlign: 'center', padding: 24 }}>No products yet</td></tr>}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: '#718096', marginTop: 4 }}>Click any price, stock, or category cell to edit inline</p>
        </>
      )}

      {/* ── Excel Import Tab ── */}
      {tab === 'import' && (
        <div>
          <h3 style={{ marginTop: 0 }}>Excel Bulk Import</h3>
          <p style={{ color: '#4a5568', fontSize: 14 }}>Download the template, fill it in, then upload it here.</p>
          <button onClick={downloadTemplate} style={{ ...btnStyle, background: '#38a169', marginBottom: 20 }}>⬇ Download Template (.xlsx)</button>

          <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 14 }}>Required columns:</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EXCEL_COLUMNS.map((col) => (
                <span key={col} style={{ background: '#ebf8ff', color: '#2b6cb0', padding: '2px 10px', borderRadius: 12, fontSize: 13 }}>{col}</span>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Upload Excel file (.xlsx)</label>
            <input ref={excelRef} type="file" accept=".xlsx,.xls" onChange={handleExcelFile} style={{ display: 'block', marginTop: 4 }} />
          </div>

          {excelRows.length > 0 && (
            <div>
              <p style={{ color: '#276749', fontSize: 14 }}>{excelRows.length} rows detected. Preview:</p>
              <div style={{ overflowX: 'auto', maxHeight: 240, border: '1px solid #e2e8f0', borderRadius: 6 }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr>{EXCEL_COLUMNS.map((c) => <th key={c} style={{ ...th, background: '#f7fafc' }}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {excelRows.slice(0, 5).map((row, i) => (
                      <tr key={i}>{EXCEL_COLUMNS.map((c) => <td key={c} style={td}>{row[c] ?? ''}</td>)}</tr>
                    ))}
                    {excelRows.length > 5 && <tr><td colSpan={6} style={{ ...td, color: '#718096', textAlign: 'center' }}>…and {excelRows.length - 5} more rows</td></tr>}
                  </tbody>
                </table>
              </div>
              <button onClick={importExcel} disabled={loading} style={{ ...btnStyle, marginTop: 12 }}>{loading ? 'Importing…' : `Import ${excelRows.length} Products`}</button>
            </div>
          )}
        </div>
      )}

      {/* ── Combos Tab ── */}
      {tab === 'combos' && (
        <div>
          <h3 style={{ marginTop: 0 }}>Create Promo Combo</h3>
          <form onSubmit={submitCombo} style={formStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Combo Name *</label>
                <input value={comboForm.name} onChange={(e) => setComboForm((f) => ({ ...f, name: e.target.value }))} required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Promo Price *</label>
                <input type="number" step="0.01" value={comboForm.promo_price} onChange={(e) => setComboForm((f) => ({ ...f, promo_price: e.target.value }))} required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Currency *</label>
                <input value={comboForm.currency} onChange={(e) => setComboForm((f) => ({ ...f, currency: e.target.value }))} required style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Select Products (min 2) *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {products.map((p) => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', border: `1px solid ${comboForm.product_ids.includes(p.id) ? '#3182ce' : '#e2e8f0'}`, borderRadius: 6, cursor: 'pointer', background: comboForm.product_ids.includes(p.id) ? '#ebf8ff' : undefined, fontSize: 13 }}>
                    <input type="checkbox" checked={comboForm.product_ids.includes(p.id)} onChange={() => toggleComboProduct(p.id)} />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" style={btnStyle}>Create Combo</button>
          </form>

          <h3>Existing Combos</h3>
          {combos.length === 0 && <p style={{ color: '#a0aec0' }}>No combos yet</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {combos.map((c) => (
              <div key={c.id} style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{c.name}</strong>
                  <span style={{ marginLeft: 12, color: '#38a169', fontWeight: 600 }}>{c.currency} {c.promoPrice}</span>
                  <span style={{ marginLeft: 12, fontSize: 12, color: '#718096' }}>{c.productIds.length} products</span>
                </div>
                <button onClick={async () => { await apiFetch(`/catalogue/combos/${c.id}`, { method: 'DELETE' }); loadCombos(); }} style={{ ...smallBtn, background: '#e53e3e' }}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 700, marginBottom: 24 };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: 3 };
const inputStyle: React.CSSProperties = { padding: '8px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #cbd5e0', width: '100%', boxSizing: 'border-box' };
const btnStyle: React.CSSProperties = { padding: '9px 20px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const smallBtn: React.CSSProperties = { padding: '4px 10px', background: '#4a5568', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 };
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #e2e8f0', fontSize: 13, fontWeight: 600, color: '#4a5568' };
const td: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #f0f0f0', fontSize: 14, verticalAlign: 'middle' };
const errStyle: React.CSSProperties = { color: '#c53030', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 6, padding: '8px 12px', fontSize: 14 };
const okStyle: React.CSSProperties = { color: '#276749', background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 6, padding: '8px 12px', fontSize: 14 };
const tabBtn: React.CSSProperties = { padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 };
const imageSlot: React.CSSProperties = { width: 90, height: 90, border: '2px dashed #cbd5e0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', cursor: 'pointer', background: '#f7fafc' };
const editableCell: React.CSSProperties = { cursor: 'pointer', borderBottom: '1px dashed #a0aec0', paddingBottom: 1 };
