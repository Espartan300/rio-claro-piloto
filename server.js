import express from "express";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";

const app = express();
const port = Number(process.env.PORT) || 3000;
const publicDirectory = fileURLToPath(new URL("./public/", import.meta.url));
const projectEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
const agentName = process.env.FOUNDRY_AGENT_NAME;
const textAnalysisAgentName = process.env.FOUNDRY_TEXT_AGENT_NAME;
const visionAgentName = process.env.FOUNDRY_VISION_AGENT_NAME;
const invoiceRegistryPath = fileURLToPath(
  new URL("./data/tests/registro-facturas-demo.json", import.meta.url),
);

if (!projectEndpoint) {
throw new Error("FOUNDRY_PROJECT_ENDPOINT is required.");
}
if (!agentName) {
throw new Error("FOUNDRY_AGENT_NAME is required.");
}
if (!textAnalysisAgentName) {
  throw new Error("FOUNDRY_TEXT_AGENT_NAME is required.");
}
if (!visionAgentName) {
  throw new Error("FOUNDRY_VISION_AGENT_NAME is required.");
}
const documentIntelligenceEndpoint =
  process.env.DOCUMENT_INTELLIGENCE_ENDPOINT?.replace(/\/+$/, "");
const documentIntelligenceKey = process.env.DOCUMENT_INTELLIGENCE_KEY;
const speechKey = process.env.SPEECH_KEY;
const speechRegion = process.env.SPEECH_REGION;

if (!documentIntelligenceEndpoint) {
  throw new Error("DOCUMENT_INTELLIGENCE_ENDPOINT is required.");
}
if (!documentIntelligenceKey) {
  throw new Error("DOCUMENT_INTELLIGENCE_KEY is required.");
}
if (!speechKey) {
  throw new Error("SPEECH_KEY is required.");
}
if (!speechRegion || !/^[a-z0-9]+$/.test(speechRegion)) {
  throw new Error("SPEECH_REGION is required and must be a region name.");
}

const project = new AIProjectClient(projectEndpoint, new DefaultAzureCredential());
const openai = project.getOpenAIClient();
const agentReference = {
body: {
agent_reference: { name: agentName, type: "agent_reference" },
},
};
const textAnalysisAgentReference = {
  body: {
    agent_reference: {
      name: textAnalysisAgentName,
      type: "agent_reference",
    },
  },
};
const visionAgentReference = {
  body: {
    agent_reference: {
      name: visionAgentName,
      type: "agent_reference",
    },
  },
};
function normalizeInvoiceKey(value) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-MX")
    : "";
}

app.use(express.json({ limit: "10kb" }));

app.get("/health", (_request, response) => {
response.json({ status: "ok" });
});

app.post("/api/chat", async (request, response) => {
const body = request.body;
const message = typeof body?.message === "string" ? body.message.trim() : "";
const requestedConversationId = body?.conversationId;

if (
message.length < 1 ||
message.length > 2000 ||
(requestedConversationId !== undefined &&
(typeof requestedConversationId !== "string" || requestedConversationId.trim().length === 0))
) {
return response.status(422).json({
error: "Envía un mensaje de 1 a 2000 caracteres y un conversationId válido si ya existe.",
});
}

try {
let conversationId = requestedConversationId;
const userMessage = { type: "message", role: "user", content: message };

if (conversationId) {
await openai.conversations.items.create(conversationId, { items: [userMessage] });
} else {
const conversation = await openai.conversations.create({ items: [userMessage] });
conversationId = conversation.id;
}

const result = await openai.responses.create(
{ conversation: conversationId },
agentReference,
);

if (typeof result.output_text !== "string" || result.output_text.length === 0) {
const outputTypes = Array.isArray(result.output)
? result.output.map((item) => item.type).join(",")
: "unavailable";
const responseStatus = typeof result.status === "string" ? result.status : "unknown";
const incompleteReason =
typeof result.incomplete_details?.reason === "string"
? result.incomplete_details.reason
: "none";

console.error("Foundry response had no text output:", {
status: responseStatus,
outputTypes,
incompleteReason,
});
throw new Error("Foundry returned no text output.");
}

return response.json({ message: result.output_text, conversationId });
} catch (error) {

const errorDetails = error && typeof error === "object" ? error : {};
const causeDetails =
errorDetails.cause && typeof errorDetails.cause === "object"
? errorDetails.cause
: {};
const errorName = error instanceof Error ? error.name : "UnknownError";
const errorCode = typeof errorDetails.code === "string" ? errorDetails.code : "none";
const errorType = typeof errorDetails.type === "string" ? errorDetails.type : "none";
const errorParam = typeof errorDetails.param === "string" ? errorDetails.param : "none";
const rawErrorMessage = error instanceof Error ? error.message : "";
const safeErrorMessage = rawErrorMessage
.replace(/https?:\/\/\S+/gi, "[URL]")
.replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[REDACTED]")
.slice(0, 240);

const errorStatus = Number.isInteger(errorDetails.status)
? errorDetails.status
: Number.isInteger(errorDetails.statusCode)
? errorDetails.statusCode
: "none";
const responseStatus = Number.isInteger(errorDetails.response?.status)
? errorDetails.response.status
: "none";
const causeName = causeDetails.name || "none";
const causeCode = typeof causeDetails.code === "string" ? causeDetails.code : "none";

console.error("Foundry chat request failed:", {
name: errorName,
code: errorCode,
status: errorStatus,
responseStatus,
causeName,
causeCode,
type: errorType,
param: errorParam,
message: safeErrorMessage,
});

return response.status(502).json({
error: "El asistente no pudo responder en este momento. Intenta de nuevo más tarde.",
});
}
});
app.post("/api/text-analysis", async (request, response) => {
  const text = typeof request.body?.text === "string"
    ? request.body.text.trim()
    : "";

  if (text.length < 1 || text.length > 500) {
    return response.status(422).json({
      error: "Envía un texto de 1 a 500 caracteres.",
    });
  }

  try {
    const conversation = await openai.conversations.create({
      items: [{ type: "message", role: "user", content: text }],
    });

    const result = await openai.responses.create(
      { conversation: conversation.id },
      textAnalysisAgentReference,
    );

    if (typeof result.output_text !== "string" || result.output_text.length === 0) {
      throw new Error("Foundry returned no text-analysis output.");
    }

    const analysis = JSON.parse(result.output_text);
    const validSentiments = ["negative", "neutral", "positive", "mixed"];
    const validCategories = ["delivery_delay", "damaged_goods", "other"];

    if (
      !analysis ||
      !validSentiments.includes(analysis.sentiment) ||
      !Array.isArray(analysis.aspects) ||
      analysis.aspects.some(
        (aspect) =>
          !aspect ||
          !validCategories.includes(aspect.category) ||
          typeof aspect.evidence !== "string",
      ) ||
      analysis.requiresHumanReview !== true
    ) {
      throw new Error("Foundry returned an invalid text-analysis shape.");
    }

    return response.json(analysis);
  } catch (error) {
    console.error("Foundry text analysis failed:", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return response.status(502).json({
      error: "No se pudo analizar el texto. Requiere revisión humana.",
    });
  }
});
app.post(
  "/api/vision-analysis",
  express.raw({ type: "image/png", limit: "5mb" }),
  async (request, response) => {
    const image = request.body;
    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    if (!Buffer.isBuffer(image) || image.length < pngSignature.length) {
      return response.status(422).json({
        error: "Envía una imagen PNG sintética.",
      });
    }
    if (!image.subarray(0, pngSignature.length).equals(pngSignature)) {
      return response.status(422).json({
        error: "El archivo no tiene una firma PNG válida.",
      });
    }

    try {
      const imageDataUrl =
        `data:image/png;base64,${image.toString("base64")}`;
      const conversation = await openai.conversations.create({
        items: [
          {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Describe solo lo visible en la imagen. No infieras qué contienen las cajas.",
              },
              {
                type: "input_image",
                detail: "high",
                image_url: imageDataUrl,
              },
            ],
          },
        ],
      });

      const result = await openai.responses.create(
        { conversation: conversation.id },
        visionAgentReference,
      );

      if (typeof result.output_text !== "string" || result.output_text.length === 0) {
        throw new Error("Foundry returned no vision-analysis output.");
      }

      const analysis = JSON.parse(result.output_text);
      const validPositions = ["left", "center", "right", "other"];
      const validConditions = ["intact", "damaged", "unclear"];

      if (
        !analysis ||
        !Number.isInteger(analysis.boxCount) ||
        analysis.boxCount < 1 ||
        analysis.boxCount > 10 ||
        !Array.isArray(analysis.boxes) ||
        analysis.boxes.some(
          (box) =>
            !box ||
            !validPositions.includes(box.position) ||
            !validConditions.includes(box.condition) ||
            typeof box.visibleEvidence !== "string",
        ) ||
        typeof analysis.summary !== "string" ||
        analysis.requiresHumanReview !== true
      ) {
        throw new Error("Foundry returned an invalid vision-analysis shape.");
      }

      return response.json(analysis);
    } catch (error) {
      console.error("Foundry vision analysis failed:", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return response.status(502).json({
        error: "No se pudo analizar la imagen. Requiere revisión humana.",
      });
    }
  },
);
app.post("/api/speech-token", async (_request, response) => {
  try {
    const tokenResponse = await fetch(
      `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": speechKey,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": "0",
        },
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!tokenResponse.ok) {
      console.error("Speech token request failed:", tokenResponse.status);
      return response.status(502).json({
        error: "No se pudo preparar la conexión de voz.",
      });
    }

    const token = await tokenResponse.text();
    if (!token) {
      throw new Error("Speech returned an empty authorization token.");
    }

    response.set("Cache-Control", "no-store");
    return response.json({ token, region: speechRegion });
  } catch (error) {
    console.error("Speech token request failed:", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return response.status(502).json({
      error: "No se pudo preparar la conexión de voz.",
    });
  }
});

app.use(express.static(publicDirectory));

app.post(
"/api/invoices/analyze",
express.raw({ type: "application/pdf", limit: "5mb" }),
async (request, response) => {
const pdf = request.body;
if (!Buffer.isBuffer(pdf) || pdf.length === 0) {
return response.status(422).json({ error: "Envía un archivo PDF sintético." });
}
if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
return response.status(422).json({ error: "El archivo no parece ser un PDF válido." });
}

try {
const serviceOrigin = new URL(documentIntelligenceEndpoint).origin;
const analyzeUrl = `${documentIntelligenceEndpoint}/documentintelligence/documentModels/prebuilt-invoice:analyze?_overload=analyzeDocument&api-version=2024-11-30`;
const serviceHeaders = {
"Ocp-Apim-Subscription-Key": documentIntelligenceKey,
};
const analyzeResponse = await fetch(analyzeUrl, {
method: "POST",
headers: { ...serviceHeaders, "Content-Type": "application/json" },
body: JSON.stringify({ base64Source: pdf.toString("base64") }),
signal: AbortSignal.timeout(30000),
});

if (analyzeResponse.status !== 202) {
console.error("Document Intelligence request rejected:", analyzeResponse.status);
return response.status(502).json({ error: "No se pudo iniciar el análisis de la factura." });
}

const operationLocation = analyzeResponse.headers.get("operation-location");
if (!operationLocation || new URL(operationLocation).origin !== serviceOrigin) {
throw new Error("Document Intelligence returned an invalid operation location.");
}

const retryAfter = Number(analyzeResponse.headers.get("retry-after"));
const pollDelayMs = (Number.isFinite(retryAfter) && retryAfter > 0
? Math.max(4, retryAfter)
: 4) * 1000;
let analysis;

for (let attempt = 0; attempt < 15; attempt++) {
await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
const pollResponse = await fetch(operationLocation, {
headers: serviceHeaders,
signal: AbortSignal.timeout(30000),
});
if (!pollResponse.ok) {
throw new Error("Document Intelligence result polling failed.");
}

analysis = await pollResponse.json();
if (analysis.status === "succeeded") break;
if (analysis.status === "failed") {
throw new Error("Document Intelligence analysis failed.");
}
if (attempt === 14) {
throw new Error("Document Intelligence analysis timed out.");
}
}

const fields = analysis.analyzeResult?.documents?.[0]?.fields;
if (!fields) {
throw new Error("Document Intelligence returned no invoice fields.");
}

const totalCurrency = fields.InvoiceTotal?.valueCurrency;
const extracted = {
supplier: fields.VendorName?.valueString ?? null,
invoiceNumber: fields.InvoiceId?.valueString ?? null,
invoiceDate: fields.InvoiceDate?.valueDate ?? null,
total: typeof totalCurrency?.amount === "number" ? totalCurrency.amount : null,
currency: totalCurrency?.currencyCode ?? null,
};
const confidence = {
supplier: fields.VendorName?.confidence ?? null,
invoiceNumber: fields.InvoiceId?.confidence ?? null,
invoiceDate: fields.InvoiceDate?.confidence ?? null,
total: fields.InvoiceTotal?.confidence ?? null,
};
const reviewReasons = [];
for (const [label, value] of Object.entries(extracted)) {
if (value === null || value === "") {
reviewReasons.push(`No se pudo extraer ${label}.`);
}
}
for (const [label, score] of Object.entries(confidence)) {
if (typeof score === "number" && score < 0.8) {
reviewReasons.push(`Confianza baja en ${label} (${Math.round(score * 100)}%).`);
}
}

const registeredInvoices = JSON.parse(
  await readFile(invoiceRegistryPath, "utf8"),
);
if (!Array.isArray(registeredInvoices)) {
  throw new Error("Invoice registry must contain a JSON array.");
}

const supplierKey = normalizeInvoiceKey(extracted.supplier);
const invoiceNumberKey = normalizeInvoiceKey(extracted.invoiceNumber);
const duplicate = supplierKey && invoiceNumberKey
  ? registeredInvoices.find(
      (invoice) =>
        normalizeInvoiceKey(invoice?.supplier) === supplierKey &&
        normalizeInvoiceKey(invoice?.invoiceNumber) === invoiceNumberKey,
    )
  : undefined;

return response.json({
  extracted,
  confidence,
  humanReviewRequired: true,
  possibleDuplicate: Boolean(duplicate),
  duplicateMatch: duplicate
    ? {
        invoiceDate: duplicate.invoiceDate ?? null,
        total: duplicate.total ?? null,
        currency: duplicate.currency ?? null,
      }
    : null,
  reviewReasons,
});

} catch (error) {
const errorDetails = error && typeof error === "object" ? error : {};
console.error("Document Intelligence analysis failed:", {
name: error instanceof Error ? error.name : "UnknownError",
code: typeof errorDetails.code === "string" ? errorDetails.code : "none",
status: Number.isInteger(errorDetails.status) ? errorDetails.status : "none",
});
return response.status(502).json({
error: "No se pudo completar el análisis. Una persona debe revisar la factura manualmente.",
});
}
},
);

app.listen(port, () => {
console.log(`Río Claro prototype listening on port ${port}`);
});