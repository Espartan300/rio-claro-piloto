const viewTriggers = document.querySelectorAll("[data-view-target]");
const viewPanels = document.querySelectorAll("[data-view-panel]");
const navigationButtons = document.querySelectorAll(".primary-nav [data-view-target]");

function showView(viewName) {
  const activePanel = document.querySelector(`[data-view-panel="${viewName}"]`);
  if (!activePanel) {
    return;
  }

  for (const panel of viewPanels) {
    panel.hidden = panel !== activePanel;
  }

  for (const button of navigationButtons) {
    if (button.dataset.viewTarget === viewName) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  }
}

for (const trigger of viewTriggers) {
  trigger.addEventListener("click", (event) => {
    if (trigger instanceof HTMLAnchorElement) {
      event.preventDefault();
    }
    showView(trigger.dataset.viewTarget);
  });
}

const salesPalette = ["#4c125a", "#771968", "#a51d70", "#bd5d93", "#80528f"];
const svgNamespace = "http://www.w3.org/2000/svg";

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS(svgNamespace, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
}

function formatCurrency(value, compact = false) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

function formatDemoPrice(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function renderLegend(container, branches) {
  container.replaceChildren();
  for (const [index, branch] of branches.entries()) {
    const item = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = salesPalette[index % salesPalette.length];
    swatch.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = branch.name;
    item.append(swatch, label);
    container.append(item);
  }
}

function renderSalesChart(svg, months, series, title, description) {
  const width = 760;
  const plot = { left: 76, top: 24, right: 742, bottom: 258 };
  const values = series.flatMap((item) => item.values);
  const maxValue = Math.max(...values);
  const tickStep = Math.max(1, Math.ceil(maxValue / 4 / 100000)) * 100000;
  const chartMax = tickStep * 4;
  const x = (index) =>
    plot.left + (index * (plot.right - plot.left)) / Math.max(1, months.length - 1);
  const y = (value) => plot.bottom - (value / chartMax) * (plot.bottom - plot.top);

  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${width} 310`);
  svg.append(
    createSvgElement("title", { id: svg.getAttribute("aria-labelledby")?.split(" ")[0] }),
    createSvgElement("desc", { id: svg.getAttribute("aria-labelledby")?.split(" ")[1] }),
  );
  svg.querySelector("title").textContent = title;
  svg.querySelector("desc").textContent = description;

  for (let tick = 0; tick <= 4; tick += 1) {
    const value = tick * tickStep;
    const yPosition = y(value);
    const gridline = createSvgElement("line", {
      x1: plot.left,
      y1: yPosition,
      x2: plot.right,
      y2: yPosition,
      class: "chart-gridline",
    });
    const label = createSvgElement("text", {
      x: plot.left - 10,
      y: yPosition + 4,
      "text-anchor": "end",
      class: "chart-axis-label",
    });
    label.textContent = formatCurrency(value, true);
    svg.append(gridline, label);
  }

  for (const [index, month] of months.entries()) {
    const label = createSvgElement("text", {
      x: x(index),
      y: plot.bottom + 22,
      "text-anchor": "middle",
      class: "chart-axis-label",
    });
    label.textContent = month.slice(0, 3);
    svg.append(label);
  }

  for (const [seriesIndex, item] of series.entries()) {
    const color = salesPalette[seriesIndex % salesPalette.length];
    const path = createSvgElement("path", {
      d: item.values.map((value, index) =>
        `${index === 0 ? "M" : "L"} ${x(index)} ${y(value)}`,
      ).join(" "),
      class: "chart-series-line",
      stroke: color,
    });
    svg.append(path);

    for (const [index, value] of item.values.entries()) {
      svg.append(createSvgElement("circle", {
        cx: x(index),
        cy: y(value),
        r: 3.5,
        class: "chart-series-dot",
        fill: color,
      }));
    }
  }
}

let salesCatalogData = null;

function validateSalesData(data) {
  if (
    !data ||
    !Number.isInteger(data.year) ||
    data.currency !== "MXN" ||
    typeof data.inventoryAsOf !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.inventoryAsOf) ||
    !Array.isArray(data.branches) ||
    data.branches.length === 0 ||
    !Array.isArray(data.products) ||
    !Array.isArray(data.monthlySales) ||
    data.monthlySales.length === 0
  ) {
    throw new Error("Sales and catalog demo data has an invalid structure.");
  }

  const branchIds = data.branches.map((branch) => branch.id);
  if (
    branchIds.some((id) => typeof id !== "string" || id.length === 0) ||
    new Set(branchIds).size !== branchIds.length ||
    data.branches.some((branch) => typeof branch.name !== "string" || branch.name.length === 0)
  ) {
    throw new Error("Sales demo branch definitions are invalid.");
  }

  if (data.monthlySales.some((month) =>
    typeof month.month !== "string" ||
    !month.branchAmounts ||
    branchIds.some((id) =>
      typeof month.branchAmounts[id] !== "number" ||
      !Number.isFinite(month.branchAmounts[id]) ||
      month.branchAmounts[id] < 0,
    ),
  )) {
    throw new Error("Monthly sales demo data is invalid.");
  }

  if (data.products.some((product) =>
    typeof product.sku !== "string" ||
    typeof product.name !== "string" ||
    typeof product.category !== "string" ||
    typeof product.unit !== "string" ||
    typeof product.price !== "number" ||
    !Number.isFinite(product.price) ||
    product.price < 0 ||
    !product.stockByBranch ||
    data.branches.some((branch) =>
      !Number.isInteger(product.stockByBranch[branch.id]) ||
      product.stockByBranch[branch.id] < 0,
    ) ||
    !Array.isArray(product.aliases) ||
    product.aliases.some((alias) => typeof alias !== "string"),
  )) {
    throw new Error("Demo product catalog data is invalid.");
  }
}

function renderSalesTable(table, data) {
  const head = table.querySelector("thead");
  const body = table.querySelector("tbody");
  const foot = table.querySelector("tfoot");
  const headerRow = document.createElement("tr");
  const monthHeader = document.createElement("th");
  monthHeader.scope = "col";
  monthHeader.textContent = "Mes";
  headerRow.append(monthHeader);

  for (const branch of data.branches) {
    const header = document.createElement("th");
    header.scope = "col";
    header.textContent = branch.name;
    headerRow.append(header);
  }
  const totalHeader = document.createElement("th");
  totalHeader.scope = "col";
  totalHeader.textContent = "Total del mes";
  headerRow.append(totalHeader);
  head.replaceChildren(headerRow);
  body.replaceChildren();

  const branchTotals = Object.fromEntries(data.branches.map((branch) => [branch.id, 0]));
  let annualTotal = 0;
  for (const month of data.monthlySales) {
    const row = document.createElement("tr");
    const monthCell = document.createElement("th");
    monthCell.scope = "row";
    monthCell.textContent = month.month;
    row.append(monthCell);
    let monthTotal = 0;

    for (const branch of data.branches) {
      const amount = month.branchAmounts[branch.id];
      branchTotals[branch.id] += amount;
      monthTotal += amount;
      const cell = document.createElement("td");
      cell.textContent = formatCurrency(amount);
      row.append(cell);
    }

    annualTotal += monthTotal;
    const totalCell = document.createElement("td");
    totalCell.textContent = formatCurrency(monthTotal);
    row.append(totalCell);
    body.append(row);
  }

  const totalRow = document.createElement("tr");
  const totalLabel = document.createElement("th");
  totalLabel.scope = "row";
  totalLabel.textContent = "Total del año";
  totalRow.append(totalLabel);
  for (const branch of data.branches) {
    const cell = document.createElement("td");
    cell.textContent = formatCurrency(branchTotals[branch.id]);
    totalRow.append(cell);
  }
  const grandTotal = document.createElement("td");
  grandTotal.textContent = formatCurrency(annualTotal);
  totalRow.append(grandTotal);
  foot.replaceChildren(totalRow);
}

function renderCatalogTable(table, products) {
  const body = table.querySelector("tbody");
  body.replaceChildren();
  for (const product of products) {
    const row = document.createElement("tr");
    const values = [
      product.sku,
      product.name,
      product.category,
      product.unit,
      product.aliases.join(", "),
    ];
    for (const [index, value] of values.entries()) {
      const cell = document.createElement("td");
      if (index === values.length - 1) {
        cell.className = "catalog-aliases";
      }
      cell.textContent = value;
      row.append(cell);
    }
    body.append(row);
  }
}

function renderInventoryTable(table, data) {
  const body = table.querySelector("tbody");
  body.replaceChildren();
  for (const product of data.products) {
    const row = document.createElement("tr");
    const productCell = document.createElement("td");
    productCell.className = "inventory-product";
    productCell.textContent = `${product.name} (${product.unit})`;
    const priceCell = document.createElement("td");
    priceCell.textContent = formatDemoPrice(product.price);
    const availabilityCell = document.createElement("td");
    availabilityCell.className = "inventory-branches";
    const availabilityList = document.createElement("ul");
    const total = data.branches.reduce(
      (sum, branch) => sum + product.stockByBranch[branch.id],
      0,
    );
    const totalItem = document.createElement("li");
    totalItem.textContent = `Total demo: ${total.toLocaleString("es-MX")} unidades`;
    availabilityList.append(totalItem);
    for (const branch of data.branches) {
      const item = document.createElement("li");
      item.textContent =
        `${branch.name}: ${product.stockByBranch[branch.id].toLocaleString("es-MX")}`;
      availabilityList.append(item);
    }
    availabilityCell.append(availabilityList);
    row.append(productCell, priceCell, availabilityCell);
    body.append(row);
  }
}

async function loadSalesAndCatalog() {
  const homeStatus = document.querySelector("#home-sales-status");
  const detailStatus = document.querySelector("#sales-catalog-status");

  try {
    const response = await fetch("/data/ventas-catalogo-demo.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load demo dashboard data (HTTP ${response.status}).`);
    }
    const data = await response.json();
    validateSalesData(data);
    salesCatalogData = data;

    const months = data.monthlySales.map((item) => item.month);
    const monthlyTotals = data.monthlySales.map((month) =>
      data.branches.reduce((sum, branch) => sum + month.branchAmounts[branch.id], 0),
    );
    const annualTotal = monthlyTotals.reduce((sum, value) => sum + value, 0);
    const peakIndex = monthlyTotals.indexOf(Math.max(...monthlyTotals));
    const monthlySeries = [{ name: "Total simulado", values: monthlyTotals }];
    const branchSeries = data.branches.map((branch) => ({
      name: branch.name,
      values: data.monthlySales.map((month) => month.branchAmounts[branch.id]),
    }));

    document.querySelector("#home-simulation-badge").textContent =
      `Simulación anual ${data.year}`;
    document.querySelector("#home-annual-sales").textContent = formatCurrency(annualTotal);
    document.querySelector("#home-peak-month").textContent =
      `${months[peakIndex]} · ${formatCurrency(monthlyTotals[peakIndex])}`;
    document.querySelector("#home-branch-count").textContent =
      `${data.branches.length} sucursales`;

    renderSalesChart(
      document.querySelector("#home-sales-chart"),
      months,
      monthlySeries,
      `Ventas mensuales simuladas de ${data.year}`,
      `Total sintético de las cinco sucursales para cada mes de ${data.year}. No representa ventas reales.`,
    );
    renderLegend(document.querySelector("#home-sales-legend"), monthlySeries);
    renderSalesChart(
      document.querySelector("#branch-sales-chart"),
      months,
      branchSeries,
      `Ventas mensuales simuladas por sucursal en ${data.year}`,
      "Cinco series sintéticas comparan Guadalajara, Zapopan, León, Querétaro y Aguascalientes. Los valores no son ventas reales.",
    );
    renderLegend(document.querySelector("#branch-sales-legend"), data.branches);
    renderSalesTable(document.querySelector("#sales-table"), data);
    renderCatalogTable(document.querySelector("#catalog-table"), data.products);
    renderInventoryTable(document.querySelector("#inventory-table"), data);
    document.querySelector("#inventory-cutoff-badge").textContent =
      `Corte simulado · ${new Intl.DateTimeFormat("es-MX").format(new Date(`${data.inventoryAsOf}T12:00:00`))}`;
    document.querySelector("#sales-period-label").textContent =
      `${months.length} meses · ejercicio simulado ${data.year}`;
    homeStatus.textContent =
      `Simulación cargada: ${months.length} meses y ${data.branches.length} sucursales. Las cifras no son datos observados.`;
    detailStatus.textContent =
      `Datos de demostración cargados: ${months.length} meses y ${data.products.length} productos sintéticos.`;
  } catch (error) {
    console.error("Could not load demo sales and catalog data:", error);
    homeStatus.textContent =
      "No se pudieron cargar los datos sintéticos. Recarga la página para volver a intentar.";
    detailStatus.textContent =
      "No se pudo cargar el conjunto de demostración. Recarga la página para volver a intentar.";
  }
}

loadSalesAndCatalog();

const form = document.querySelector("#chat-form");
const messageInput = document.querySelector("#message");
const chatLog = document.querySelector("#chat-log");
const statusMessage = document.querySelector("#chat-status");
const characterCount = document.querySelector("#character-count");
const sendButton = form.querySelector("button[type='submit']");
const emptyState = document.querySelector("#empty-state");

let conversationId = null;
let lastCatalogProductSku = null;
let isSending = false;

function updateFormState() {
const trimmedLength = messageInput.value.trim().length;
characterCount.textContent = `${messageInput.value.length}/2000`;
sendButton.disabled = isSending || trimmedLength < 1 || trimmedLength > 2000;
}

function appendMessage(role, text) {
if (emptyState?.isConnected) {
emptyState.remove();
}

const messageElement = document.createElement("p");
messageElement.className = role === "user"
? "message message-user"
: "message message-assistant";
messageElement.textContent = text;
chatLog.append(messageElement);
chatLog.scrollTop = chatLog.scrollHeight;
}

function normalizeCatalogText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getCatalogAnswer(message) {
  const normalizedMessage = normalizeCatalogText(message);
  const mentionedProduct = salesCatalogData?.products.find((candidate) =>
    [candidate.name, ...candidate.aliases].some((name) =>
      normalizedMessage.includes(normalizeCatalogText(name)),
    ),
  );
  const isMissingStockQuestion =
    /\b(no tenemos|no hay|no tiene|no tienen|sin existencias?|agotad[oa]s?|no queda|no quedan|ya no hay|se acabo)\b/
      .test(normalizedMessage);
  const isCatalogQuestion =
    /\b(precio|precios|cuanto cuesta|cuanto vale|existencia|existencias|inventario|stock|disponible|disponibilidad|unidades|cantidad|sucursal)\b/
      .test(normalizedMessage) ||
    isMissingStockQuestion ||
    (Boolean(mentionedProduct) && /\b(hay|queda|quedan)\b/.test(normalizedMessage)) ||
    /\bcuanto\b.*\b(queda|quedan|hay)\b/.test(normalizedMessage);
  const requestedBranch = salesCatalogData?.branches.find((branch) =>
    normalizedMessage.includes(normalizeCatalogText(branch.name)),
  );
  const isBranchFollowUp =
    Boolean(lastCatalogProductSku && requestedBranch) &&
    normalizedMessage.split(" ").length <= 6;

  if (!isCatalogQuestion && !isBranchFollowUp) {
    return null;
  }

  if (!salesCatalogData) {
    return {
      productSku: null,
      message: "No pude cargar el catálogo de demostración. No consultaré IA para inventar precios o existencias; recarga la página e inténtalo de nuevo.",
    };
  }

  const product = mentionedProduct ?? (isBranchFollowUp
    ? salesCatalogData.products.find((candidate) => candidate.sku === lastCatalogProductSku)
    : undefined);

  if (!product) {
    return {
      productSku: null,
      message: "No identifiqué el producto en el catálogo sintético. Prueba con un nombre normalizado, por ejemplo «cloro de litro», o revisa Ventas y catálogo. No enviaré una consulta de existencias o precio al modelo para evitar una respuesta inventada.",
    };
  }

  const total = Object.values(product.stockByBranch)
    .reduce((sum, quantity) => sum + quantity, 0);
  const queriedBranches = requestedBranch ? [requestedBranch] : salesCatalogData.branches;
  const outOfStockBranches = queriedBranches.filter(
    (branch) => product.stockByBranch[branch.id] === 0,
  );
  let stockSummary;
  if (isMissingStockQuestion) {
    stockSummary = outOfStockBranches.length > 0
      ? `Sin existencias de demostración: ${outOfStockBranches.map((branch) => branch.name).join(", ")} (0 unidades de venta de ${product.unit}).`
      : `No se identifican sucursales sin existencias de demostración${requestedBranch ? ` en ${requestedBranch.name}` : ""}.`;
  } else if (requestedBranch) {
    stockSummary =
      `${requestedBranch.name}: ${product.stockByBranch[requestedBranch.id].toLocaleString("es-MX")} unidades de venta simuladas (${product.unit}).`;
  } else {
    const stockDetails = salesCatalogData.branches
      .map((branch) =>
        `${branch.name}: ${product.stockByBranch[branch.id].toLocaleString("es-MX")}`,
      )
      .join("; ");
    stockSummary =
      `${stockDetails}. Total de demostración: ${total.toLocaleString("es-MX")} unidades de venta (${product.unit}).`;
  }

  return {
    productSku: product.sku,
    message: `Dato sintético, no es disponibilidad real. ${product.name} (${product.sku}). Precio demo: ${formatDemoPrice(product.price)} MXN por ${product.unit}. Existencias simuladas al ${new Intl.DateTimeFormat("es-MX").format(new Date(`${salesCatalogData.inventoryAsOf}T12:00:00`))}: ${stockSummary}`,
  };
}

messageInput.addEventListener("input", updateFormState);

form.addEventListener("submit", async (event) => {
event.preventDefault();
const message = messageInput.value.trim();

if (isSending || message.length < 1 || message.length > 2000) {
return;
}

const catalogAnswer = getCatalogAnswer(message);
if (catalogAnswer) {
  appendMessage("user", message);
  appendMessage("assistant", catalogAnswer.message);
  conversationId = null;
  lastCatalogProductSku = catalogAnswer.productSku;
  messageInput.value = "";
  statusMessage.textContent = "Respuesta del catálogo sintético; no se consultó IA.";
  updateFormState();
  return;
}

lastCatalogProductSku = null;
isSending = true;
updateFormState();
statusMessage.textContent = "Consultando al asistente…";

try {
const payload = { message };
if (conversationId) {
payload.conversationId = conversationId;
}

const response = await fetch("/api/chat", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});

let data;
try {
data = await response.json();
} catch {
data = null;
}

if (!response.ok) {
if (response.status !== 422) {
conversationId = null;
}
const errorText = data && typeof data.error === "string"
? data.error
: "El servidor devolvió una respuesta inválida.";
statusMessage.textContent = response.status === 422
? errorText
: `${errorText} El siguiente intento comenzará una conversación nueva.`;
return;
}

if (
!data ||
typeof data.message !== "string" ||
data.message.trim().length === 0 ||
typeof data.conversationId !== "string" ||
data.conversationId.length === 0
) {
conversationId = null;
statusMessage.textContent = "La respuesta no tenía el formato esperado. El siguiente intento comenzará una conversación nueva.";
return;
}

appendMessage("user", message);
appendMessage("assistant", data.message);
conversationId = data.conversationId;
messageInput.value = "";
statusMessage.textContent = "";
} catch {
conversationId = null;
statusMessage.textContent = "No se pudo conectar con el asistente. Comprueba que el servidor esté activo; el siguiente intento comenzará una conversación nueva.";
} finally {
isSending = false;
updateFormState();
messageInput.focus();
}
});

updateFormState();
const invoiceForm = document.querySelector("#invoice-form");
const invoiceFile = document.querySelector("#invoice-file");
const invoiceButton = invoiceForm.querySelector("button[type='submit']");
const invoiceStatus = document.querySelector("#invoice-status");
const invoiceResult = document.querySelector("#invoice-result");
const invoiceVendor = document.querySelector("#invoice-vendor");
const invoiceNumber = document.querySelector("#invoice-number");
const invoiceDate = document.querySelector("#invoice-date");
const invoiceTotal = document.querySelector("#invoice-total");
const invoiceReview = document.querySelector("#invoice-review");

let isAnalyzingInvoice = false;

invoiceFile.addEventListener("change", () => {
  invoiceStatus.textContent = "";
  invoiceResult.hidden = true;
  invoiceButton.disabled = isAnalyzingInvoice || invoiceFile.files.length === 0;
});

invoiceForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = invoiceFile.files[0];
  if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
    invoiceStatus.textContent = "Selecciona un archivo PDF sintético.";
    return;
  }
  if (file.size === 0 || file.size > 5 * 1024 * 1024) {
    invoiceStatus.textContent = "El archivo debe tener contenido y pesar como máximo 5 MB.";
    return;
  }

  isAnalyzingInvoice = true;
  invoiceButton.disabled = true;
  invoiceStatus.textContent = "Analizando la factura sintética…";
  invoiceResult.hidden = true;

  try {
    const response = await fetch("/api/invoices/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: file,
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      invoiceStatus.textContent =
        typeof data?.error === "string"
          ? data.error
          : "No se pudo analizar el archivo.";
      return;
    }

    const extracted = data?.extracted;
    if (!extracted || data.humanReviewRequired !== true) {
      invoiceStatus.textContent = "El servidor devolvió una respuesta inesperada.";
      return;
    }

    invoiceVendor.textContent = extracted.supplier ?? "No identificado";
    invoiceNumber.textContent = extracted.invoiceNumber ?? "No identificado";
    invoiceDate.textContent = extracted.invoiceDate ?? "No identificada";
    invoiceTotal.textContent =
      typeof extracted.total === "number"
        ? `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(extracted.total)} ${extracted.currency ?? ""}`.trim()
        : "No identificado";

    const confidenceLabels = {
      supplier: "proveedor",
      invoiceNumber: "número de factura",
      invoiceDate: "fecha",
      total: "total",
    };
    const confidenceText = Object.entries(data.confidence ?? {})
      .filter(([, score]) => typeof score === "number")
      .map(([field, score]) =>
        `${confidenceLabels[field] ?? field}: ${Math.round(score * 100)} %`,
      )
      .join("; ");
    const reviewReasons = Array.isArray(data.reviewReasons)
      ? data.reviewReasons.filter((reason) => typeof reason === "string")
      : [];

    const duplicateMessage = data.possibleDuplicate === true
      ? `Posible duplicado: coincide el proveedor y el número de factura con un registro de demostración.${
          data.duplicateMatch?.invoiceDate
            ? ` Fecha del registro: ${data.duplicateMatch.invoiceDate}.`
            : ""
        }${
          typeof data.duplicateMatch?.total === "number"
            ? ` Total del registro: ${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(data.duplicateMatch.total)} ${data.duplicateMatch.currency ?? ""}.`
            : ""
        } Requiere revisión humana.`
      : data.possibleDuplicate === false
        ? "No se encontró coincidencia en el registro de demostración."
        : "No se pudo verificar si existe una coincidencia en el registro.";

    invoiceReview.textContent = [
      ...reviewReasons,
      confidenceText ? `Confianza: ${confidenceText}.` : "",
      duplicateMessage,
      "La revisión humana es obligatoria; este resultado no autoriza un pago.",
    ]
      .filter(Boolean)
      .join(" ");
    invoiceResult.hidden = false;
    invoiceStatus.textContent = "Análisis completado.";
  } catch {
    invoiceStatus.textContent =
      "No se pudo conectar con el servidor. Comprueba que siga activo.";
  } finally {
    isAnalyzingInvoice = false;
    invoiceButton.disabled = invoiceFile.files.length === 0;
  }
});
const textAnalysisForm = document.querySelector("#text-analysis-form");
const complaintInput = document.querySelector("#complaint-text");
const textAnalysisStatus = document.querySelector("#text-analysis-status");
const textAnalysisResult = document.querySelector("#text-analysis-result");
const textAnalysisSentiment = document.querySelector("#text-analysis-sentiment");
const textAnalysisAspects = document.querySelector("#text-analysis-aspects");
const textAnalysisReview = document.querySelector("#text-analysis-review");

let isAnalyzingText = false;

textAnalysisForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = complaintInput.value.trim();

  if (isAnalyzingText || text.length < 1 || text.length > 2000) {
    textAnalysisStatus.textContent = "Escribe un texto de 1 a 2000 caracteres.";
    return;
  }

  isAnalyzingText = true;
  textAnalysisStatus.textContent = "Analizando la queja sintética…";
  textAnalysisResult.hidden = true;

  try {
    const response = await fetch("/api/text-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      textAnalysisStatus.textContent =
        typeof data?.error === "string"
          ? data.error
          : "No se pudo analizar el texto.";
      return;
    }

    const validSentiments = ["negative", "neutral", "positive", "mixed"];
    const validCategories = ["delivery_delay", "damaged_goods", "other"];
    if (
      !data ||
      !validSentiments.includes(data.sentiment) ||
      !Array.isArray(data.aspects) ||
      data.aspects.some(
        (aspect) =>
          !aspect ||
          !validCategories.includes(aspect.category) ||
          typeof aspect.evidence !== "string",
      ) ||
      data.requiresHumanReview !== true
    ) {
      textAnalysisStatus.textContent = "El servidor devolvió un resultado inesperado.";
      return;
    }

    const sentimentLabels = {
      negative: "Negativo",
      neutral: "Neutral",
      positive: "Positivo",
      mixed: "Mixto",
    };
    const categoryLabels = {
      delivery_delay: "Entrega tardía",
      damaged_goods: "Mercancía dañada",
      other: "Otro aspecto",
    };

    textAnalysisSentiment.textContent =
      `Sentimiento: ${sentimentLabels[data.sentiment]}.`;
    textAnalysisAspects.replaceChildren();

    for (const aspect of data.aspects) {
      const item = document.createElement("li");
      item.textContent =
        `${categoryLabels[aspect.category]} — evidencia: “${aspect.evidence}”`;
      textAnalysisAspects.append(item);
    }

    if (data.aspects.length === 0) {
      const item = document.createElement("li");
      item.textContent = "No se identificaron aspectos claros en el texto.";
      textAnalysisAspects.append(item);
    }

    textAnalysisReview.textContent =
      "La revisión humana es obligatoria. El análisis no responde a la queja ni registra acciones.";
    textAnalysisResult.hidden = false;
    textAnalysisStatus.textContent = "Análisis completado.";
  } catch {
    textAnalysisStatus.textContent =
      "No se pudo conectar con el servidor. Comprueba que siga activo.";
  } finally {
    isAnalyzingText = false;
  }
});
const speechDictateButton = document.querySelector("#speech-dictate");
const speechReadButton = document.querySelector("#speech-read");
const speechStatus = document.querySelector("#speech-status");

let isSpeechBusy = false;

async function getSpeechConfig() {
  if (!window.SpeechSDK) {
    throw new Error("Speech SDK no está disponible en esta página.");
  }

  const response = await fetch("/api/speech-token", { method: "POST" });
  const data = await response.json();

  if (
    !response.ok ||
    typeof data.token !== "string" ||
    typeof data.region !== "string"
  ) {
    throw new Error("No se pudo preparar la conexión de voz.");
  }

  const config = window.SpeechSDK.SpeechConfig.fromAuthorizationToken(
    data.token,
    data.region,
  );
  config.speechRecognitionLanguage = "es-MX";
  config.speechSynthesisVoiceName = "es-MX-DaliaNeural";
  return config;
}

speechDictateButton.addEventListener("click", async () => {
  if (isSpeechBusy) return;

  isSpeechBusy = true;
  speechDictateButton.disabled = true;
  speechReadButton.disabled = true;
  speechStatus.textContent = "Escuchando una frase en español…";

  let recognizer;

  try {
    const config = await getSpeechConfig();
    const audioConfig = window.SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    recognizer = new window.SpeechSDK.SpeechRecognizer(config, audioConfig);

    const result = await new Promise((resolve, reject) => {
      recognizer.recognizeOnceAsync(resolve, reject);
    });

    if (
      result.reason !== window.SpeechSDK.ResultReason.RecognizedSpeech ||
      !result.text.trim()
    ) {
      speechStatus.textContent =
        "No se reconoció una frase. Intenta de nuevo en un lugar silencioso.";
      return;
    }

    complaintInput.value = result.text;
    speechStatus.textContent =
      "Transcripción lista. Revísala antes de enviarla al análisis.";
  } catch (error) {
    console.error("Speech recognition failed:", error);
    speechStatus.textContent =
      "No se pudo transcribir. Revisa el permiso del micrófono y vuelve a intentar.";
  } finally {
    recognizer?.close();
    isSpeechBusy = false;
    speechDictateButton.disabled = false;
    speechReadButton.disabled =
      !chatLog.querySelector(".message-assistant");
  }
});

speechReadButton.addEventListener("click", async () => {
  if (isSpeechBusy) return;

  const lastAssistantMessage = chatLog.querySelector(
    ".message-assistant:last-of-type",
  );
  const text = lastAssistantMessage?.textContent?.trim();

  if (!text) {
    speechStatus.textContent = "Todavía no hay una respuesta para leer.";
    speechReadButton.disabled = true;
    return;
  }

  isSpeechBusy = true;
  speechDictateButton.disabled = true;
  speechReadButton.disabled = true;
  speechStatus.textContent = "Preparando la lectura en voz alta…";

  let synthesizer;

  try {
    const config = await getSpeechConfig();
    synthesizer = new window.SpeechSDK.SpeechSynthesizer(config);

    await new Promise((resolve, reject) => {
      synthesizer.speakTextAsync(
        text,
        (result) => {
          if (result.reason === window.SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            speechStatus.textContent = "Lectura completada.";
            resolve();
          } else {
            reject(new Error("Speech synthesis did not complete."));
          }
        },
        reject,
      );
    });
  } catch (error) {
    console.error("Speech synthesis failed:", error);
    speechStatus.textContent =
      "No se pudo reproducir la respuesta. Comprueba el audio del dispositivo.";
  } finally {
    synthesizer?.close();
    isSpeechBusy = false;
    speechDictateButton.disabled = false;
    speechReadButton.disabled =
      !chatLog.querySelector(".message-assistant");
  }
});

const speechReadObserver = new MutationObserver(() => {
  speechReadButton.disabled =
    isSpeechBusy || !chatLog.querySelector(".message-assistant");
});

speechReadObserver.observe(chatLog, { childList: true });
const visionForm = document.querySelector("#vision-form");
const visionFile = document.querySelector("#vision-file");
const visionButton = visionForm.querySelector("button[type='submit']");
const visionStatus = document.querySelector("#vision-status");
const visionResult = document.querySelector("#vision-result");
const visionCount = document.querySelector("#vision-count");
const visionBoxes = document.querySelector("#vision-boxes");
const visionSummary = document.querySelector("#vision-summary");
const visionReview = document.querySelector("#vision-review");

let isAnalyzingImage = false;

visionFile.addEventListener("change", () => {
  visionStatus.textContent = "";
  visionResult.hidden = true;
  visionButton.disabled =
    isAnalyzingImage || visionFile.files.length === 0;
});

visionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = visionFile.files[0];
  if (!file || (!file.name.toLowerCase().endsWith(".png") && file.type !== "image/png")) {
    visionStatus.textContent = "Selecciona una imagen PNG sintética.";
    return;
  }
  if (file.size === 0 || file.size > 5 * 1024 * 1024) {
    visionStatus.textContent = "La imagen debe tener contenido y pesar como máximo 5 MB.";
    return;
  }

  isAnalyzingImage = true;
  visionButton.disabled = true;
  visionStatus.textContent = "Analizando la imagen sintética…";
  visionResult.hidden = true;

  try {
    const response = await fetch("/api/vision-analysis", {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: file,
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      visionStatus.textContent =
        typeof data?.error === "string"
          ? data.error
          : "No se pudo analizar la imagen.";
      return;
    }

    const validPositions = ["left", "center", "right", "other"];
    const validConditions = ["intact", "damaged", "unclear"];
    if (
      !data ||
      !Number.isInteger(data.boxCount) ||
      !Array.isArray(data.boxes) ||
      data.boxes.some(
        (box) =>
          !box ||
          !validPositions.includes(box.position) ||
          !validConditions.includes(box.condition) ||
          typeof box.visibleEvidence !== "string",
      ) ||
      typeof data.summary !== "string" ||
      data.requiresHumanReview !== true
    ) {
      visionStatus.textContent = "El servidor devolvió un resultado inesperado.";
      return;
    }

    const positionLabels = {
      left: "Izquierda",
      center: "Centro",
      right: "Derecha",
      other: "Otra posición",
    };
    const conditionLabels = {
      intact: "Sin daños visibles",
      damaged: "Dañada",
      unclear: "No se puede determinar",
    };

    visionCount.textContent = `Cajas detectadas: ${data.boxCount}.`;
    visionBoxes.replaceChildren();

    for (const box of data.boxes) {
      const item = document.createElement("li");
      item.textContent =
        `${positionLabels[box.position]} — ${conditionLabels[box.condition]}. Evidencia: ${box.visibleEvidence}`;
      visionBoxes.append(item);
    }

    visionSummary.textContent = data.summary;
    visionReview.textContent =
      "La revisión humana es obligatoria. El análisis visual no confirma el contenido ni determina responsabilidades.";
    visionResult.hidden = false;
    visionStatus.textContent = "Análisis visual completado.";
  } catch {
    visionStatus.textContent =
      "No se pudo conectar con el servidor. Comprueba que siga activo.";
  } finally {
    isAnalyzingImage = false;
    visionButton.disabled = visionFile.files.length === 0;
  }
});