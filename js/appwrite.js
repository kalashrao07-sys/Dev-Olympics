/**
 * appwrite.js — Appwrite backend integration (extended)
 * Keeps localStorage as fallback. All functions are safe to call even if Appwrite is unavailable.
 */

const APPWRITE_CONFIG = {
  endpoint:       'https://sgp.cloud.appwrite.io/v1',
  projectId:      '69f59a92000e5a24aa3c',
  databaseId:     '69f59ad50020c2f398fc',
  responsesCollId: 'responses',
  formsCollId:    'forms',
};

let appwriteClient = null;
let appwriteDB     = null;

function initAppwrite() {
  if (appwriteClient) return;
  appwriteClient = new Appwrite.Client()
    .setEndpoint(APPWRITE_CONFIG.endpoint)
    .setProject(APPWRITE_CONFIG.projectId);
  appwriteDB = new Appwrite.Databases(appwriteClient);
}

/* ── Responses ─────────────────────────────────────────────── */

/** Save a response to Appwrite. ownerId = form creator's userId. */
async function saveResponseToAppwrite(formId, data, ownerId) {
  try {
    initAppwrite();
    await appwriteDB.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.responsesCollId,
      Appwrite.ID.unique(),
      { formId, data: JSON.stringify(data), ownerId: ownerId || 'anonymous' }
    );
    console.log('Response saved to Appwrite');
  } catch (err) {
    console.error('Appwrite response save error:', err);
  }
}

/** Fetch all responses for a given formId. Returns array or null on failure. */
async function getResponsesFromAppwrite(formId) {
  try {
    initAppwrite();
    const res = await appwriteDB.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.responsesCollId,
      [Appwrite.Query.equal('formId', formId), Appwrite.Query.orderDesc('$createdAt')]
    );
    return res.documents.map(doc => ({
      id:        doc.$id,
      formId:    doc.formId,
      ownerId:   doc.ownerId,
      data:      (() => { try { return JSON.parse(doc.data); } catch { return {}; } })(),
      createdAt: doc.$createdAt,
    }));
  } catch (err) {
    console.error('Appwrite responses fetch error:', err);
    return null;
  }
}

/* ── Forms ─────────────────────────────────────────────────── */

/** Save (upsert) a form schema to Appwrite using schema.id as document ID. */
async function saveFormToAppwrite(schema) {
  try {
    initAppwrite();
    const ownerId = localStorage.getItem('userId') || 'anonymous';
    schema.ownerId = ownerId;                       // stamp ownership on schema
    const payload = {
      title:    schema.title,
      schema:   JSON.stringify(schema),
      ownerId,
      isActive: typeof schema.isActive === 'boolean' ? schema.isActive : true,
    };
    if (schema.closeAt) payload.closeAt = schema.closeAt;
    try {
      await appwriteDB.updateDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.formsCollId, schema.id, payload);
    } catch {
      await appwriteDB.createDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.formsCollId, schema.id, payload);
    }
    return true;
  } catch (err) {
    console.error('Appwrite form save error:', err);
    return false;
  }
}

/** Fetch all forms owned by the current user. Returns array or null on failure. */
async function getFormsFromAppwrite(ownerId) {
  try {
    initAppwrite();
    const res = await appwriteDB.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.formsCollId,
      [Appwrite.Query.equal('ownerId', ownerId), Appwrite.Query.orderDesc('$createdAt')]
    );
    return res.documents.map(doc => {
      try { return JSON.parse(doc.schema); } catch { return null; }
    }).filter(Boolean);
  } catch (err) {
    console.error('Appwrite forms fetch error:', err);
    return null;
  }
}

/** Load a single form from Appwrite by its schema ID. */
async function loadFormFromAppwrite(formId) {
  try {
    initAppwrite();
    const doc = await appwriteDB.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.formsCollId, formId);
    return JSON.parse(doc.schema);
  } catch (err) {
    console.error('Appwrite form load error:', err);
    return null;
  }
}

/** Delete a form from Appwrite. */
async function deleteFormFromAppwrite(formId) {
  try {
    initAppwrite();
    await appwriteDB.deleteDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.formsCollId, formId);
  } catch (err) {
    console.error('Appwrite form delete error:', err);
  }
}