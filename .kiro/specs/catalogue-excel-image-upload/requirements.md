# Requirements Document

## Introduction

This feature extends the existing catalogue Excel bulk import to support product images. Currently the Excel template covers six columns (name, description, price, currency, stock_quantity, category) and the import endpoint stores products with no images. Businesses need a convenient way to supply images alongside product data in the same spreadsheet, and those images must be immediately visible and editable in the product details view — identical in behaviour to images uploaded manually through the product form.

The chosen approach is a comma-separated `image_urls` column in the Excel template. Each cell may contain up to three publicly-accessible image URLs separated by commas. This avoids ZIP bundles or a separate upload step, keeps the import flow single-file, and works with images already hosted anywhere (CDN, S3, MinIO, etc.). The existing `/catalogue/upload-image` endpoint remains available for businesses that want to upload local files first and then paste the returned URLs into the spreadsheet.

## Glossary

- **Import_Service**: The server-side module (`importProductsFromCsv`) that parses CSV text and inserts product rows into PostgreSQL.
- **Excel_Importer**: The client-side logic in `Catalogue.tsx` that reads an `.xlsx` file, converts it to CSV, and POSTs to `/catalogue/products/import`.
- **Product_Edit_Form**: The add/edit product form in the Products tab of `Catalogue.tsx` that displays up to three image slots.
- **Image_URL**: A string that begins with `http://` or `https://` and is syntactically valid per RFC 3986.
- **image_urls column**: The new optional column added to the Excel template, containing zero to three comma-separated Image_URLs per row.
- **Validator**: The row-validation logic inside `Import_Service` (`validateCsvRow`).

## Requirements

### Requirement 1: Excel Template Includes Image Column

**User Story:** As a business owner, I want the downloadable Excel template to include an `image_urls` column, so that I know exactly where to enter image URLs when preparing my product spreadsheet.

#### Acceptance Criteria

1. THE Excel_Importer SHALL include `image_urls` as the seventh column header in the downloaded template file.
2. THE Excel_Importer SHALL include an example row that demonstrates a comma-separated list of up to three Image_URLs in the `image_urls` column.
3. THE Excel_Importer SHALL display `image_urls` as a recognised column badge in the "Required columns" section of the import tab UI.

---

### Requirement 2: Image URL Parsing and Validation

**User Story:** As a business owner, I want the import to validate image URLs so that only well-formed URLs are stored against my products.

#### Acceptance Criteria

1. WHEN a row's `image_urls` cell contains one or more comma-separated values, THE Validator SHALL accept each value that begins with `http://` or `https://` and is a syntactically valid URL.
2. WHEN a row's `image_urls` cell contains a value that does not begin with `http://` or `https://`, THE Validator SHALL reject the entire row and include the row number and the reason `"Invalid image URL: <value>"` in the import error list.
3. WHEN a row's `image_urls` cell is empty or the column is absent, THE Validator SHALL treat the product as having no images and SHALL NOT reject the row on that basis.
4. WHEN a row's `image_urls` cell contains more than three comma-separated URLs, THE Import_Service SHALL store only the first three URLs and SHALL NOT reject the row.
5. THE Import_Service SHALL trim whitespace from each URL before validation and storage.

---

### Requirement 3: Image URLs Persisted on Import

**User Story:** As a business owner, I want images I specify in the spreadsheet to be saved against the correct product, so that they appear immediately after import without any extra steps.

#### Acceptance Criteria

1. WHEN a product row is successfully imported and its `image_urls` cell contains valid URLs, THE Import_Service SHALL persist those URLs in the `image_urls` array column of the `products` table for that product.
2. WHEN a product row is successfully imported and its `image_urls` cell is empty or absent, THE Import_Service SHALL persist an empty array in the `image_urls` column for that product.
3. FOR ALL successfully imported products, fetching the product via `GET /catalogue/products/:id` SHALL return `imageUrls` equal to the URLs that were in the spreadsheet row (round-trip property).

---

### Requirement 4: Imported Product Images Visible in Product Table

**User Story:** As a business owner, I want to see thumbnail images for imported products in the product list, so that I can confirm images were imported correctly at a glance.

#### Acceptance Criteria

1. WHEN an imported product has one or more `imageUrls`, THE Product_Edit_Form SHALL render up to three thumbnail images in the Images column of the products table, identical to the rendering for manually-created products.
2. WHEN an imported product has no `imageUrls`, THE Product_Edit_Form SHALL display the "No images" placeholder in the Images column, identical to the rendering for manually-created products.

---

### Requirement 5: Imported Product Images Editable in Product Edit Form

**User Story:** As a business owner, I want to add, replace, or remove images on an imported product using the same edit form I use for manually-created products, so that the editing experience is consistent.

#### Acceptance Criteria

1. WHEN a business owner opens the edit form for an imported product, THE Product_Edit_Form SHALL pre-populate each occupied image slot with the corresponding thumbnail from `imageUrls`, in index order.
2. WHEN a business owner uploads a new file into an image slot on an imported product, THE Product_Edit_Form SHALL replace that slot's URL with the newly uploaded URL on save, leaving other slots unchanged.
3. WHEN a business owner saves the edit form for an imported product with no new images selected, THE Product_Edit_Form SHALL preserve the existing `imageUrls` from the import unchanged.
4. WHEN a business owner clears an image slot on an imported product and saves, THE Product_Edit_Form SHALL remove that URL from `imageUrls` for that product.
5. THE Product_Edit_Form SHALL behave identically for imported products and manually-created products with respect to all image slot operations (add, replace, clear).

---

### Requirement 6: Import Error Reporting for Invalid Image URLs

**User Story:** As a business owner, I want clear error messages when image URLs in my spreadsheet are invalid, so that I can fix the specific rows and re-import.

#### Acceptance Criteria

1. WHEN the import completes and one or more rows were skipped due to invalid image URLs, THE Excel_Importer SHALL display each skipped row's number and reason in the existing error display area.
2. WHEN a row is skipped due to an invalid image URL, THE Import_Service SHALL include `{ row: <number>, reason: "Invalid image URL: <value>" }` in the `errors` array of the import result.
3. WHEN all rows have valid or absent image URLs, THE Import_Service SHALL return an empty `errors` array (assuming no other validation failures).

---

### Requirement 7: Backward Compatibility

**User Story:** As a business owner using an older template without the `image_urls` column, I want my existing spreadsheets to continue importing successfully, so that I am not forced to update my files.

#### Acceptance Criteria

1. WHEN an uploaded Excel file does not contain an `image_urls` column, THE Import_Service SHALL import all rows successfully with empty `imageUrls` arrays, without returning any errors related to the missing column.
2. WHEN an uploaded Excel file contains the `image_urls` column with all cells empty, THE Import_Service SHALL import all rows successfully with empty `imageUrls` arrays.

---

### Requirement 8: Import Preview Shows Image URL Column

**User Story:** As a business owner, I want the import preview table to show the `image_urls` column so that I can verify the URLs before committing the import.

#### Acceptance Criteria

1. WHEN an Excel file containing an `image_urls` column is loaded, THE Excel_Importer SHALL include `image_urls` as a column in the preview table.
2. WHEN an Excel file does not contain an `image_urls` column, THE Excel_Importer SHALL omit the `image_urls` column from the preview table and SHALL NOT display an empty column.

---

## Correctness Properties

### Property 1: Image URL Round-Trip

For all valid Excel rows containing one to three well-formed Image_URLs, importing the row and then fetching the product via `GET /catalogue/products/:id` must return `imageUrls` equal to the original URL list (order preserved, count preserved).

- Pattern: Round-Trip
- Validates: Requirement 3 AC3

### Property 2: Invalid URL Always Rejected

For all strings that are not syntactically valid `http://` or `https://` URLs, the Validator must return a non-null error reason containing `"Invalid image URL"`.

- Pattern: Error Conditions
- Validates: Requirement 2 AC2

### Property 3: Valid URL Always Accepted

For all syntactically valid `http://` or `https://` URLs, the Validator must return null (no error) when that URL appears alone in the `image_urls` cell.

- Pattern: Invariant
- Validates: Requirement 2 AC1

### Property 4: Maximum Three Images Enforced

For all rows where the `image_urls` cell contains N > 3 valid URLs, the persisted `imageUrls` array must have length exactly 3 (the first three URLs).

- Pattern: Invariant (`imageUrls.length <= 3`)
- Validates: Requirement 2 AC4

### Property 5: Empty Image Column Does Not Cause Rejection

For all otherwise-valid rows where `image_urls` is empty or absent, `validateCsvRow` must return null.

- Pattern: Edge-case / Invariant
- Validates: Requirement 2 AC3, Requirement 7

### Property 6: Image Edit Parity (Imported vs Manual)

For any product P1 created via import with image_urls [A, B] and any product P2 created manually with image_urls [A, B], applying the same PUT `/catalogue/products/:id` payload to both must produce identical `imageUrls` in the response.

- Pattern: Metamorphic
- Validates: Requirement 5 AC5
