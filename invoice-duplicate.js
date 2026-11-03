const analyzedInvoices = [];
const maxAnalyzedInvoices = 500;

function normalizeInvoiceKey(value) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-MX")
    : "";
}

export function findInvoiceDuplicate(registeredInvoices, extractedInvoice) {
  const invoiceNumberKey = normalizeInvoiceKey(extractedInvoice.invoiceNumber);
  if (!invoiceNumberKey) {
    return null;
  }

  const supplierKey = normalizeInvoiceKey(extractedInvoice.supplier);
  const candidates = [
    ...registeredInvoices.map((invoice) => ({
      invoice,
      source: "demo_registry",
    })),
    ...analyzedInvoices.map((invoice) => ({
      invoice,
      source: "previous_analysis",
    })),
  ];

  let duplicate = supplierKey
    ? candidates.find(
        ({ invoice }) =>
          normalizeInvoiceKey(invoice?.supplier) === supplierKey &&
          normalizeInvoiceKey(invoice?.invoiceNumber) === invoiceNumberKey,
      )
    : undefined;
  let matchType = "supplier_and_invoice_number";

  if (!duplicate) {
    duplicate = candidates.find(
      ({ invoice }) =>
        normalizeInvoiceKey(invoice?.invoiceNumber) === invoiceNumberKey &&
        (!supplierKey || !normalizeInvoiceKey(invoice?.supplier)),
    );
    matchType = "invoice_number_only";
  }

  if (!duplicate) {
    analyzedInvoices.push({
      supplier: extractedInvoice.supplier,
      invoiceNumber: extractedInvoice.invoiceNumber,
      invoiceDate: extractedInvoice.invoiceDate,
      total: extractedInvoice.total,
      currency: extractedInvoice.currency,
    });
    if (analyzedInvoices.length > maxAnalyzedInvoices) {
      analyzedInvoices.shift();
    }
    return null;
  }

  if (
    matchType === "invoice_number_only" &&
    supplierKey &&
    duplicate.source === "previous_analysis" &&
    !normalizeInvoiceKey(duplicate.invoice.supplier)
  ) {
    duplicate.invoice.supplier = extractedInvoice.supplier;
  }

  return {
    matchType,
    source: duplicate.source,
    invoiceDate: duplicate.invoice.invoiceDate ?? null,
    total: duplicate.invoice.total ?? null,
    currency: duplicate.invoice.currency ?? null,
  };
}
