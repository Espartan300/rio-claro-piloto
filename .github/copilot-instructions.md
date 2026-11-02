## Qué es este proyecto
Aplicación web de una sola vista para el prototipo educativo de Distribuidora Río Claro. El frontend HTML/CSS/JavaScript ofrece dos flujos: un asistente operativo sobre documentos sintéticos aprobados y revisión humana de facturas sintéticas. El backend conversa con un agente de Microsoft Foundry. La app se publicará en Azure App Service para que un revisor pueda usarla mediante una URL.

El asistente debe responder con base en fuentes conectadas mediante Azure AI Search, citar la fuente y reconocer cuando no hay evidencia suficiente. La revisión de facturas usa Azure AI Document Intelligence para extraer proveedor, número, fecha y total, marcar datos faltantes o dudosos y señalar posibles duplicados en un registro sintético. No aprueba ni paga facturas. Análisis de texto, voz y visión son demostraciones pequeñas, sujetas a confirmar alcance, disponibilidad y costo. No conectar con datos o sistemas reales ni presentar el prototipo como sistema de producción.

## Entorno de desarrollo
El entorno disponible es Windows PowerShell 5.1, Node.js 22.17.0 y npm 10.9.2. El tutorial recomienda PowerShell 7 y Node 24 LTS; no instalar ni cambiar versiones globales sin explicar el impacto y consultarme. Mientras tanto, dar comandos compatibles con PowerShell 5.1 y usar `npm.cmd` si `npm` falla por la política de scripts. Validar las dependencias con Node 22.17 antes de avanzar; el destino de App Service Linux es Node 24 LTS.

Node 22.17 permite `--env-file-if-exists=.env`. No usar comandos Bash ni su sintaxis; escribir comandos para Windows PowerShell.

## Stack y versiones
Frontend de una sola página en HTML, CSS y JavaScript sin frameworks. Backend Node.js con Express 5, ES Modules (`"type": "module"`) y `async`/`await`. No usar TypeScript ni bundlers.

Para Foundry usar `@azure/ai-projects` 2.x con la API nueva de Foundry Projects y `@azure/identity` con `DefaultAzureCredential`. No usar `@azure/ai-agents` ni la API 1.x. Cargar variables locales con `node --env-file-if-exists=.env`; no añadir `dotenv`. `gpt-5-mini` es candidato del tutorial, no una selección confirmada: comprobar disponibilidad, permisos y costo antes de elegir el modelo/despliegue.

Añadir SDKs o servicios para AI Search, Document Intelligence, análisis de texto, voz o visión solo en la etapa correspondiente, después de explicar propósito, dependencia y costo.

## Arquitectura (no la cambies sin preguntar)
`server.js` sirve `public/`, expone `GET /health` y `POST /api/chat`, y escucha en `process.env.PORT`. El navegador se comunica solo con el backend; nunca llama directamente a Foundry. Para conversación multi-turno, crear la conversación con `openai.conversations.create()`, pasar el `conversation_id` entre frontend y backend y usar `openai.responses.create({ conversation, input }, agentRef)`, donde `agentRef = { body: { agent: { name, type: "agent_reference" } } }`.

Conservar esos endpoints y el contrato multi-turno. Planear y probar cualquier ruta adicional que necesiten facturas, análisis de texto, voz o visión antes de implementarla; no cambiar la arquitectura acordada sin consultarme. El asistente usa AI Search para recuperar documentos aprobados y citar fuentes; el flujo de facturas usa Document Intelligence y un registro sintético para posibles duplicados, con decisión humana.

## Seguridad
Nunca poner claves, tokens ni endpoints reales en el código, frontend, logs, capturas, documentación o repositorio. Usar `FOUNDRY_PROJECT_ENDPOINT` y `FOUNDRY_AGENT_NAME` como configuración de entorno; mantener `.env` excluido de Git y usar solo marcadores en `.env.example`. No usar datos personales, nóminas, facturas ni datos de clientes reales.

En Azure, usar identidad administrada para que App Service acceda a Foundry; no usar API keys. En local, `DefaultAzureCredential` puede usar una sesión de Azure CLI autorizada. Esto no autentica a las personas ni implementa permisos por sucursal; documentar esa limitación.

Validar `POST /api/chat`: el mensaje debe tener entre 1 y 2000 caracteres; responder 422 si no cumple. Si Foundry falla, responder 502 con un mensaje genérico, sin filtrar trazas ni secretos; los logs del servidor tampoco deben contener datos sensibles. Mostrar al usuario que interactúa con IA, citar fuentes y pasar resultados incompletos o de baja confianza a revisión humana. En el frontend mostrar contenido del modelo con `textContent`, nunca con `innerHTML`.

Antes de cualquier comando que cree, cambie, publique, asigne permisos o elimine recursos de Azure, explicar su efecto y costos probables y pedir confirmación explícita. No ejecutar sin mi confirmación.

## Estilo de código
-Comentarios en español neutro; nombres de variables en inglés. 
-Preferir cambios pequeños, enfocados y acordes con el código existente; no reescribir archivos completos si basta una modificación puntual. No añadir dependencias ni servicios de Azure ni ampliar el alcance sin explicar el motivo y consultar primero.

## Cómo validar
En local, ejecutar `npm.cmd run dev` y abrir `http://localhost:3000`. Verificar salud con `Invoke-RestMethod http://localhost:3000/health`; debe devolver `status: ok`. Probar `POST /api/chat` con entradas válidas, vacías y mayores a 2000 caracteres; esperar respuesta normal para la válida y 422 para las inválidas. Probar una conversación multi-turno y confirmar que se conserva el `conversation_id`.

Validar cada flujo ampliado con documentos y datos sintéticos, incluyendo respuestas sin fuente, facturas incompletas o dudosas y posibles duplicados. Antes de desplegar, confirmar que `package.json` declara todo lo importado y que `start` ejecuta `node server.js`. Verificar el despliegue y la URL solo después de aprobar los comandos y costos de Azure.