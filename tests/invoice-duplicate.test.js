import assert from "node:assert/strict";
import test from "node:test";
import { findInvoiceDuplicate } from "../invoice-duplicate.js";

const demoInvoices = [
  {
    supplier: "Proveedor de demostración",
    invoiceNumber: "DEMO-STATIC-001",
    invoiceDate: "2026-01-01",
    total: 100,
    currency: "MXN",
  },
];

function invoice(supplier, invoiceNumber, total = 100) {
  return {
    supplier,
    invoiceNumber,
    invoiceDate: "2026-11-03",
    total,
    currency: "MXN",
  };
}

test("matches the static registry by supplier and invoice number", () => {
  const duplicate = findInvoiceDuplicate(
    demoInvoices,
    invoice("Proveedor de demostración", "DEMO-STATIC-001"),
  );

  assert.equal(duplicate.matchType, "supplier_and_invoice_number");
  assert.equal(duplicate.source, "demo_registry");
});

test("flags a repeated invoice number without a supplier as a possible match", () => {
  const firstAnalysis = invoice(null, "REPEAT-UNKNOWN-SUPPLIER-001");
  assert.equal(findInvoiceDuplicate(demoInvoices, firstAnalysis), null);

  const repeatedAnalysis = findInvoiceDuplicate(
    demoInvoices,
    invoice(null, "REPEAT-UNKNOWN-SUPPLIER-001"),
  );

  assert.equal(repeatedAnalysis.matchType, "invoice_number_only");
  assert.equal(repeatedAnalysis.source, "previous_analysis");
});

test("a later supplier extraction enriches an earlier folio-only match", () => {
  assert.equal(
    findInvoiceDuplicate(demoInvoices, invoice(null, "LATE-SUPPLIER-001")),
    null,
  );
  assert.equal(
    findInvoiceDuplicate(
      demoInvoices,
      invoice("Proveedor identificado después", "LATE-SUPPLIER-001"),
    ).matchType,
    "invoice_number_only",
  );
  assert.equal(
    findInvoiceDuplicate(
      demoInvoices,
      invoice("Proveedor identificado después", "LATE-SUPPLIER-001"),
    ).matchType,
    "supplier_and_invoice_number",
  );
});

test("does not treat a shared invoice number from different known suppliers as an exact duplicate", () => {
  assert.equal(
    findInvoiceDuplicate(
      demoInvoices,
      invoice("Proveedor A", "SHARED-NUMBER-001"),
    ),
    null,
  );
  assert.equal(
    findInvoiceDuplicate(
      demoInvoices,
      invoice("Proveedor B", "SHARED-NUMBER-001"),
    ),
    null,
  );
});

test("does not use the invoice total as a duplicate key", () => {
  assert.equal(
    findInvoiceDuplicate(demoInvoices, invoice("Proveedor C", "TOTAL-001", 1800)),
    null,
  );
  assert.equal(
    findInvoiceDuplicate(demoInvoices, invoice("Proveedor C", "TOTAL-002", 1800)),
    null,
  );
});

test("does not match or store invoices without an extracted invoice number", () => {
  assert.equal(
    findInvoiceDuplicate(demoInvoices, invoice("Proveedor D", null)),
    null,
  );
});
