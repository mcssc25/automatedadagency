const express = require('express');
const { exec, execFile } = require('child_process');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const cheerio = require('cheerio');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Load environment variables
dotenv.config();

const db = require('./db');

// Initialize database
db.initDb();
db.markInterruptedIntelligenceRuns('Server restarted before the lead intelligence run completed.');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_DEFAULT_MODEL = process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-flash';
const GEMINI_RESEARCH_MODEL = process.env.GEMINI_RESEARCH_MODEL || 'gemini-3.5-flash';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-lite-image';
const GEMINI_VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL || 'gemini-omni-flash-preview';
const DATA_DIR = path.join(__dirname, 'data');
const downloadsDir = path.join(__dirname, 'downloads');
const CRM_STATE_FILE = path.join(DATA_DIR, 'crm-state.json');
const CRM_SETTINGS_FILE = path.join(DATA_DIR, 'crm-settings.json');
const LEAD_INTELLIGENCE_SETTINGS_FILE = path.join(DATA_DIR, 'lead-intelligence-settings.json');
const ACTIVITY_LOG_FILE = path.join(DATA_DIR, 'activity-log.json');
const NODE_ENV = process.env.NODE_ENV || 'development';
const PUBLIC_APP_URL = String(process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
const OPENROUTER_ENV_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_ENV_ENABLED = process.env.OPENROUTER_ENABLED === 'true';
const OPENROUTER_DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || 'openrouter/free';
const OPENROUTER_RESEARCH_MODEL = process.env.OPENROUTER_RESEARCH_MODEL || 'openai/gpt-oss-120b:free';
const OPENROUTER_WEB_SEARCH_ENABLED = process.env.OPENROUTER_WEB_SEARCH_ENABLED === 'true';
const OPENROUTER_WEB_SEARCH_MAX_RESULTS = Math.min(Math.max(parseInt(process.env.OPENROUTER_WEB_SEARCH_MAX_RESULTS, 10) || 5, 1), 10);
const OPENROUTER_DAILY_REQUEST_LIMIT = Math.min(Math.max(parseInt(process.env.OPENROUTER_DAILY_REQUEST_LIMIT, 10) || 200, 1), 5000);
const OPENROUTER_SITE_URL = String(process.env.OPENROUTER_SITE_URL || PUBLIC_APP_URL || 'https://agents.realestatecrmpro.com').replace(/\/+$/, '');
const OPENROUTER_APP_NAME = process.env.OPENROUTER_APP_NAME || 'Real Estate CRM Pro Lead Intelligence';
const LEAD_INTELLIGENCE_RESEARCH_PROVIDER = String(process.env.LEAD_INTELLIGENCE_RESEARCH_PROVIDER || '').toLowerCase();
const DEFAULT_OPENROUTER_FREE_MODELS = [
    'openai/gpt-oss-120b:free',
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'poolside/laguna-m.1:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'nousresearch/hermes-3-llama-3.1-405b:free',
    'google/gemma-4-26b-a4b-it:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'openai/gpt-oss-20b:free',
    'qwen/qwen3-coder:free',
    'poolside/laguna-xs-2.1:free',
    'cohere/north-mini-code:free',
    'nvidia/nemotron-nano-9b-v2:free'
];
const ADMIN_AUTH_ENABLED = process.env.ADMIN_AUTH_ENABLED === 'true' || (NODE_ENV === 'production' && process.env.ADMIN_AUTH_ENABLED !== 'false');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const MAILGUN_WEBHOOK_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY || '';
const REQUIRE_MAILGUN_WEBHOOK_SIGNATURE = process.env.REQUIRE_MAILGUN_WEBHOOK_SIGNATURE !== 'false';
const EMAIL_COMPLIANCE_REQUIRED = process.env.EMAIL_COMPLIANCE_REQUIRED !== 'false';
const OUTBOUND_POSTAL_ADDRESS = String(process.env.OUTBOUND_POSTAL_ADDRESS || '').trim();
const SCRAPER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
};
const LAST30DAYS_SCRIPT_PATH = process.env.LAST30DAYS_SCRIPT_PATH || 'C:\\Users\\daved\\.gemini\\config\\plugins\\last30days-plugin\\skills\\last30days\\scripts\\last30days.py';
const missingLast30DaysScriptsLogged = new Set();
const trendResultCache = new Map();
const REALTOR_DIRECTORY_DOMAINS = [
    'zillow.com',
    'realtor.com',
    'redfin.com',
    'homes.com'
];
const BROKERAGE_ROSTER_KEYWORDS = [
    'agent',
    'agents',
    'associate',
    'associates',
    'broker',
    'brokers',
    'realtor',
    'realtors',
    'roster',
    'staff',
    'team',
    'professionals',
    'our agents',
    'meet the team',
    'find an agent',
    'getagent'
];
const LEAD_INTELLIGENCE_ENABLED = process.env.LEAD_INTELLIGENCE_ENABLED === 'true';
const LEAD_INTELLIGENCE_INTERVAL_MS = Math.min(Math.max(parseInt(process.env.LEAD_INTELLIGENCE_INTERVAL_MS, 10) || 60 * 60 * 1000, 10 * 60 * 1000), 24 * 60 * 60 * 1000);
const LEAD_INTELLIGENCE_START_DELAY_MS = Math.min(Math.max(parseInt(process.env.LEAD_INTELLIGENCE_START_DELAY_MS, 10) || 2 * 60 * 1000, 30 * 1000), 30 * 60 * 1000);
const LEAD_INTELLIGENCE_MAX_OFFICES_PER_CYCLE = Math.min(Math.max(parseInt(process.env.LEAD_INTELLIGENCE_MAX_OFFICES_PER_CYCLE, 10) || 8, 1), 25);
const LEAD_INTELLIGENCE_STOP_AFTER_CONTACTS = process.env.LEAD_INTELLIGENCE_STOP_AFTER_CONTACTS !== 'false';
const LEAD_INTELLIGENCE_SUPPRESS_BRAND_AFTER_FAILURE = process.env.LEAD_INTELLIGENCE_SUPPRESS_BRAND_AFTER_FAILURE !== 'false';
const LEAD_INTELLIGENCE_RESEARCH_TECH_STACK = process.env.LEAD_INTELLIGENCE_RESEARCH_TECH_STACK === 'true';
const parsedMaxProfileResearchPerCycle = parseInt(process.env.LEAD_INTELLIGENCE_MAX_PROFILE_RESEARCH_PER_CYCLE, 10);
const LEAD_INTELLIGENCE_MAX_PROFILE_RESEARCH_PER_CYCLE = Math.min(Math.max(Number.isFinite(parsedMaxProfileResearchPerCycle) ? parsedMaxProfileResearchPerCycle : 2, 0), 10);
const ROSTER_BROWSER_MAX_PAGES = Math.min(Math.max(parseInt(process.env.ROSTER_BROWSER_MAX_PAGES, 10) || 40, 1), 100);
const ROSTER_BROWSER_MAX_CONTACTS = Math.min(Math.max(parseInt(process.env.ROSTER_BROWSER_MAX_CONTACTS, 10) || 250, 10), 1000);
const ROSTER_BROWSER_TIMEOUT_MS = Math.min(Math.max(parseInt(process.env.ROSTER_BROWSER_TIMEOUT_MS, 10) || 45000, 10000), 120000);
let pipelineWorkerRunning = false;
let leadIntelligenceWorkerRunning = false;
const leadScrapeJobs = new Map();
const webhookReplayTokens = new Map();
const openRouterUsageState = { date: '', requests: 0 };
const mailgunUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: 10,
        fileSize: 5 * 1024 * 1024,
        fieldSize: 2 * 1024 * 1024
    }
});

if (ADMIN_AUTH_ENABLED && !ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD must be configured when admin authentication is enabled.');
}

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function readJsonFile(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        console.warn(`[Storage] Failed to read ${path.basename(filePath)}:`, error.message);
        return fallback;
    }
}

function writeJsonFile(filePath, data) {
    ensureDataDir();
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
}

function todayActivityKey() {
    return new Date().toISOString().slice(0, 10);
}

function readActivityLogState() {
    const today = todayActivityKey();
    const data = readJsonFile(ACTIVITY_LOG_FILE, { date: today, events: [] });
    if (data.date !== today) return { date: today, events: [] };
    return {
        date: today,
        events: Array.isArray(data.events) ? data.events : []
    };
}

function writeActivityLogState(state) {
    writeJsonFile(ACTIVITY_LOG_FILE, {
        date: state.date || todayActivityKey(),
        events: Array.isArray(state.events) ? state.events.slice(-1000) : []
    });
}

function appendActivityLog(type = 'system-line', message = '', meta = {}) {
    const text = String(message || '').trim();
    if (!text) return null;

    const state = readActivityLogState();
    const event = {
        id: crypto.randomUUID(),
        type: String(type || 'system-line').trim(),
        message: text,
        createdAt: new Date().toISOString(),
        meta: meta && typeof meta === 'object' ? meta : {}
    };

    state.events.push(event);
    writeActivityLogState(state);
    return event;
}

function clearActivityLog() {
    const state = { date: todayActivityKey(), events: [] };
    writeActivityLogState(state);
    return state;
}

function defaultCrmState() {
    return {
        leads: [],
        campaignsList: [],
        verificationQueue: [],
        crmAutopilot: {
            enabled: false,
            dailyLeadTarget: 100,
            firstCampaignId: null,
            secondCampaignId: null,
            thirdCampaignId: null,
            bookingLink: '',
            salesPageUrl: '',
            demoVideoUrl: '',
            youtubePageUrl: '',
            dailyScrapeEnabled: false,
            dailyScrapeQuery: '',
            autoEnrollScrapedLeads: false,
            autoApproveCampaigns: false,
            autoAdvanceCampaigns: false,
            lastDailyScrapeDate: null,
            autoPauseOnReply: true,
            simulateUnsubscribes: false,
            bypassEmailVerification: false,
            dncList: []
        },
        updatedAt: null
    };
}

function defaultCrmSettings() {
    return {
        enabled: false,
        dailyLeadTarget: 100,
        firstCampaignId: null,
        secondCampaignId: null,
        thirdCampaignId: null,
        bookingLink: '',
        salesPageUrl: '',
        demoVideoUrl: '',
        youtubePageUrl: '',
        dailyScrapeEnabled: false,
        dailyScrapeQuery: '',
        autoEnrollScrapedLeads: false,
        autoApproveCampaigns: false,
        autoAdvanceCampaigns: false,
        lastDailyScrapeDate: null,
        autoPauseOnReply: true,
        simulateUnsubscribes: false,
        bypassEmailVerification: false
    };
}

function readCrmSettings() {
    const settings = {
        ...defaultCrmSettings(),
        ...readJsonFile(CRM_SETTINGS_FILE, defaultCrmSettings())
    };
    settings.autoApproveCampaigns = settings.autoApproveCampaigns === true || settings.bypassEmailVerification === true;
    settings.bypassEmailVerification = settings.autoApproveCampaigns;
    return settings;
}

function writeCrmSettings(settings) {
    const autoApproveCampaigns = settings.autoApproveCampaigns === true || settings.bypassEmailVerification === true;
    writeJsonFile(CRM_SETTINGS_FILE, {
        ...defaultCrmSettings(),
        ...settings,
        autoApproveCampaigns,
        bypassEmailVerification: autoApproveCampaigns
    });
}

function shouldAutoApproveCampaigns(settings = readCrmSettings()) {
    return settings.autoApproveCampaigns === true || settings.bypassEmailVerification === true;
}

function defaultLeadIntelligenceSettings() {
    return {
        enabled: LEAD_INTELLIGENCE_ENABLED
    };
}

function readLeadIntelligenceSettings() {
    const settings = {
        ...defaultLeadIntelligenceSettings(),
        ...readJsonFile(LEAD_INTELLIGENCE_SETTINGS_FILE, defaultLeadIntelligenceSettings())
    };
    settings.enabled = settings.enabled === true;
    return settings;
}

function writeLeadIntelligenceSettings(settings = {}) {
    writeJsonFile(LEAD_INTELLIGENCE_SETTINGS_FILE, {
        ...defaultLeadIntelligenceSettings(),
        ...settings,
        enabled: settings.enabled === true
    });
}

function isLeadIntelligenceEnabled() {
    return readLeadIntelligenceSettings().enabled === true;
}

function normalizeCrmState(input = {}) {
    const fallback = defaultCrmState();
    const state = {
        ...fallback,
        ...input,
        crmAutopilot: {
            ...fallback.crmAutopilot,
            ...(input.crmAutopilot || {})
        }
    };

    state.leads = Array.isArray(state.leads) ? state.leads : [];
    state.campaignsList = Array.isArray(state.campaignsList) ? state.campaignsList : [];
    state.verificationQueue = Array.isArray(state.verificationQueue) ? state.verificationQueue : [];
    state.crmAutopilot.dncList = Array.isArray(state.crmAutopilot.dncList) ? state.crmAutopilot.dncList : [];
    state.updatedAt = new Date().toISOString();
    return state;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRetryGeminiError(error) {
    const status = error.response && error.response.status;
    return ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(error.code) || [429, 500, 502, 503, 504].includes(status);
}

function parseCsvList(value) {
    return String(value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

function isFreeOpenRouterModelId(model) {
    const value = String(model || '').trim();
    return value === 'openrouter/free' || value.endsWith(':free');
}

function normalizeOpenRouterModelOrder(value) {
    const configured = Array.isArray(value)
        ? value.map(item => String(item || '').trim()).filter(Boolean)
        : parseCsvList(value);
    return [...new Set([...configured, ...DEFAULT_OPENROUTER_FREE_MODELS].filter(isFreeOpenRouterModelId))];
}

function getOpenRouterIntegrationSettings() {
    let creds = {};
    try {
        creds = getCredentials();
    } catch (error) {
        creds = {};
    }

    const apiKey = String(creds.openRouterApiKey || OPENROUTER_ENV_API_KEY || '').trim();
    const enabled = creds.openRouterEnabled !== undefined
        ? creds.openRouterEnabled === true
        : OPENROUTER_ENV_ENABLED;
    const webSearchEnabled = creds.openRouterWebSearchEnabled !== undefined
        ? creds.openRouterWebSearchEnabled === true
        : OPENROUTER_WEB_SEARCH_ENABLED;
    const dailyRequestLimit = Math.min(Math.max(parseInt(creds.openRouterDailyRequestLimit || OPENROUTER_DAILY_REQUEST_LIMIT, 10) || OPENROUTER_DAILY_REQUEST_LIMIT, 1), 5000);
    const modelOrder = normalizeOpenRouterModelOrder(creds.openRouterModelOrder || process.env.OPENROUTER_MODEL_ORDER || OPENROUTER_RESEARCH_MODEL);

    return {
        apiKey,
        configured: !!apiKey,
        enabled: enabled && !!apiKey,
        source: creds.openRouterApiKey ? 'integrations' : (OPENROUTER_ENV_API_KEY ? 'env' : ''),
        defaultModel: isFreeOpenRouterModelId(creds.openRouterDefaultModel || OPENROUTER_DEFAULT_MODEL)
            ? (creds.openRouterDefaultModel || OPENROUTER_DEFAULT_MODEL)
            : 'openrouter/free',
        researchModel: modelOrder[0] || OPENROUTER_RESEARCH_MODEL,
        modelOrder,
        webSearchEnabled,
        webSearchMaxResults: OPENROUTER_WEB_SEARCH_MAX_RESULTS,
        dailyRequestLimit
    };
}

function getLeadIntelligenceResearchProvider() {
    const openRouterEnabled = getOpenRouterIntegrationSettings().enabled;
    if (LEAD_INTELLIGENCE_RESEARCH_PROVIDER === 'openrouter') return 'openrouter';
    if (LEAD_INTELLIGENCE_RESEARCH_PROVIDER) return LEAD_INTELLIGENCE_RESEARCH_PROVIDER;
    return openRouterEnabled ? 'openrouter' : 'gemini';
}

function refreshOpenRouterDailyWindow() {
    const today = new Date().toISOString().slice(0, 10);
    if (openRouterUsageState.date !== today) {
        openRouterUsageState.date = today;
        openRouterUsageState.requests = 0;
    }
}

function canUseOpenRouter() {
    const settings = getOpenRouterIntegrationSettings();
    if (!settings.enabled) return false;
    refreshOpenRouterDailyWindow();
    return openRouterUsageState.requests < settings.dailyRequestLimit;
}

function recordOpenRouterRequest() {
    refreshOpenRouterDailyWindow();
    openRouterUsageState.requests += 1;
}

async function postGeminiWithRetry(url, payload, label, timeoutMs = 120000) {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            return await axios.post(url, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: timeoutMs,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
        } catch (error) {
            lastError = error;
            if (attempt < 3 && shouldRetryGeminiError(error)) {
                const status = error.response && error.response.status;
                console.warn(`[${label}] Gemini request failed (${status || error.code || error.message}); retrying attempt ${attempt + 1}/3.`);
                await sleep(1000 * attempt);
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

async function postOpenRouterWithRetry(payload, label, timeoutMs = 120000) {
    const settings = getOpenRouterIntegrationSettings();
    if (!canUseOpenRouter()) {
        throw new Error(settings.configured
            ? `OpenRouter daily request cap reached (${settings.dailyRequestLimit}) or OpenRouter is disabled.`
            : 'OpenRouter API key is not configured or OPENROUTER_ENABLED is not true.');
    }

    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            recordOpenRouterRequest();
            return await axios.post('https://openrouter.ai/api/v1/chat/completions', payload, {
                headers: {
                    'Authorization': `Bearer ${settings.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': OPENROUTER_SITE_URL,
                    'X-OpenRouter-Title': OPENROUTER_APP_NAME
                },
                timeout: timeoutMs,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
        } catch (error) {
            lastError = error;
            const status = error.response && error.response.status;
            const retryable = ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(error.code) || [408, 409, 500, 502, 503, 504].includes(status);
            if (attempt < 3 && retryable) {
                console.warn(`[${label}] OpenRouter request failed (${status || error.code || error.message}); retrying attempt ${attempt + 1}/3.`);
                await sleep(1000 * attempt);
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

function attachEnrollmentSummaries(leads = []) {
    return leads.map(lead => ({
        ...lead,
        activeEnrollment: db.getActiveEnrollmentForLead(lead.id),
        enrollments: db.getEnrollmentsForLead(lead.id)
    }));
}

function getAllowedCorsOrigins() {
    const configured = String(process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean);

    if (PUBLIC_APP_URL) configured.push(PUBLIC_APP_URL);

    if (NODE_ENV !== 'production') {
        configured.push(
            `http://localhost:${PORT}`,
            `http://127.0.0.1:${PORT}`,
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        );
    }

    return [...new Set(configured)];
}

const allowedCorsOrigins = getAllowedCorsOrigins();

function corsOrigin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/+$/, '');
    if (allowedCorsOrigins.includes(normalized)) return callback(null, true);
    return callback(null, false);
}

function timingSafeEqualString(a, b) {
    const left = Buffer.from(String(a || ''), 'utf8');
    const right = Buffer.from(String(b || ''), 'utf8');
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
}

function isAuthExemptPath(req) {
    return req.path === '/api/app-config'
        || req.path === '/api/unsubscribe'
        || req.path === '/api/webhooks/inbound-email'
        || req.path.startsWith('/downloads/');
}

function requireAdminAuth(req, res, next) {
    if (!ADMIN_AUTH_ENABLED || isAuthExemptPath(req)) return next();

    const header = req.headers.authorization || '';
    const match = header.match(/^Basic\s+(.+)$/i);
    if (match) {
        try {
            const decoded = Buffer.from(match[1], 'base64').toString('utf8');
            const separator = decoded.indexOf(':');
            const username = separator >= 0 ? decoded.slice(0, separator) : '';
            const password = separator >= 0 ? decoded.slice(separator + 1) : '';
            if (timingSafeEqualString(username, ADMIN_USERNAME) && timingSafeEqualString(password, ADMIN_PASSWORD)) {
                return next();
            }
        } catch (error) {
            // Fall through to the authentication challenge.
        }
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Ad Agency Autopilot"');
    return res.status(401).send('Authentication required');
}

function noCacheStaticHeaders(res, filePath) {
    if (/\.(html|js|css)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}

function serveRootFile(fileName) {
    return (req, res) => {
        res.sendFile(path.join(__dirname, fileName), {
            dotfiles: 'deny',
            headers: /\.(html|js|css)$/i.test(fileName)
                ? {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
                : undefined
        });
    };
}


// Middleware
app.use(cors({
    origin: corsOrigin,
    credentials: ADMIN_AUTH_ENABLED
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.use('/downloads', express.static(downloadsDir, {
    dotfiles: 'deny',
    index: false,
    fallthrough: false,
    setHeaders: noCacheStaticHeaders
}));

app.use(requireAdminAuth);

app.get('/', serveRootFile('index.html'));
app.get('/index.html', serveRootFile('index.html'));
app.get('/app.js', serveRootFile('app.js'));
app.get('/index.css', serveRootFile('index.css'));

app.get('/api/activity-log', (req, res) => {
    res.json(readActivityLogState());
});

app.post('/api/activity-log', (req, res) => {
    const event = appendActivityLog(req.body?.type || 'system-line', req.body?.message || '', req.body?.meta || {});
    res.status(event ? 201 : 400).json(event ? { success: true, event } : { error: 'Activity message is required.' });
});

app.delete('/api/activity-log', (req, res) => {
    const state = clearActivityLog();
    res.json({ success: true, ...state });
});
app.get('/config.js', serveRootFile('config.js'));

app.get('/api/app-config', (req, res) => {
    const openRouterSettings = getOpenRouterIntegrationSettings();
    res.json({
        geminiConfigured: !!GEMINI_API_KEY,
        geminiModels: {
            default: GEMINI_DEFAULT_MODEL,
            research: GEMINI_RESEARCH_MODEL,
            image: GEMINI_IMAGE_MODEL,
            video: GEMINI_VIDEO_MODEL
        },
        openRouterConfigured: openRouterSettings.enabled,
        openRouterModels: {
            default: openRouterSettings.defaultModel,
            research: openRouterSettings.researchModel,
            order: openRouterSettings.modelOrder,
            webSearchEnabled: openRouterSettings.webSearchEnabled,
            dailyRequestLimit: openRouterSettings.dailyRequestLimit
        }
    });
});

app.get('/api/crm-state', (req, res) => {
    try {
        const settings = readCrmSettings();
        
        const targetLeadsCount = db.getLeadsCount({ stage: 'Scraped' });
        const leadStageCounts = db.getLeadStageCounts();
        const allCampaigns = db.getCampaigns().map(campaign => ({
            ...campaign,
            targetLeadsCount
        }));
        const campaignsList = allCampaigns.filter(c => c.status === 'Active');
        const verificationQueue = allCampaigns.filter(c => c.status === 'Awaiting Launch');
        
        // Return first 50 leads to avoid UI lag.
        // Frontend will fetch paginated list via /api/leads
        const leads = db.getLeads({ limit: 50 });
        const leadsWithEnrollments = attachEnrollmentSummaries(leads);
        const dncRows = db.getDncList();
        
        res.json({
            leads: leadsWithEnrollments,
            campaignsList,
            verificationQueue,
            leadStageCounts,
            crmAutopilot: {
                ...settings,
                dncList: dncRows.map(d => d.email)
            }
        });
    } catch (err) {
        console.error('[CRM API Error]', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/crm-state', (req, res) => {
    try {
        const { crmAutopilot } = req.body;
        if (crmAutopilot) {
            const settings = {
                enabled: crmAutopilot.enabled ?? false,
                dailyLeadTarget: parseInt(crmAutopilot.dailyLeadTarget) || 100,
                firstCampaignId: crmAutopilot.firstCampaignId ? parseInt(crmAutopilot.firstCampaignId) : null,
                secondCampaignId: crmAutopilot.secondCampaignId ? parseInt(crmAutopilot.secondCampaignId) : null,
                thirdCampaignId: crmAutopilot.thirdCampaignId ? parseInt(crmAutopilot.thirdCampaignId) : null,
                bookingLink: String(crmAutopilot.bookingLink || '').trim(),
                salesPageUrl: String(crmAutopilot.salesPageUrl || '').trim(),
                demoVideoUrl: String(crmAutopilot.demoVideoUrl || '').trim(),
                youtubePageUrl: String(crmAutopilot.youtubePageUrl || '').trim(),
                dailyScrapeEnabled: crmAutopilot.dailyScrapeEnabled ?? false,
                dailyScrapeQuery: String(crmAutopilot.dailyScrapeQuery || '').trim(),
                autoEnrollScrapedLeads: crmAutopilot.autoEnrollScrapedLeads ?? false,
                autoApproveCampaigns: crmAutopilot.autoApproveCampaigns ?? crmAutopilot.bypassEmailVerification ?? false,
                autoAdvanceCampaigns: crmAutopilot.autoAdvanceCampaigns ?? false,
                lastDailyScrapeDate: crmAutopilot.lastDailyScrapeDate || null,
                autoPauseOnReply: crmAutopilot.autoPauseOnReply ?? true,
                simulateUnsubscribes: crmAutopilot.simulateUnsubscribes ?? false,
                bypassEmailVerification: crmAutopilot.autoApproveCampaigns ?? crmAutopilot.bypassEmailVerification ?? false
            };
            writeCrmSettings(settings);
        }
        res.json({ success: true, updatedAt: new Date().toISOString() });
    } catch (err) {
        console.error('[CRM API Error]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Paginated Leads Endpoint
app.get('/api/leads', (req, res) => {
    try {
        const stage = req.query.stage || 'All';
        const search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const respondedOnly = req.query.respondedOnly === 'true' || req.query.respondedOnly === '1';
        const offset = (page - 1) * limit;
        
        const leads = attachEnrollmentSummaries(db.getLeads({ stage, search, limit, offset, respondedOnly }));
        const total = db.getLeadsCount({ stage, search, respondedOnly });
        const pages = Math.max(1, Math.ceil(total / limit));
        
        res.json({ leads, page, pages, total });
    } catch (err) {
        console.error('[CRM Leads List API Error]', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/crm-intelligence', (req, res) => {
    try {
        const brokerageSearch = String(req.query.brokerageSearch || '').trim();
        const rosterSearch = String(req.query.rosterSearch || '').trim();
        const rosterBrokerage = String(req.query.rosterBrokerage || '').trim();
        const rosterLimit = Math.min(Math.max(parseInt(req.query.rosterLimit, 10) || 50, 1), 200);
        const rosterOffset = Math.max(parseInt(req.query.rosterOffset, 10) || 0, 0);
        const brokerageLimit = Math.min(Math.max(parseInt(req.query.brokerageLimit, 10) || 30, 1), 100);

        const rosterFilters = {
            search: rosterSearch,
            brokerage: rosterBrokerage,
            limit: rosterLimit,
            offset: rosterOffset
        };

        res.json({
            running: leadIntelligenceWorkerRunning,
            brokerages: db.getBrokerageResearch({
                search: brokerageSearch,
                limit: brokerageLimit
            }),
            rosterContacts: db.getRosterContacts(rosterFilters),
            rosterTotal: db.getRosterContactsCount(rosterFilters),
            rosterLimit,
            rosterOffset,
            status: db.getLeadIntelligenceStatus()
        });
    } catch (err) {
        console.error('[CRM Intelligence API Error]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Update a single lead stage/history
app.put('/api/leads/:id', (req, res) => {
    try {
        const { id } = req.params;
        const lead = db.getLeadById(parseInt(id));
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
        
        const updated = {
            ...lead,
            ...req.body,
            id: parseInt(id)
        };
        if (['DNC', 'Opted Out', 'Quarantined'].includes(updated.stage)) {
            db.addEmailToDnc(updated.email, `Lead marked ${updated.stage} from CRM`);
        }
        db.updateLead(updated);
        res.json({ success: true });
    } catch (err) {
        console.error('[CRM Lead Update Error]', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/leads/:id/pause-campaign', (req, res) => {
    try {
        const leadId = parseInt(req.params.id);
        const lead = db.getLeadById(leadId);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        const pausedEnrollments = db.pauseLeadEnrollments(leadId, 'Paused');
        lead.currentCampaignId = null;
        lead.currentCampaignStep = null;
        lead.lastStepTime = null;
        lead.history = Array.isArray(lead.history) ? lead.history : [];
        lead.history.push({
            sender: 'agent-action',
            time: 'Just Now',
            text: pausedEnrollments > 0
                ? 'Campaign outreach manually paused for this lead.'
                : 'Manual pause requested. No active campaign enrollment was running.'
        });
        db.updateLead(lead);

        const updatedLead = attachEnrollmentSummaries([db.getLeadById(leadId)])[0];
        res.json({ success: true, pausedEnrollments, lead: updatedLead });
    } catch (err) {
        console.error('[CRM Lead Pause Error]', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/leads/:id', (req, res) => {
    try {
        const leadId = parseInt(req.params.id);
        const lead = db.getLeadById(leadId);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        const deleted = db.deleteLead(leadId);
        res.json({ success: true, deleted });
    } catch (err) {
        console.error('[CRM Lead Delete Error]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// DNC endpoints
app.get('/api/dnc', (req, res) => {
    try {
        res.json(db.getDncList());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/dnc', (req, res) => {
    try {
        const { email, reason } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });
        db.addEmailToDnc(email, reason);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/dnc/:email', (req, res) => {
    try {
        if (process.env.ALLOW_DNC_REMOVAL !== 'true') {
            return res.status(403).json({
                error: 'DNC removals are disabled. Set ALLOW_DNC_REMOVAL=true only for deliberate admin recovery.'
            });
        }
        const { email } = req.params;
        db.removeEmailFromDnc(email);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Utility: Call Gemini API securely from the backend
async function queryGemini(promptText, options = {}) {
    if (!GEMINI_API_KEY) {
        throw new Error("Gemini API key is not configured in .env file.");
    }
    const model = options.model || GEMINI_DEFAULT_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await postGeminiWithRetry(url, {
        contents: [{
            parts: [{
                text: promptText
            }]
        }]
    }, `Gemini:${model}`);

    if (response.data && response.data.candidates && response.data.candidates[0].content) {
        return response.data.candidates[0].content.parts[0].text;
    } else {
        throw new Error("Invalid response format received from Gemini API");
    }
}

// Google Search Grounding wrapper for Gemini
async function queryGeminiWithSearch(promptText, options = {}) {
    if (!GEMINI_API_KEY) {
        throw new Error("Gemini API key is not configured in .env file.");
    }
    const model = options.model || GEMINI_DEFAULT_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
        contents: [{
            parts: [{
                text: promptText
            }]
        }],
        tools: [{
            googleSearch: {}
        }]
    };

    if (options.json === true) {
        payload.generationConfig = {
            responseMimeType: "application/json"
        };
    }

    let response;
    try {
        response = await postGeminiWithRetry(url, payload, `Gemini Search:${model}`);
    } catch (error) {
        if (options.json === true && error.response && error.response.status === 400) {
            console.warn('[Gemini Search] JSON response mode rejected; retrying grounded request without responseMimeType.');
            delete payload.generationConfig;
            response = await postGeminiWithRetry(url, payload, `Gemini Search:${model}`);
        } else {
            throw error;
        }
    }

    if (response.data && response.data.candidates && response.data.candidates[0].content) {
        return response.data.candidates[0].content.parts[0].text;
    } else {
        throw new Error("Invalid response format received from Gemini API");
    }
}

async function queryOpenRouter(promptText, options = {}) {
    const model = options.model || OPENROUTER_DEFAULT_MODEL;
    const payload = {
        model,
        messages: [{
            role: 'user',
            content: promptText
        }],
        temperature: options.temperature ?? 0.2
    };

    if (options.json === true) {
        payload.response_format = { type: 'json_object' };
    }

    if (options.maxTokens) {
        payload.max_tokens = options.maxTokens;
    }

    if (options.webSearch === true) {
        const settings = getOpenRouterIntegrationSettings();
        payload.plugins = [{
            id: 'web',
            max_results: settings.webSearchMaxResults
        }];
    }

    let response;
    try {
        response = await postOpenRouterWithRetry(payload, `OpenRouter:${model}`, options.timeoutMs || 120000);
    } catch (error) {
        if (options.json === true && error.response && error.response.status === 400) {
            console.warn(`[OpenRouter:${model}] JSON response_format rejected; retrying without enforced JSON mode.`);
            delete payload.response_format;
            response = await postOpenRouterWithRetry(payload, `OpenRouter:${model}`, options.timeoutMs || 120000);
        } else {
            throw error;
        }
    }

    const message = response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message;
    const content = message && message.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map(part => part.text || part.content || '').join('\n').trim();
    }
    throw new Error('Invalid response format received from OpenRouter API');
}

function isOpenRouterModelFallbackError(error) {
    const status = error.response && error.response.status;
    return [400, 402, 403, 404, 408, 409, 422, 429, 500, 502, 503, 504].includes(status)
        || ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(error.code)
        || /rate|quota|limit|exhaust|provider|unavailable|disabled|not found|moderation|maximum/i.test(String(error.message || ''));
}

async function queryOpenRouterWithModelFallback(promptText, options = {}) {
    const settings = getOpenRouterIntegrationSettings();
    const modelOrder = normalizeOpenRouterModelOrder(options.modelOrder || settings.modelOrder);
    const maxModels = Math.min(Math.max(parseInt(options.maxModels, 10) || 3, 1), modelOrder.length || 1);
    let lastError;
    let attempts = 0;
    let consecutiveRateLimits = 0;

    for (const model of modelOrder) {
        if (attempts >= maxModels) break;
        attempts++;
        try {
            const text = await queryOpenRouter(promptText, {
                ...options,
                model
            });
            return { text, model };
        } catch (error) {
            lastError = error;
            const status = error.response && error.response.status;
            consecutiveRateLimits = status === 429 ? consecutiveRateLimits + 1 : 0;
            console.warn(`[OpenRouter:${model}] failed: ${formatErrorMessage(error, 'OpenRouter model failed.')}`);
            if (consecutiveRateLimits >= 2) break;
            if (!isOpenRouterModelFallbackError(error)) break;
        }
    }

    throw lastError || new Error('OpenRouter model fallback list is empty.');
}

async function queryLeadIntelligenceResearch(promptText, options = {}) {
    if (getLeadIntelligenceResearchProvider() === 'openrouter') {
        const settings = getOpenRouterIntegrationSettings();
        if (!settings.enabled) {
            throw new Error('Lead Intelligence is configured for OpenRouter, but OpenRouter is not enabled or no API key is configured.');
        }
        const result = await queryOpenRouterWithModelFallback(promptText, {
            json: options.json,
            modelOrder: options.modelOrder,
            webSearch: settings.webSearchEnabled,
            maxModels: options.maxModels || 3,
            timeoutMs: options.timeoutMs || 120000
        });
        return result.text;
    }

    return queryGeminiWithSearch(promptText, {
        ...options,
        model: options.model || GEMINI_RESEARCH_MODEL
    });
}

async function queryJsonRepairModel(promptText, options = {}) {
    if (getOpenRouterIntegrationSettings().enabled && canUseOpenRouter()) {
        try {
            const result = await queryOpenRouterWithModelFallback(promptText, {
                json: true,
                modelOrder: [OPENROUTER_DEFAULT_MODEL, ...getOpenRouterIntegrationSettings().modelOrder],
                maxModels: 3,
                maxTokens: 4096,
                timeoutMs: 90000
            });
            return result.text;
        } catch (error) {
            if (options.allowGeminiFallback === false) {
                throw new Error(`OpenRouter JSON repair failed and Gemini fallback is disabled: ${error.message}`);
            }
            console.warn(`[JSON Repair] OpenRouter repair failed; falling back to Gemini: ${error.message}`);
        }
    }
    if (options.allowGeminiFallback === false) {
        throw new Error('OpenRouter JSON repair is unavailable and Gemini fallback is disabled.');
    }
    return queryGemini(promptText);
}

async function createGeminiInteraction({ model, input, responseFormat, generationConfig, label = 'Gemini Interaction', timeoutMs = 120000 }) {
    if (!GEMINI_API_KEY) {
        throw new Error("Gemini API key is not configured in .env file.");
    }

    const payload = { model, input };
    if (responseFormat) payload.response_format = responseFormat;
    if (generationConfig) payload.generation_config = generationConfig;

    const response = await postGeminiWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/interactions?key=${GEMINI_API_KEY}`,
        payload,
        `${label}:${model}`,
        timeoutMs
    );
    return response.data;
}

function extractInteractionMedia(interaction, desiredType) {
    if (!interaction || typeof interaction !== 'object') return null;

    const directKey = desiredType === 'video' ? 'output_video' : 'output_image';
    if (interaction[directKey] && interaction[directKey].data) {
        return interaction[directKey];
    }

    for (const step of interaction.steps || []) {
        for (const item of step.content || []) {
            const itemType = String(item.type || '').toLowerCase();
            const mimeType = String(item.mime_type || item.mimeType || '').toLowerCase();
            if (item.data && (itemType === desiredType || mimeType.startsWith(`${desiredType}/`))) {
                return item;
            }
        }
    }

    return null;
}

function extensionFromMime(mimeType, fallback) {
    const clean = String(mimeType || '').toLowerCase();
    if (clean.includes('jpeg') || clean.includes('jpg')) return 'jpg';
    if (clean.includes('png')) return 'png';
    if (clean.includes('webp')) return 'webp';
    if (clean.includes('mp4')) return 'mp4';
    if (clean.includes('webm')) return 'webm';
    return fallback;
}

function cleanModelJson(rawText) {
    const cleaned = String(rawText || '').replace(/```json|```/g, "").trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return cleaned.slice(firstBrace, lastBrace + 1);
    }
    return cleaned;
}

function escapeControlCharactersInJsonStrings(jsonText) {
    let output = '';
    let inString = false;
    let escaping = false;

    for (const char of String(jsonText || '')) {
        if (escaping) {
            output += char;
            escaping = false;
            continue;
        }

        if (char === '\\') {
            output += char;
            escaping = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            output += char;
            continue;
        }

        if (inString) {
            if (char === '\n') {
                output += '\\n';
                continue;
            }
            if (char === '\r') {
                output += '\\r';
                continue;
            }
            if (char === '\t') {
                output += '\\t';
                continue;
            }
            if (char.charCodeAt(0) < 32) {
                output += `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
                continue;
            }
        }

        output += char;
    }

    return output;
}

function parseModelJson(rawText) {
    const cleaned = cleanModelJson(rawText);
    try {
        return JSON.parse(cleaned);
    } catch (error) {
        if (/control character|bad control character/i.test(error.message)) {
            return JSON.parse(escapeControlCharactersInJsonStrings(cleaned));
        }
        throw error;
    }
}

function firstNonEmptyField(source, keys = []) {
    if (!source || typeof source !== 'object') return '';
    for (const key of keys) {
        if (source[key]) return source[key];
    }
    return '';
}

function stringifySwotSection(body) {
    if (!body) return '';
    if (Array.isArray(body)) return body.map(item => String(item).trim()).filter(Boolean).join('; ');
    if (typeof body === 'object') {
        return Object.values(body).map(item => String(item).trim()).filter(Boolean).join('; ');
    }
    return String(body).trim();
}

function normalizeSwotProfile(value, fallbackReport = '') {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object') {
        const nested = firstNonEmptyField(value, [
            'swotProfile',
            'swot_profile',
            'swotAnalysis',
            'swot_analysis',
            'SWOT',
            'SWOTAnalysis',
            'businessAnalysis'
        ]);
        if (nested && nested !== value) {
            const normalizedNested = normalizeSwotProfile(nested, fallbackReport);
            if (normalizedNested) return normalizedNested;
        }

        const sections = [
            ['Strengths', firstNonEmptyField(value, ['strengths', 'Strengths', 'strength', 'Strength', 'advantages', 'competitiveAdvantages', 'pros'])],
            ['Weaknesses', firstNonEmptyField(value, ['weaknesses', 'Weaknesses', 'weakness', 'Weakness', 'gaps', 'limitations', 'cons'])],
            ['Opportunities', firstNonEmptyField(value, ['opportunities', 'Opportunities', 'opportunity', 'Opportunity', 'growthOpportunities', 'openings'])],
            ['Threats', firstNonEmptyField(value, ['threats', 'Threats', 'threat', 'Threat', 'risks', 'competitiveThreats'])]
        ].filter(([, body]) => body);

        if (sections.length) {
            return sections.map(([label, body]) => {
                const text = stringifySwotSection(body);
                return `${label}: ${text}`;
            }).join('\n\n');
        }
    }

    const report = String(fallbackReport || '').trim();
    const swotIndex = report.toLowerCase().indexOf('swot');
    if (swotIndex !== -1) {
        return report.slice(swotIndex, swotIndex + 1600).trim();
    }

    return '';
}

function buildDeterministicSwotProfile({ businessName, description, offers, valueProposition, competitorProfiles = [] } = {}) {
    const name = businessName || 'This business';
    const cleanDescription = String(description || '').trim();
    const cleanOffers = String(offers || '').replace(/\n+/g, '; ').trim();
    const cleanValue = String(valueProposition || '').trim();
    const competitorStrengths = competitorProfiles
        .map(profile => `${profile.name || profile.domain}: ${profile.strengths || profile.summary || ''}`.trim())
        .filter(text => text.length > 12)
        .slice(0, 3)
        .join(' | ');

    return [
        `Strengths: ${name} appears strongest around ${cleanValue || cleanDescription || 'its core offer and market positioning'}. The scanned offers point to ${cleanOffers || 'a focused product/service mix'} that can be reused in ads, social posts, and sales replies.`,
        `Weaknesses: The public scan should be reviewed for proof depth, pricing clarity, comparison pages, demos, case studies, and trust signals. Any missing specifics here can make it harder for AI campaigns to answer objections confidently.`,
        `Opportunities: ${name} can turn the company profile, competitor gaps, and customer pain points into stronger landing-page copy, comparison content, segmented ads, and repeatable email/social angles. Competitor monitoring can also surface timely posts and objections to respond to.`,
        `Threats: Competitors may have stronger brand recognition, broader feature pages, more social proof, or clearer category positioning. ${competitorStrengths ? `Notable competitor strengths found: ${competitorStrengths}.` : 'The team should keep monitoring competitor messaging and social channels so campaigns stay current.'}`
    ].join('\n\n');
}

async function generateFallbackSwotProfile({ result, competitorProfiles }) {
    const prompt = `Create a concise SWOT profile for this company based only on the verified research data below.
Return four labeled paragraphs exactly as:
Strengths: ...

Weaknesses: ...

Opportunities: ...

Threats: ...

Company research JSON:
${JSON.stringify({
        businessName: result.businessName,
        description: result.description,
        offers: result.offers,
        valueProposition: result.valueProposition,
        competitors: competitorProfiles
    }).slice(0, 12000)}`;

    try {
        const response = await queryGemini(prompt, { model: GEMINI_RESEARCH_MODEL });
        return normalizeSwotProfile(response);
    } catch (error) {
        console.warn(`[SWOT Fallback] Gemini fallback failed: ${error.message}`);
        return '';
    }
}

function normalizeCompetitorProfile(profile = {}) {
    const domain = normalizeDomain(profile.domain || profile.website || profile.url || profile.name || '');
    if (!domain) return null;
    return {
        name: String(profile.name || domain).trim(),
        domain,
        summary: String(profile.summary || '').trim(),
        strengths: String(profile.strengths || '').trim(),
        weaknesses: String(profile.weaknesses || '').trim(),
        differentiationAgainstCompany: String(profile.differentiationAgainstCompany || profile.positioning || '').trim(),
        socialLinks: profile.socialLinks && typeof profile.socialLinks === 'object' ? profile.socialLinks : {}
    };
}

function mergeCompetitorProfiles(...profileGroups) {
    const byDomain = new Map();
    profileGroups.flat().filter(Boolean).forEach(profile => {
        const normalized = normalizeCompetitorProfile(profile);
        if (!normalized) return;
        byDomain.set(normalized.domain, {
            ...(byDomain.get(normalized.domain) || {}),
            ...normalized,
            socialLinks: {
                ...((byDomain.get(normalized.domain) || {}).socialLinks || {}),
                ...(normalized.socialLinks || {})
            }
        });
    });
    return Array.from(byDomain.values());
}

async function researchCompetitorProfiles({ businessName, description, offers, existingDomains = [], minimum = 5 }) {
    const excludeList = existingDomains.filter(Boolean).join(', ') || 'none';
    const prompt = `You are a competitive intelligence researcher.
Use Google Search grounding to identify enough additional real direct competitors to reach at least ${minimum} total competitor domains for this business.
Do not include these already-known competitors unless adding missing profile details for them: ${excludeList}

Business:
Name: ${businessName || 'Unknown'}
Description: ${description || 'Not provided'}
Core Offers: ${offers || 'Not provided'}

Return ONLY valid JSON:
{
  "competitorProfiles": [
    {
      "name": "Competitor name",
      "domain": "competitor.com",
      "summary": "What they offer and who they serve.",
      "strengths": "Specific competitive strengths.",
      "weaknesses": "Openings or limitations compared with this business.",
      "differentiationAgainstCompany": "How this business can position against them.",
      "socialLinks": {
        "linkedin": "",
        "facebook": "",
        "instagram": "",
        "youtube": "",
        "tiktok": "",
        "x": ""
      }
    }
  ]
}`;

    const raw = await queryGeminiWithSearch(prompt, { json: true, model: GEMINI_RESEARCH_MODEL });
    const data = await parseModelJsonWithRepair(raw, { allowGeminiFallback: false });
    return Array.isArray(data.competitorProfiles) ? data.competitorProfiles : [];
}

async function ensureMinimumCompetitorProfiles({ profiles, competitorDomains = [], businessName, description, offers, minimum = 5 }) {
    let merged = mergeCompetitorProfiles(
        profiles,
        competitorDomains.map(domain => ({ domain }))
    );

    if (merged.length < minimum) {
        const additional = await researchCompetitorProfiles({
            businessName,
            description,
            offers,
            existingDomains: merged.map(profile => profile.domain),
            minimum
        });
        merged = mergeCompetitorProfiles(merged, additional);
    }

    return merged;
}

async function parseModelJsonWithRepair(rawText, options = {}) {
    try {
        return parseModelJson(rawText);
    } catch (parseError) {
        console.warn(`[JSON Repair] Model returned invalid JSON. Asking repair model to fix it: ${parseError.message}`);
        const repairPrompt = `Repair the invalid JSON below so it becomes valid JSON.
Rules:
- Return ONLY the repaired JSON object.
- Do not add markdown fences.
- Preserve all fields and useful content.
- Escape quotes, newlines, tabs, and other control characters inside string values.
- Do not invent new facts.

Parser error:
${parseError.message}

Invalid JSON:
-----------------
${cleanModelJson(rawText)}
-----------------`;

        const repaired = await queryJsonRepairModel(repairPrompt, options);
        return parseModelJson(repaired);
    }
}

function normalizeWebsiteUrl(input) {
    let normalized = String(input || '').trim();
    if (!/^https?:\/\//i.test(normalized)) {
        normalized = `https://${normalized}`;
    }
    return normalized;
}

function normalizeDomain(input) {
    const value = String(input || '').trim();
    try {
        const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
        return new URL(withProtocol).hostname.replace(/^www\./i, '').toLowerCase();
    } catch (error) {
        return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();
    }
}

function compactText(text, maxLength = 6000) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function socialPlatformFromUrl(href) {
    const lower = String(href || '').toLowerCase();
    if (lower.includes('linkedin.com')) return 'linkedin';
    if (lower.includes('facebook.com')) return 'facebook';
    if (lower.includes('instagram.com')) return 'instagram';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    if (lower.includes('tiktok.com')) return 'tiktok';
    if (lower.includes('twitter.com') || lower.includes('x.com')) return 'x';
    return null;
}

function isUsefulInternalLink(urlObj) {
    const pathName = urlObj.pathname.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|mov|avi|css|js)$/i.test(pathName)) return false;
    return [
        'about',
        'product',
        'service',
        'solution',
        'feature',
        'pricing',
        'case',
        'customer',
        'industry',
        'platform',
        'integrations',
        'demo',
        'blog'
    ].some(keyword => pathName.includes(keyword));
}

function extractReadableSnapshot(html, pageUrl, baseHost) {
    const $ = cheerio.load(html);

    const title = compactText($('title').first().text(), 140);
    const socialLinks = {};
    const internalLinks = [];

    $('a[href]').each((i, el) => {
        const rawHref = $(el).attr('href');
        if (!rawHref || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('#')) return;
        try {
            const absolute = new URL(rawHref, pageUrl);
            if (!['http:', 'https:'].includes(absolute.protocol)) return;
            const platform = socialPlatformFromUrl(absolute.href);
            if (platform && !socialLinks[platform]) {
                socialLinks[platform] = absolute.href;
            }
            const host = absolute.hostname.replace(/^www\./i, '').toLowerCase();
            if (host === baseHost && isUsefulInternalLink(absolute)) {
                const cleanUrl = `${absolute.origin}${absolute.pathname}`.replace(/\/+$/, '');
                if (!internalLinks.includes(cleanUrl)) internalLinks.push(cleanUrl);
            }
        } catch (error) {
            // Ignore malformed links.
        }
    });

    $('script, style, nav, footer, header, iframe, noscript, svg').remove();

    let pageText = '';
    $('h1, h2, h3, h4, p, li, td, th').each((i, el) => {
        const txt = compactText($(el).text(), 500);
        if (txt.length > 20) {
            pageText += `${txt}\n`;
        }
    });

    return {
        url: pageUrl,
        title,
        text: pageText.trim().slice(0, 9000),
        internalLinks,
        socialLinks
    };
}

async function fetchReadableSnapshot(pageUrl, baseHost) {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await axios.get(pageUrl, {
                headers: SCRAPER_HEADERS,
                timeout: 12000,
                maxRedirects: 4
            });
            return extractReadableSnapshot(response.data, response.request?.res?.responseUrl || pageUrl, baseHost);
        } catch (error) {
            lastError = error;
            if (attempt < 3 && ['EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT'].includes(error.code)) {
                await new Promise(resolve => setTimeout(resolve, 700 * attempt));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

async function crawlBusinessWebsite(startUrl) {
    const normalizedUrl = normalizeWebsiteUrl(startUrl);
    const baseHost = normalizeDomain(normalizedUrl);
    const homepage = await fetchReadableSnapshot(normalizedUrl, baseHost);
    const candidateLinks = homepage.internalLinks
        .filter(link => normalizeDomain(link) === baseHost)
        .slice(0, 7);

    const pageResults = await Promise.allSettled(candidateLinks.map(link => fetchReadableSnapshot(link, baseHost)));
    const snapshots = [homepage];
    for (const result of pageResults) {
        if (result.status === 'fulfilled' && result.value && result.value.text) {
            snapshots.push(result.value);
        }
    }

    const socialLinks = snapshots.reduce((acc, snapshot) => ({
        ...acc,
        ...snapshot.socialLinks
    }), {});

    const combinedText = snapshots
        .map(snapshot => `Source: ${snapshot.url}\nTitle: ${snapshot.title || 'Untitled'}\n${snapshot.text}`)
        .join('\n\n---\n\n')
        .slice(0, 26000)
        .trim();

    return {
        normalizedUrl,
        baseHost,
        pagesScanned: snapshots.map(snapshot => snapshot.url),
        socialLinks,
        combinedText
    };
}

function isLikelyEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim().toLowerCase());
}

function normalizeLeadCandidate(lead = {}, discoveryQuery = '', defaultSource = '') {
    const rawEmails = Array.isArray(lead.emails)
        ? lead.emails
        : String(lead.email || lead.emails || '')
            .split(/[,\s;|]+/)
            .filter(Boolean);

    const emails = [...new Set(rawEmails
        .map(email => String(email || '').trim().toLowerCase())
        .filter(isLikelyEmail))];

    const name = String(lead.name || lead.title || lead.businessName || lead.company || '').trim();
    const company = String(lead.company || lead.title || lead.businessName || name || 'Independent').trim();
    const phone = String(lead.phone || lead.telephone || '').trim();
    const website = String(lead.website || lead.web_site || lead.url || '').trim();
    const address = String(lead.address || lead.complete_address || lead.formattedAddress || '').trim();
    const sourceUrl = String(lead.sourceUrl || lead.source_url || lead.link || website || defaultSource || '').trim();

    return emails.map(email => ({
        name,
        company,
        email,
        phone,
        website,
        address,
        sourceUrl,
        discoveryQuery
    }));
}

function parseCsvRows(csvText) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const ch = csvText[i];
        const next = csvText[i + 1];

        if (ch === '"') {
            if (inQuotes && next === '"') {
                field += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            row.push(field);
            field = '';
        } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
            if (ch === '\r' && next === '\n') i++;
            row.push(field);
            if (row.some(value => value !== '')) rows.push(row);
            row = [];
            field = '';
        } else {
            field += ch;
        }
    }

    if (field || row.length) {
        row.push(field);
        if (row.some(value => value !== '')) rows.push(row);
    }

    if (rows.length < 2) return [];

    const headers = rows[0].map(header => String(header || '').trim().toLowerCase());
    return rows.slice(1).map(values => {
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });
        return obj;
    });
}

function parseEmailListFromCsvValue(value) {
    const raw = String(value || '');
    const matches = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    return [...new Set(matches
        .map(email => email.toLowerCase().replace(/[.,;:!?)]$/, ''))
        .filter(email => isUsefulLeadEmail(email)))];
}

function isUsefulLeadEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!isLikelyEmail(normalized) || normalized.length > 254) return false;

    const [local, domain] = normalized.split('@');
    if (!local || !domain) return false;
    if (/^(admin|billing|bookings?|bugreport|careers?|contact|customerservice|hello|help|info|inquiries|marketing|media|office|sales|service|support|team|webmaster)$/i.test(local)) return false;
    if (domain.includes('example.') || domain === 'domain.com' || domain === 'email.com') return false;
    if (/\.(png|jpe?g|gif|webp|svg|css|js|ico|woff2?|ttf|eot)$/i.test(domain)) return false;
    return true;
}

function getMapsRowValue(row, ...keys) {
    for (const key of keys) {
        if (row[key] !== undefined && String(row[key]).trim()) return String(row[key]).trim();
    }
    return '';
}

function formatMapsAddress(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    if (raw.startsWith('{')) {
        try {
            const parsed = JSON.parse(raw);
            const cityStateZip = [
                parsed.city,
                [parsed.state, parsed.postal_code].filter(Boolean).join(' ')
            ].filter(Boolean).join(', ');
            const parts = [parsed.street, cityStateZip, parsed.country]
                .map(part => String(part || '').trim())
                .filter(Boolean);
            return parts.join(', ');
        } catch (error) {
            return raw;
        }
    }

    return raw;
}

function extractPublicEmailsFromHtml(html) {
    const $ = cheerio.load(String(html || ''));
    const emailText = [];

    $('a[href^="mailto:"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const emailValue = href.replace(/^mailto:/i, '').split('?')[0];
        try {
            emailText.push(decodeURIComponent(emailValue));
        } catch (error) {
            emailText.push(emailValue);
        }
    });

    $('[itemprop="email"], [property="email"], [name="email"]').each((i, el) => {
        emailText.push($(el).attr('content') || $(el).text());
    });

    $('[data-email], [data-contact-email], [aria-label*="email" i], [title*="email" i]').each((i, el) => {
        emailText.push(
            $(el).attr('data-email') ||
            $(el).attr('data-contact-email') ||
            $(el).attr('aria-label') ||
            $(el).attr('title') ||
            $(el).text()
        );
    });

    emailText.push($.root().text());
    emailText.push(String(html || ''));

    return parseEmailListFromCsvValue(emailText.join('\n'));
}

function extractEmbeddedAgentObjectsFromHtml(html, brokerageName = '', discoveryQuery = '', pageUrl = '') {
    const source = String(html || '');
    const objectPattern = /\{[^{}]*"(?:emailAddress|email|email_address)"\s*:\s*"[^"]+@[^"]+"[^{}]*\}/gi;
    const candidates = [];
    const seen = new Set();

    function decodeJsonString(value = '') {
        return String(value || '')
            .replace(/\\u0026/g, '&')
            .replace(/\\\//g, '/')
            .replace(/\\"/g, '"')
            .replace(/\\n/g, ' ')
            .replace(/\\r/g, ' ')
            .replace(/\\t/g, ' ')
            .trim();
    }

    function fieldFromObjectText(objectText, names = []) {
        for (const name of names) {
            const pattern = new RegExp(`"${name}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i');
            const match = objectText.match(pattern);
            if (match) return decodeJsonString(match[1]);
        }
        return '';
    }

    for (const match of source.matchAll(objectPattern)) {
        const objectText = match[0];
        const email = fieldFromObjectText(objectText, ['emailAddress', 'email', 'email_address']);
        if (!isUsefulLeadEmail(email)) continue;

        const name = normalizeAgentName(fieldFromObjectText(objectText, [
            'fullName',
            'displayName',
            'name',
            'agentName',
            'firstLastName'
        ]));
        if (!isLikelyIndividualAgentLeadName(name)) continue;

        const relativeUrl = fieldFromObjectText(objectText, ['url', 'profileUrl', 'profileURL', 'agentUrl', 'agentURL']);
        const sourceUrl = relativeUrl
            ? new URL(relativeUrl, pageUrl || 'https://example.com').href
            : pageUrl;
        const phone = fieldFromObjectText(objectText, [
            'cellPhoneNumber',
            'mobilePhoneNumber',
            'businessPhoneNumber',
            'phoneNumber',
            'phone'
        ]);
        const company = cleanLeadText(fieldFromObjectText(objectText, ['companyName', 'brokerageName', 'officeName']) || brokerageName);
        const key = `${name.toLowerCase()}|${email.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        candidates.push({
            name,
            company: company || brokerageName || name,
            email,
            phone: phone ? cleanLeadText(phone) : '',
            website: sourceUrl || pageUrl,
            sourceUrl: sourceUrl || pageUrl,
            discoveryQuery
        });
    }

    const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    for (const match of source.matchAll(emailPattern)) {
        const email = String(match[0] || '').toLowerCase();
        if (!isUsefulLeadEmail(email)) continue;

        const fallbackStart = Math.max(0, match.index - 6000);
        const fallbackEnd = Math.min(source.length, match.index + 3000);
        const nearestAgentMarker = source.lastIndexOf('"agentMasterId"', match.index);
        const objectStart = nearestAgentMarker >= 0 ? Math.max(0, source.lastIndexOf('{', nearestAgentMarker)) : fallbackStart;
        const nextAgentMarker = source.indexOf('"agentMasterId"', match.index + email.length);
        const objectEnd = nextAgentMarker > match.index ? Math.max(match.index + email.length, source.lastIndexOf('{', nextAgentMarker)) : fallbackEnd;
        const windowText = source.slice(objectStart, objectEnd);
        const beforeEmail = source.slice(objectStart, match.index);

        const name = normalizeAgentName(fieldFromObjectText(windowText, [
            'fullName',
            'displayName',
            'agentName',
            'name',
            'firstLastName'
        ]) || (() => {
            const nameMatches = [...beforeEmail.matchAll(/"(?:fullName|displayName|agentName|name)"\s*:\s*"((?:\\.|[^"\\])*)"/gi)];
            const lastNameMatch = nameMatches[nameMatches.length - 1];
            return lastNameMatch ? decodeJsonString(lastNameMatch[1]) : '';
        })());
        if (!isLikelyIndividualAgentLeadName(name)) continue;

        const phone = fieldFromObjectText(windowText, [
            'cellPhoneNumber',
            'mobilePhoneNumber',
            'businessPhoneNumber',
            'phoneNumber',
            'phone'
        ]);
        const afterEmailText = source.slice(match.index, objectEnd);
        const relativeUrl = fieldFromObjectText(afterEmailText, ['url', 'profileUrl', 'profileURL', 'agentUrl', 'agentURL'])
            || fieldFromObjectText(windowText, ['profileUrl', 'profileURL', 'agentUrl', 'agentURL', 'url']);
        const sourceUrl = relativeUrl
            ? new URL(relativeUrl, pageUrl || 'https://example.com').href
            : pageUrl;
        const company = fieldFromObjectText(windowText, ['companyName', 'brokerageName', 'officeName']) || brokerageName;
        const key = `${name.toLowerCase()}|${email}`;
        if (seen.has(key)) continue;
        seen.add(key);

        candidates.push({
            name,
            company: cleanLeadText(company) || brokerageName || name,
            email,
            phone: phone ? cleanLeadText(phone) : '',
            website: sourceUrl || pageUrl,
            sourceUrl: sourceUrl || pageUrl,
            discoveryQuery
        });
    }

    return mergeLeadCandidatesByEmail(candidates);
}

function cleanLeadText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractPhoneFromText(value) {
    const text = String(value || '');
    const match = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?:\s*(?:x|ext\.?)\s*\d+)?/i);
    return match ? cleanLeadText(match[0]) : '';
}

function isPlausibleAgentName(value, brokerageName = '') {
    const text = cleanLeadText(value)
        .replace(/\b(realtor|broker|associate broker|agent|sales associate|licensed|abr|crs|gri|sfr|srs)\b/ig, '')
        .replace(/[|•·]+/g, ' ')
        .trim();

    if (!text || text.length < 3 || text.length > 80) return false;
    if (text.includes('@') || /\d{3}/.test(text)) return false;
    if (brokerageName && text.toLowerCase() === cleanLeadText(brokerageName).toLowerCase()) return false;
    if (/\b(contact|email|phone|office|search|language|agents?|realtors?|brokerage|properties|listings|buy|sell|home|privacy|policy|terms?|cookies?|unable|error|page|website|site map|accessibility)\b/i.test(text)) return false;
    return /^[A-Za-z][A-Za-z .,'-]+$/.test(text);
}

function isLikelyIndividualAgentLeadName(value = '') {
    const name = cleanLeadText(value);
    if (!isPlausibleAgentName(name)) return false;
    if (/\b(real(ty| estate)|properties?|brokerage|company|group|team|llc|inc|ltd|coastal|resort|executives|office|homes?|partners?|associates?)\b/i.test(name)) return false;
    const words = name.split(/\s+/).filter(Boolean);
    return words.length >= 2 && words.length <= 4;
}

function normalizeAgentName(value) {
    return cleanLeadText(value)
        .replace(/\b(realtor|broker|associate broker|agent|sales associate|licensed)\b/ig, '')
        .replace(/[|•·]+/g, ' ')
        .trim();
}

function normalizeLeadIdentityText(value = '') {
    return cleanLeadText(value)
        .toLowerCase()
        .replace(/\b(realtor|broker|associate broker|agent|sales associate|licensed|llc|inc|ltd|company|co)\b/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeLeadPhoneKey(value = '') {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
    return digits.length >= 10 ? digits.slice(-10) : '';
}

function getLeadDomainKey(lead = {}) {
    const domain = normalizeDomain(lead.website || lead.sourceUrl || '');
    return domain && !domain.includes('@') ? domain : '';
}

function getLeadIdentityKey(lead = {}) {
    const nameKey = normalizeLeadIdentityText(lead.name);
    if (!nameKey) return '';

    const phoneKey = normalizeLeadPhoneKey(lead.phone);
    if (phoneKey) return `name-phone:${nameKey}|${phoneKey}`;

    const companyKey = normalizeLeadIdentityText(lead.company);
    if (companyKey) return `name-company:${nameKey}|${companyKey}`;

    const domainKey = getLeadDomainKey(lead);
    if (domainKey) return `name-domain:${nameKey}|${domainKey}`;

    return `name:${nameKey}`;
}

function isDisallowedLeadSourceUrl(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return false;

    try {
        const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
        const pathText = decodeURIComponent(`${parsed.pathname} ${parsed.search}`).toLowerCase();
        return /\b(privacy|terms|cookie|cookies|legal|accessibility|dmca|disclaimer|site-?map|policy)\b/i.test(pathText);
    } catch (error) {
        return /\b(privacy|terms|cookie|cookies|legal|accessibility|dmca|disclaimer|site-?map|policy)\b/i.test(raw);
    }
}

function leadIdentityMatches(a = {}, b = {}) {
    const nameA = normalizeLeadIdentityText(a.name);
    const nameB = normalizeLeadIdentityText(b.name);
    if (!nameA || !nameB || nameA !== nameB) return false;

    const phoneA = normalizeLeadPhoneKey(a.phone);
    const phoneB = normalizeLeadPhoneKey(b.phone);
    if (phoneA && phoneB && phoneA === phoneB) return true;

    const companyA = normalizeLeadIdentityText(a.company);
    const companyB = normalizeLeadIdentityText(b.company);
    if (companyA && companyB && companyA === companyB) return true;

    const domainA = getLeadDomainKey(a);
    const domainB = getLeadDomainKey(b);
    return Boolean(domainA && domainB && domainA === domainB);
}

function findAgentNameInScope($, scope, brokerageName = '') {
    const preferredSelectors = [
        '[itemprop="name"]',
        '[class*="agent-name" i]',
        '[class*="associate-name" i]',
        '[class*="member-name" i]',
        '[class*="name" i]',
        'h1',
        'h2',
        'h3',
        'h4',
        'strong'
    ];

    for (const selector of preferredSelectors) {
        const matches = $(scope).find(selector).addBack(selector);
        for (const el of matches.toArray()) {
            const candidate = normalizeAgentName($(el).text());
            if (isPlausibleAgentName(candidate, brokerageName)) return candidate;
        }
    }

    const lines = cleanLeadText($(scope).text())
        .split(/(?:(?:\s{2,})|(?:\s-\s)|(?:\s\|\s))/)
        .map(normalizeAgentName)
        .filter(Boolean);

    return lines.find(line => isPlausibleAgentName(line, brokerageName)) || '';
}

function getAgentContactScope($, el) {
    let scope = $(el);
    for (let i = 0; i < 6; i++) {
        const text = cleanLeadText(scope.text());
        if (text.length >= 20 && text.length <= 2500) return scope;
        const parent = scope.parent();
        if (!parent.length || parent.is('body')) break;
        scope = parent;
    }
    return scope;
}

function collectEmailsFromContactElement($, el) {
    const node = $(el);
    const values = [
        node.attr('href') || '',
        node.attr('data-email') || '',
        node.attr('data-contact-email') || '',
        node.attr('aria-label') || '',
        node.attr('title') || '',
        node.text() || '',
        node.html() || ''
    ];

    return parseEmailListFromCsvValue(values.join('\n'));
}

function extractBrokerageAgentCandidatesFromHtml(html, pageUrl, brokerageName, brokerageWebsite, discoveryQuery) {
    if (isDisallowedLeadSourceUrl(pageUrl)) return [];

    const $ = cheerio.load(String(html || ''));
    const candidates = [
        ...extractEmbeddedAgentObjectsFromHtml(html, brokerageName, discoveryQuery, pageUrl)
    ];
    const seenEmails = new Set();
    for (const candidate of candidates) {
        if (candidate.email) seenEmails.add(String(candidate.email).toLowerCase());
        if (Array.isArray(candidate.emails)) {
            candidate.emails.forEach(email => seenEmails.add(String(email).toLowerCase()));
        }
    }

    function pushCandidate(email, scope, defaultName = '') {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        if (!isUsefulLeadEmail(normalizedEmail) || seenEmails.has(normalizedEmail)) return;

        const text = cleanLeadText($(scope).text());
        const defaultCleanName = normalizeAgentName(defaultName);
        const name = isPlausibleAgentName(defaultCleanName, brokerageName)
            ? defaultCleanName
            : findAgentNameInScope($, scope, brokerageName);
        if (!isPlausibleAgentName(name, brokerageName)) return;

        seenEmails.add(normalizedEmail);
        candidates.push({
            name,
            company: brokerageName || name,
            emails: [normalizedEmail],
            phone: extractPhoneFromText(text),
            website: brokerageWebsite || pageUrl,
            sourceUrl: pageUrl,
            discoveryQuery
        });
    }

    $('a[href^="mailto:"], [data-email], [data-contact-email], [aria-label*="email" i], [title*="email" i]').each((i, el) => {
        const emails = collectEmailsFromContactElement($, el);
        const scope = getAgentContactScope($, el);
        for (const email of emails) pushCandidate(email, scope);
    });

    $('script[type="application/ld+json"]').each((i, el) => {
        const raw = $(el).contents().text();
        try {
            const parsed = JSON.parse(raw);
            const nodes = Array.isArray(parsed) ? parsed : [parsed];
            const queue = [...nodes];
            while (queue.length) {
                const node = queue.shift();
                if (!node || typeof node !== 'object') continue;
                if (Array.isArray(node)) {
                    queue.push(...node);
                    continue;
                }
                if (node['@graph']) queue.push(...(Array.isArray(node['@graph']) ? node['@graph'] : [node['@graph']]));
                const type = Array.isArray(node['@type']) ? node['@type'].join(' ') : String(node['@type'] || '');
                const email = String(node.email || '').trim();
                if (email && /\b(person|realestateagent|real estate agent|agent)\b/i.test(type)) {
                    pushCandidate(email, $.root(), node.name || '');
                }
            }
        } catch (error) {
            // Ignore malformed JSON-LD.
        }
    });

    if (candidates.length === 0) {
        const emails = extractPublicEmailsFromHtml(html);
        for (const email of emails) {
            const bodyText = $.root().text();
            const emailIndex = bodyText.toLowerCase().indexOf(email.toLowerCase());
            const windowText = emailIndex >= 0
                ? bodyText.slice(Math.max(0, emailIndex - 600), emailIndex + 600)
                : bodyText.slice(0, 1200);
            const pseudoScope = $('<div></div>').text(windowText);
            pushCandidate(email, pseudoScope);
        }
    }

    return candidates.flatMap(candidate => normalizeLeadCandidate(candidate, discoveryQuery, pageUrl));
}

function isUsefulLeadContactLink(urlObj) {
    const pathName = urlObj.pathname.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|mov|avi|css|js|ico)$/i.test(pathName)) return false;
    return [
        'contact',
        'about',
        'team',
        'staff',
        'agent',
        'realtor',
        'broker',
        'office',
        'location',
        'connect'
    ].some(keyword => pathName.includes(keyword));
}

function collectLeadContactLinks(html, pageUrl, baseHost, maxLinks = 4) {
    const $ = cheerio.load(String(html || ''));
    const links = [];

    $('a[href]').each((i, el) => {
        const rawHref = $(el).attr('href');
        if (!rawHref || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('#')) return;
        try {
            const absolute = new URL(rawHref, pageUrl);
            if (!['http:', 'https:'].includes(absolute.protocol)) return;
            const host = absolute.hostname.replace(/^www\./i, '').toLowerCase();
            if (host !== baseHost || !isUsefulLeadContactLink(absolute)) return;
            absolute.hash = '';
            const cleanUrl = absolute.href.replace(/\/+$/, '');
            if (!links.includes(cleanUrl)) links.push(cleanUrl);
        } catch (error) {
            // Ignore malformed links.
        }
    });

    return links.slice(0, maxLinks);
}

function isLikelyBrokerageRosterLink(urlObj, label = '') {
    const pathName = decodeURIComponent(urlObj.pathname || '').toLowerCase();
    const combined = `${pathName} ${cleanLeadText(label).toLowerCase()}`;
    if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|mov|avi|css|js|ico)$/i.test(pathName)) return false;
    if (/\b(login|signin|signup|register|privacy|terms|property|properties|listing|listings|home-search|idx|valuation|mortgage|careers?)\b/i.test(combined)) return false;
    return BROKERAGE_ROSTER_KEYWORDS.some(keyword => combined.includes(keyword));
}

function collectBrokerageRosterLinks(html, pageUrl, baseHost, maxLinks = 8) {
    const $ = cheerio.load(String(html || ''));
    const scored = new Map();

    $('a[href]').each((i, el) => {
        const rawHref = $(el).attr('href');
        if (!rawHref || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('#')) return;
        try {
            const absolute = new URL(rawHref, pageUrl);
            if (!['http:', 'https:'].includes(absolute.protocol)) return;
            const host = absolute.hostname.replace(/^www\./i, '').toLowerCase();
            if (host !== baseHost || !isLikelyBrokerageRosterLink(absolute, $(el).text())) return;
            absolute.hash = '';
            const cleanUrl = absolute.href.replace(/\/+$/, '');
            const combined = `${absolute.pathname.toLowerCase()} ${cleanLeadText($(el).text()).toLowerCase()}`;
            let score = 1;
            if (/\b(agent|agents|realtor|realtors|getagent|roster)\b/i.test(combined)) score += 4;
            if (/\b(team|staff|professionals|associates)\b/i.test(combined)) score += 2;
            if (/\b(contact|about|office)\b/i.test(combined)) score += 1;
            scored.set(cleanUrl, Math.max(scored.get(cleanUrl) || 0, score));
        } catch (error) {
            // Ignore malformed links.
        }
    });

    return [...scored.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([url]) => url)
        .slice(0, maxLinks);
}

function collectAgentProfileLinks(html, pageUrl, baseHost, maxLinks = 20) {
    const $ = cheerio.load(String(html || ''));
    const links = [];

    $('a[href]').each((i, el) => {
        const rawHref = $(el).attr('href');
        if (!rawHref || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('#')) return;
        try {
            const absolute = new URL(rawHref, pageUrl);
            if (!['http:', 'https:'].includes(absolute.protocol)) return;
            const host = absolute.hostname.replace(/^www\./i, '').toLowerCase();
            if (host !== baseHost) return;
            const pathName = decodeURIComponent(absolute.pathname || '').toLowerCase();
            const label = cleanLeadText($(el).text()).toLowerCase();
            const combined = `${pathName} ${label}`;
            if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|mov|avi|css|js|ico)$/i.test(pathName)) return;
            if (/\b(login|signin|property|properties|listing|listings|search|privacy|terms)\b/i.test(combined)) return;
            if (!/\b(agent|agents|realtor|realtors|associate|contact|profile|getagent)\b/i.test(combined)) return;
            absolute.hash = '';
            const cleanUrl = absolute.href.replace(/\/+$/, '');
            if (cleanUrl !== pageUrl.replace(/\/+$/, '') && !links.includes(cleanUrl)) links.push(cleanUrl);
        } catch (error) {
            // Ignore malformed links.
        }
    });

    return links.slice(0, maxLinks);
}

async function fetchLeadContactHtml(pageUrl) {
    const timeout = Math.min(Math.max(parseInt(process.env.LEAD_WEBSITE_TIMEOUT_MS, 10) || 10000, 3000), 30000);
    const response = await axios.get(pageUrl, {
        headers: SCRAPER_HEADERS,
        timeout,
        maxRedirects: 5,
        maxContentLength: 2 * 1024 * 1024,
        validateStatus: status => status >= 200 && status < 400
    });

    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    if (contentType && !contentType.includes('html') && !contentType.includes('text/plain')) {
        throw new Error(`Unsupported content type ${contentType}`);
    }

    return {
        html: String(response.data || ''),
        finalUrl: response.request?.res?.responseUrl || pageUrl
    };
}

async function findPublicEmailsOnWebsite(website) {
    if (!website) return [];

    const startUrl = normalizeWebsiteUrl(website);
    const baseHost = normalizeDomain(startUrl);
    const found = new Set();

    try {
        const homepage = await fetchLeadContactHtml(startUrl);
        extractPublicEmailsFromHtml(homepage.html).forEach(email => found.add(email));

        if (found.size > 0) {
            return [...found];
        }

        const contactLinks = collectLeadContactLinks(homepage.html, homepage.finalUrl, baseHost);
        const pageResults = await Promise.allSettled(contactLinks.map(link => fetchLeadContactHtml(link)));
        for (const result of pageResults) {
            if (result.status === 'fulfilled') {
                extractPublicEmailsFromHtml(result.value.html).forEach(email => found.add(email));
            }
        }
    } catch (error) {
        console.warn(`[Lead Enrichment] Website email lookup failed for ${website}: ${error.message}`);
    }

    return [...found];
}

async function scrapeBrokerageRosterCandidatesFromWebsite(website, brokerageName, discoveryQuery, seedUrls = []) {
    const firstSeedUrl = Array.isArray(seedUrls) && seedUrls.length ? seedUrls.find(Boolean) : '';
    if (!website && !firstSeedUrl) return [];

    const startUrl = normalizeWebsiteUrl(website || firstSeedUrl);
    const baseHost = normalizeDomain(startUrl);
    const maxRosterPages = Math.min(Math.max(parseInt(process.env.LEAD_ROSTER_MAX_PAGES_PER_SITE, 10) || 12, 3), 40);
    const foundCandidates = [];
    const crawled = new Set();
    const queued = [];

    function addPage(url) {
        const cleanUrl = String(url || '').replace(/\/+$/, '');
        if (!cleanUrl || crawled.has(cleanUrl) || queued.includes(cleanUrl)) return;
        if (normalizeDomain(cleanUrl) !== baseHost) return;
        queued.push(cleanUrl);
    }

    try {
        const homepage = await fetchLeadContactHtml(startUrl);
        addPage(homepage.finalUrl || startUrl);
        (Array.isArray(seedUrls) ? seedUrls : []).forEach(addPage);
        collectBrokerageRosterLinks(homepage.html, homepage.finalUrl, baseHost, Math.min(maxRosterPages, 8)).forEach(addPage);

        while (queued.length && crawled.size < maxRosterPages) {
            const pageUrl = queued.shift();
            if (!pageUrl || crawled.has(pageUrl)) continue;
            crawled.add(pageUrl);

            let page;
            try {
                page = await fetchLeadContactHtml(pageUrl);
            } catch (error) {
                console.warn(`[Brokerage Roster] Failed to fetch ${pageUrl}: ${error.message}`);
                continue;
            }

            const pageCandidates = extractBrokerageAgentCandidatesFromHtml(
                page.html,
                page.finalUrl || pageUrl,
                brokerageName,
                startUrl,
                discoveryQuery
            );
            foundCandidates.push(...pageCandidates);

            if (foundCandidates.length === 0 || crawled.size < 3) {
                collectAgentProfileLinks(page.html, page.finalUrl || pageUrl, baseHost, 12).forEach(addPage);
            }
        }
    } catch (error) {
        console.warn(`[Brokerage Roster] Website roster lookup failed for ${website}: ${error.message}`);
    }

    return mergeLeadCandidatesByEmail(foundCandidates);
}

async function scrapeBrokerageRosterCandidatesFromMapsRow(row, discoveryQuery) {
    const website = getMapsRowValue(row, 'website', 'web_site', 'web site');
    if (!website) return [];

    const brokerageName = getMapsRowValue(row, 'title', 'name', 'business name', 'business_name') || website;
    const candidates = await scrapeBrokerageRosterCandidatesFromWebsite(website, brokerageName, discoveryQuery);
    if (candidates.length > 0) {
        console.log(`[Brokerage Roster] Found ${candidates.length} public agent email lead(s) on ${website} for ${brokerageName}.`);
    }
    return candidates;
}

function normalizeMapsCsvRow(row, discoveryQuery, extraEmails = [], options = {}) {
    const name = getMapsRowValue(row, 'title', 'name', 'business name', 'business_name');
    if (options.realtorContactsOnly && !isLikelyIndividualAgentLeadName(name)) {
        return [];
    }

    const emails = [
        ...parseEmailListFromCsvValue(getMapsRowValue(row, 'emails', 'email')),
        ...extraEmails
    ];

    const uniqueEmails = [...new Set(emails.filter(isUsefulLeadEmail))];

    return normalizeLeadCandidate({
        name,
        company: name,
        emails: uniqueEmails,
        phone: getMapsRowValue(row, 'phone', 'telephone'),
        website: getMapsRowValue(row, 'website', 'web_site', 'web site'),
        address: formatMapsAddress(getMapsRowValue(row, 'address', 'complete_address', 'complete address')),
        sourceUrl: getMapsRowValue(row, 'link', 'google maps link', 'source_url')
    }, discoveryQuery, getMapsRowValue(row, 'link'));
}

async function normalizeMapsCsvRowWithWebsiteEnrichment(row, discoveryQuery, options = {}) {
    const candidates = normalizeMapsCsvRow(row, discoveryQuery, [], options);
    if (candidates.length > 0) return candidates;

    const website = getMapsRowValue(row, 'website', 'web_site', 'web site');
    if (!website) return candidates;

    const websiteEmails = await findPublicEmailsOnWebsite(website);
    if (websiteEmails.length > 0) {
        const name = getMapsRowValue(row, 'title', 'name', 'business name', 'business_name') || website;
        console.log(`[Lead Enrichment] Found ${websiteEmails.length} public email(s) on ${website} for ${name}.`);
    }

    return normalizeMapsCsvRow(row, discoveryQuery, websiteEmails, options);
}

async function mapWithConcurrency(items, limit, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await mapper(items[index], index);
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

async function scrapeLeadCandidatesWithMapsSidecar(niche, count) {
    const baseUrl = (process.env.LEAD_SCRAPER_URL || '').replace(/\/+$/, '');
    if (!baseUrl) {
        throw new Error('LEAD_SCRAPER_URL is not configured.');
    }

    const depth = Math.min(Math.max(parseInt(process.env.LEAD_SCRAPER_DEPTH, 10) || 1, 1), 10);
    const maxTime = Math.min(Math.max(parseInt(process.env.LEAD_SCRAPER_MAX_TIME_SECONDS, 10) || 600, 180), 1800);
    const pollMs = Math.min(Math.max(parseInt(process.env.LEAD_SCRAPER_POLL_MS, 10) || 5000, 1000), 15000);
    const maxPolls = Math.ceil((maxTime * 1000) / pollMs) + 6;

    const createRes = await axios.post(`${baseUrl}/api/v1/jobs`, {
        name: `CRM Lead Search: ${niche}`,
        keywords: [niche],
        lang: 'en',
        zoom: 15,
        depth,
        email: true,
        max_time: maxTime
    }, { timeout: 15000 });

    const jobId = createRes.data && createRes.data.id;
    if (!jobId) throw new Error('Lead scraper did not return a job id.');

    let job = null;
    for (let attempt = 0; attempt < maxPolls; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollMs));
        const jobRes = await axios.get(`${baseUrl}/api/v1/jobs/${jobId}`, { timeout: 15000 });
        job = jobRes.data;

        const status = job.status || job.Status;
        if (status === 'ok') break;
        if (status === 'failed') {
            throw new Error(`Maps scraper job failed: ${job.error || job.Error || 'unknown error'}`);
        }
    }

    const finalStatus = job && (job.status || job.Status);
    if (finalStatus !== 'ok') {
        throw new Error('Maps scraper timed out before completing.');
    }

    const csvRes = await axios.get(`${baseUrl}/api/v1/jobs/${jobId}/download`, {
        timeout: 30000,
        responseType: 'text',
        transformResponse: [data => data]
    });

    const rows = parseCsvRows(csvRes.data);
    const rowsToEnrich = rows.slice(0, Math.min(rows.length, Math.max(count, 50)));
    const realtorQuery = isRealtorLeadQuery(niche);
    let candidates = [];

    if (realtorQuery) {
        const maxBrokerages = Math.min(Math.max(parseInt(process.env.LEAD_ROSTER_MAX_BROKERAGES, 10) || 8, 1), 25);
        const brokerageRows = rowsToEnrich
            .filter(row => getMapsRowValue(row, 'website', 'web_site', 'web site'))
            .slice(0, maxBrokerages);

        if (brokerageRows.length > 0) {
            const rosterCandidateGroups = await mapWithConcurrency(
                brokerageRows,
                2,
                row => scrapeBrokerageRosterCandidatesFromMapsRow(row, niche)
            );
            candidates = mergeLeadCandidatesByEmail(rosterCandidateGroups.flat());
        }
    }

    if (candidates.length < count) {
        const rowCandidates = await mapWithConcurrency(
            rowsToEnrich,
            4,
            row => normalizeMapsCsvRowWithWebsiteEnrichment(row, niche, { realtorContactsOnly: realtorQuery })
        );
        candidates = mergeLeadCandidatesByEmail(candidates, rowCandidates.flat());
    }

    return candidates.slice(0, count);
}

async function scrapeLeadCandidatesWithGemini(niche, count) {
    const prompt = `Search Google for businesses and decision-makers matching this exact target query: "${niche}".
Do not reinterpret the target as real estate unless the query itself asks for real estate agents, realtors, brokerages, or a related real estate niche.
Find up to ${count} real contacts. Prefer owner, founder, manager, principal, agent, partner, or office contact records that are publicly listed on the business website, directory profile, or professional page.

For each contact, extract:
1. Contact or business name
2. Company/organization name
3. Direct or public business email address (must be publicly listed. Do not fabricate!)
4. Direct or office phone number
5. Website, directory profile, or source page URL
6. Business address if publicly available

You MUST return a JSON object with this exact structure:
{
  "leads": [
    {
      "name": "Sarah Smith",
      "company": "Example Company",
      "email": "sarah.smith@example.com",
      "phone": "(305) 555-1234",
      "website": "https://www.example.com/sarah-smith",
      "address": "123 Main St, Miami, FL",
      "sourceUrl": "https://www.example.com/sarah-smith"
    }
  ]
}
Return ONLY valid JSON. No markdown blocks, no formatting.`;

    const rawResponse = await queryGeminiWithSearch(prompt, { json: true });
    const data = await parseModelJsonWithRepair(rawResponse);
    return (data.leads || []).flatMap(lead => normalizeLeadCandidate(lead, niche));
}

function isRealtorLeadQuery(query = '') {
    return /\b(realtor|realtors|real estate agent|real estate agents|broker|brokers|brokerage|realty)\b/i.test(String(query || ''));
}

function mergeLeadCandidatesByEmail(...candidateGroups) {
    const merged = [];
    const seenEmails = new Set();
    const seenIdentities = new Set();

    for (const candidate of candidateGroups.flat()) {
        const emailKey = String(candidate.email || '').trim().toLowerCase();
        const identityKey = getLeadIdentityKey(candidate);
        if (!emailKey || seenEmails.has(emailKey) || (identityKey && seenIdentities.has(identityKey))) continue;
        seenEmails.add(emailKey);
        if (identityKey) seenIdentities.add(identityKey);
        merged.push(candidate);
    }

    return merged;
}

async function scrapeRealtorDirectoryLeadCandidates(niche, count) {
    const domainList = REALTOR_DIRECTORY_DOMAINS.join(', ');
    const prompt = `Find up to ${count} real real-estate agent or brokerage contacts matching this target market: "${niche}".

Use public web search with emphasis on these real-estate directory domains as discovery signals: ${domainList}.
Do not bypass logins, CAPTCHAs, robots restrictions, paywalls, or private APIs.
Do not fabricate emails. Only include an email if it is publicly visible on an agent/brokerage website, an allowed public profile page, schema/metadata, or a clearly linked public contact page.
If a Zillow, Realtor.com, Redfin, or Homes.com profile does not expose a public email, use it only as a source/profile URL and look for the agent's own website or brokerage page where the email is publicly listed.
Skip generic lead forms without visible email addresses. Skip records that only have a phone number.

For each contact, extract:
1. Agent or brokerage contact name
2. Brokerage/company name
3. Direct or public business email address
4. Direct or office phone number if public
5. Agent website or brokerage website if public
6. Source URL where the agent/profile/contact evidence was found
7. City/state or address if public

You MUST return a JSON object with this exact structure:
{
  "leads": [
    {
      "name": "Sarah Smith",
      "company": "Example Realty",
      "email": "sarah.smith@example.com",
      "phone": "(305) 555-1234",
      "website": "https://www.example-realty.com/sarah-smith",
      "address": "Crystal Lake, IL",
      "sourceUrl": "https://www.example-realty.com/sarah-smith"
    }
  ]
}
Return ONLY valid JSON. No markdown blocks, no formatting.`;

    const rawResponse = await queryGeminiWithSearch(prompt, { json: true, model: GEMINI_RESEARCH_MODEL });
    const data = await parseModelJsonWithRepair(rawResponse);
    return (data.leads || []).flatMap(lead => normalizeLeadCandidate(lead, niche));
}

function normalizeDiscoveredBrokerageUrl(rawUrl, baseUrl = '') {
    const value = String(rawUrl || '').trim();
    if (!value) return '';

    try {
        if (/^https?:\/\//i.test(value)) return value;
        if (value.startsWith('/') && baseUrl) return new URL(value, baseUrl).href;
        if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:[/:?#]|$)/i.test(value)) {
            return normalizeWebsiteUrl(value);
        }
    } catch (error) {
        // Ignore malformed discovery results.
    }

    return '';
}

function normalizeBrokerageDiscoveryResult(item = {}) {
    const name = cleanLeadText(item.name || item.company || item.brokerage || item.title || '');
    const website = String(item.website || item.url || item.site || '').trim();
    const rosterUrl = String(item.rosterUrl || item.roster_url || item.agentsUrl || item.agents_url || item.teamUrl || item.team_url || '').trim();
    const sourceUrl = String(item.sourceUrl || item.source_url || rosterUrl || website || '').trim();

    if (!name && !website && !rosterUrl) return null;

    const normalizedWebsite = normalizeDiscoveredBrokerageUrl(website);
    const normalizedRosterUrl = normalizeDiscoveredBrokerageUrl(rosterUrl, normalizedWebsite);
    const normalizedSourceUrl = normalizeDiscoveredBrokerageUrl(sourceUrl, normalizedWebsite) || normalizedRosterUrl || normalizedWebsite;
    const crawlUrl = normalizedRosterUrl || normalizedWebsite;
    if (!crawlUrl) return null;

    const domain = normalizeDomain(crawlUrl);
    if (REALTOR_DIRECTORY_DOMAINS.some(blocked => domain === blocked || domain.endsWith(`.${blocked}`))) return null;

    return {
        name: name || domain,
        website: normalizedWebsite || crawlUrl,
        rosterUrl: normalizedRosterUrl,
        sourceUrl: normalizedSourceUrl || crawlUrl
    };
}

async function discoverBrokerageRosterTargetsWithSearch(niche, count) {
    const targetCount = Math.min(Math.max(count * 3, 8), 30);
    const prompt = `Find up to ${targetCount} brokerage websites for this real estate market: "${niche}".

Prioritize local brokerage, office, and franchise office websites that publish agent rosters, team pages, staff pages, "find an agent" pages, or individual agent profile pages.
This is discovery only. Do not return agent contact records here.
Do not use Zillow, Realtor.com, Redfin, Homes.com, lead forms, login-only pages, private APIs, or pages that require CAPTCHA.
Prefer URLs on the brokerage's own site or franchise office site, such as /agents, /agent-search, /team, /associates, /our-agents, /find-an-agent, /getagent/list.php.

Return ONLY valid JSON with this exact shape:
{
  "brokerages": [
    {
      "name": "Example Realty",
      "website": "https://www.example-realty.com",
      "rosterUrl": "https://www.example-realty.com/agents",
      "sourceUrl": "https://www.example-realty.com/agents"
    }
  ]
}`;

    const rawResponse = await queryGeminiWithSearch(prompt, { json: true, model: GEMINI_RESEARCH_MODEL });
    const data = await parseModelJsonWithRepair(rawResponse);
    const rawBrokerages = Array.isArray(data.brokerages) ? data.brokerages : [];
    const seen = new Set();
    const brokerages = [];

    for (const item of rawBrokerages) {
        const brokerage = normalizeBrokerageDiscoveryResult(item);
        if (!brokerage) continue;
        const key = `${normalizeDomain(brokerage.rosterUrl || brokerage.website)}|${brokerage.rosterUrl || brokerage.website}`;
        if (seen.has(key)) continue;
        seen.add(key);
        brokerages.push(brokerage);
    }

    return brokerages;
}

async function scrapeRealtorBrokerageSearchLeadCandidates(niche, count) {
    const maxBrokerages = Math.min(Math.max(parseInt(process.env.LEAD_BROKERAGE_SEARCH_MAX_BROKERAGES, 10) || 12, 1), 40);
    const brokerages = (await discoverBrokerageRosterTargetsWithSearch(niche, count)).slice(0, maxBrokerages);
    if (brokerages.length === 0) return { brokerages, candidates: [] };

    const candidateGroups = await mapWithConcurrency(
        brokerages,
        2,
        brokerage => scrapeBrokerageRosterCandidatesFromWebsite(
            brokerage.website || brokerage.rosterUrl,
            brokerage.name,
            niche,
            [brokerage.rosterUrl, brokerage.sourceUrl].filter(Boolean)
        )
    );

    return {
        brokerages,
        candidates: mergeLeadCandidatesByEmail(candidateGroups.flat()).slice(0, count)
    };
}

function insertLeadCandidates(candidates, discoveryQuery, options = {}) {
    const insertedLeads = [];
    const skipped = { dnc: 0, duplicate: 0, invalid: 0 };
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || candidates.length || 0, 0), 1000);
    const seenIdentityKeys = new Set();

    for (const lead of candidates) {
        if (limit && insertedLeads.length >= limit) break;

        if (!lead.name || !isUsefulLeadEmail(lead.email)) {
            skipped.invalid++;
            continue;
        }

        if (options.realtorContactsOnly) {
            if (!isLikelyIndividualAgentLeadName(lead.name) || isDisallowedLeadSourceUrl(lead.sourceUrl || lead.website)) {
                skipped.invalid++;
                continue;
            }
        }

        const identityKey = getLeadIdentityKey(lead);
        if (identityKey && seenIdentityKeys.has(identityKey)) {
            skipped.duplicate++;
            continue;
        }

        if (db.isEmailDnc(lead.email)) {
            skipped.dnc++;
            console.log(`[Scraper] Skipping DNC email: ${lead.email}`);
            continue;
        }

        if (db.getLeadByEmail(lead.email)) {
            skipped.duplicate++;
            console.log(`[Scraper] Skipping duplicate lead email: ${lead.email}`);
            continue;
        }

        if (identityKey) {
            const possibleExistingMatches = db.getLeads({ search: lead.name, limit: 50 });
            if (possibleExistingMatches.some(existing => leadIdentityMatches(existing, lead))) {
                skipped.duplicate++;
                console.log(`[Scraper] Skipping duplicate lead identity: ${lead.name}`);
                continue;
            }
        }

        const leadRecord = {
            name: lead.name,
            company: lead.company || lead.name || 'Independent',
            email: lead.email,
            phone: lead.phone || '',
            website: lead.website || '',
            address: lead.address || '',
            sourceUrl: lead.sourceUrl || lead.website || '',
            discoveryQuery,
            stage: 'Scraped',
            history: []
        };

        const leadId = db.insertLead(leadRecord);

        if (leadId) {
            if (identityKey) seenIdentityKeys.add(identityKey);
            insertedLeads.push({
                id: leadId,
                ...leadRecord
            });
        }
    }

    return { insertedLeads, skipped };
}

function formatErrorMessage(error, fallback = 'unknown error') {
    return error && (error.message || error.code || String(error)) || fallback;
}

async function withTimeout(promise, timeoutMs, label) {
    let timeoutId;
    const timeoutPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds`));
        }, timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timeoutId);
        Promise.resolve(promise).catch(() => {});
    }
}

async function runLeadScrape(niche, count, onProgress = () => {}) {
    console.log(`[Scraper] Looking for up to ${count} public contacts for: "${niche}"...`);

    let candidates = [];
    let source = 'maps-sidecar';
    const errors = [];
    const realtorQuery = isRealtorLeadQuery(niche);

    if (realtorQuery) {
        try {
            source = 'brokerage-rosters';
            const timeoutMs = Math.min(Math.max(parseInt(process.env.LEAD_BROKERAGE_SEARCH_TIMEOUT_MS, 10) || 120000, 30000), 300000);
            onProgress('brokerage-discovery', 'Finding brokerage websites and public agent roster pages...');
            const brokerageResult = await withTimeout(
                scrapeRealtorBrokerageSearchLeadCandidates(niche, count),
                timeoutMs,
                'Brokerage roster discovery'
            );
            candidates = mergeLeadCandidatesByEmail(candidates, brokerageResult.candidates).slice(0, count);
            onProgress('brokerage-rosters', `Checked ${brokerageResult.brokerages.length} brokerage roster target(s); found ${candidates.length} candidate lead(s).`);
        } catch (error) {
            const message = formatErrorMessage(error);
            errors.push(`brokerage-rosters: ${message}`);
            console.error(`[Brokerage Roster Search Error] ${message}`);
        }
    }

    if ((!realtorQuery || candidates.length < count) && process.env.LEAD_MAPS_FALLBACK !== 'false') {
        try {
            const previousCount = candidates.length;
            onProgress('maps-sidecar', realtorQuery
                ? 'Brokerage roster discovery did not fill the request; checking Maps-discovered brokerage sites...'
                : 'Searching Google Maps and enriching public website emails...');
            const mapsCandidates = await scrapeLeadCandidatesWithMapsSidecar(niche, count);
            candidates = mergeLeadCandidatesByEmail(candidates, mapsCandidates).slice(0, count);
            if (candidates.length > previousCount) {
                source = previousCount > 0 ? `${source}+maps-sidecar` : 'maps-sidecar';
            }
        } catch (error) {
            const message = formatErrorMessage(error);
            errors.push(`maps-sidecar: ${message}`);
            console.warn(`[Maps Scraper Error] ${message}`);
        }
    }

    if (realtorQuery && candidates.length < count && process.env.LEAD_REALTOR_DIRECTORY_FALLBACK !== 'false') {
        try {
            const remaining = Math.max(count - candidates.length, 1);
            onProgress('real-estate-directories', `Searching public realtor directory/profile signals for ${remaining} more verified email lead(s)...`);
            const timeoutMs = Math.min(Math.max(parseInt(process.env.LEAD_REALTOR_DIRECTORY_TIMEOUT_MS, 10) || 45000, 10000), 120000);
            const directoryCandidates = await withTimeout(
                scrapeRealtorDirectoryLeadCandidates(niche, Math.min(Math.max(remaining * 2, 10), count)),
                timeoutMs,
                'Realtor directory fallback'
            );
            const previousCount = candidates.length;
            candidates = mergeLeadCandidatesByEmail(candidates, directoryCandidates).slice(0, count);
            if (candidates.length > previousCount) {
                source = previousCount > 0 ? 'maps-sidecar+realtor-directories' : 'realtor-directories';
            }
        } catch (error) {
            const message = formatErrorMessage(error);
            errors.push(`real-estate-directories: ${message}`);
            console.error(`[Realtor Directory Search Error] ${message}`);
        }
    }

    if (candidates.length === 0 && (!realtorQuery || process.env.LEAD_GENERIC_GEMINI_FALLBACK_FOR_REALTORS === 'true')) {
        try {
            source = 'gemini-search';
            onProgress('gemini-search', 'Maps did not return usable name + email leads; trying Gemini grounded search...');
            candidates = await scrapeLeadCandidatesWithGemini(niche, count);
        } catch (error) {
            const message = formatErrorMessage(error);
            errors.push(`gemini-search: ${message}`);
            console.error(`[Gemini Lead Search Error] ${message}`);
        }
    }

    if (candidates.length === 0) {
        const realtorMessage = 'No public individual agent emails were found on brokerage rosters or allowed profile/contact pages.';
        return {
            leads: [],
            skipped: { dnc: 0, duplicate: 0, invalid: 0 },
            source,
            candidateCount: 0,
            warnings: realtorQuery ? [realtorMessage, ...errors] : errors
        };
    }

    onProgress('inserting', `Found ${candidates.length} candidate(s). Inserting new valid leads...`);
    const { insertedLeads, skipped } = insertLeadCandidates(candidates, niche, {
        limit: count,
        realtorContactsOnly: realtorQuery
    });

    return {
        leads: insertedLeads,
        skipped,
        source,
        candidateCount: candidates.length,
        warnings: errors
    };
}

const LEAD_INTELLIGENCE_SEED_CITIES = [
    { city: 'Birmingham', state: 'AL', metro: 'Birmingham-Hoover', incomeBand: 'mid', priority: 95 },
    { city: 'Huntsville', state: 'AL', metro: 'Huntsville', incomeBand: 'mid', priority: 92 },
    { city: 'Knoxville', state: 'TN', metro: 'Knoxville', incomeBand: 'mid', priority: 90 },
    { city: 'Chattanooga', state: 'TN', metro: 'Chattanooga', incomeBand: 'mid', priority: 88 },
    { city: 'Greenville', state: 'SC', metro: 'Greenville-Anderson', incomeBand: 'mid', priority: 88 },
    { city: 'Columbia', state: 'SC', metro: 'Columbia', incomeBand: 'mid', priority: 86 },
    { city: 'Augusta', state: 'GA', metro: 'Augusta-Richmond County', incomeBand: 'mid', priority: 84 },
    { city: 'Macon', state: 'GA', metro: 'Macon-Bibb County', incomeBand: 'mid', priority: 82 },
    { city: 'Pensacola', state: 'FL', metro: 'Pensacola-Ferry Pass-Brent', incomeBand: 'mid', priority: 82 },
    { city: 'Lakeland', state: 'FL', metro: 'Lakeland-Winter Haven', incomeBand: 'mid', priority: 80 },
    { city: 'Ocala', state: 'FL', metro: 'Ocala', incomeBand: 'mid', priority: 79 },
    { city: 'Fort Wayne', state: 'IN', metro: 'Fort Wayne', incomeBand: 'mid', priority: 78 },
    { city: 'Toledo', state: 'OH', metro: 'Toledo', incomeBand: 'mid', priority: 76 },
    { city: 'Dayton', state: 'OH', metro: 'Dayton-Kettering', incomeBand: 'mid', priority: 76 },
    { city: 'Wichita', state: 'KS', metro: 'Wichita', incomeBand: 'mid', priority: 75 },
    { city: 'Tulsa', state: 'OK', metro: 'Tulsa', incomeBand: 'mid', priority: 75 },
    { city: 'Omaha', state: 'NE', metro: 'Omaha-Council Bluffs', incomeBand: 'mid', priority: 73 },
    { city: 'Des Moines', state: 'IA', metro: 'Des Moines-West Des Moines', incomeBand: 'mid', priority: 72 },
    { city: 'Lexington', state: 'KY', metro: 'Lexington-Fayette', incomeBand: 'mid', priority: 71 },
    { city: 'Louisville', state: 'KY', metro: 'Louisville/Jefferson County', incomeBand: 'mid', priority: 70 }
];

const LEAD_INTELLIGENCE_BROKERAGE_BRAND_SEEDS = [
    { name: 'Keller Williams', category: 'franchise office' },
    { name: 'RE/MAX', category: 'franchise office' },
    { name: 'Coldwell Banker', category: 'franchise office' },
    { name: 'Realty ONE Group', category: 'franchise office' },
    { name: 'EXIT Realty', category: 'franchise office' },
    { name: 'Better Homes and Gardens Real Estate', category: 'franchise office' },
    { name: 'Century 21', category: 'franchise office' },
    { name: 'Berkshire Hathaway HomeServices', category: 'franchise office' },
    { name: 'eXp Realty', category: 'cloud brokerage' },
    { name: 'Real Broker', category: 'cloud brokerage' },
    { name: 'United Real Estate', category: '100 percent commission' },
    { name: 'HomeSmart', category: '100 percent commission' },
    { name: 'Fathom Realty', category: 'cloud brokerage' },
    { name: 'Realty Executives', category: 'franchise office' }
];

const LEAD_INTELLIGENCE_SUPPRESSIBLE_BRANDS = new Set(
    LEAD_INTELLIGENCE_BROKERAGE_BRAND_SEEDS.map(brand => brand.name.toLowerCase())
);

function slugifyBrokeragePathPart(value = '') {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function getDeterministicRosterUrlForOffice(office = {}) {
    const brokerageName = String(office.brokerageName || '').trim().toLowerCase();
    const city = slugifyBrokeragePathPart(office.city);
    const state = slugifyBrokeragePathPart(office.state);
    if (!city || !state) return null;

    if (brokerageName === 'coldwell banker') {
        const rosterUrl = `https://www.coldwellbanker.com/city/${state}/${city}/agents`;
        return {
            website: 'https://www.coldwellbanker.com',
            rosterUrl,
            sourceUrl: rosterUrl
        };
    }

    return null;
}

function shouldSuppressBrokerageBrandAfterResult(office, status, harvest) {
    if (!LEAD_INTELLIGENCE_SUPPRESS_BRAND_AFTER_FAILURE) return false;
    if (!office || !office.brokerageName) return false;
    if (!LEAD_INTELLIGENCE_SUPPRESSIBLE_BRANDS.has(String(office.brokerageName).toLowerCase())) return false;
    if (status === 'Blocked') return true;
    if (status !== 'Failed') return false;
    return /invalid response format|could not discover|roster url|not found|forbidden|blocked|captcha|cloudflare|security verification/i.test(String(harvest && harvest.warning || ''));
}

function shouldMarkBrokerageDoNotScrapeAfterResult(office, status, harvest) {
    if (!office || !office.brokerageName) return false;
    if (status === 'Blocked' || status === 'No Contacts') return true;
    if (status !== 'Failed') return false;
    const warning = String(harvest && harvest.warning || '');
    if (!warning) return true;
    return /timeout|invalid response format|could not discover|roster url|not found|forbidden|blocked|captcha|cloudflare|security verification|certificate|name_not_resolved/i.test(warning);
}

function seedLeadIntelligenceDefaults() {
    const cityChanges = db.seedMarketCities(LEAD_INTELLIGENCE_SEED_CITIES);
    let officeChanges = 0;

    for (const city of LEAD_INTELLIGENCE_SEED_CITIES) {
        for (const brand of LEAD_INTELLIGENCE_BROKERAGE_BRAND_SEEDS) {
            const office = db.upsertBrokerageOffice({
                brokerageName: brand.name,
                category: brand.category,
                city: city.city,
                state: city.state,
                searchQuery: `${brand.name} ${city.city} ${city.state} agents`,
                status: 'Pending'
            });
            if (office) officeChanges++;
        }
    }

    return cityChanges + officeChanges;
}

function normalizeSocialLinks(links = []) {
    const socials = {};
    for (const href of links) {
        const url = String(href || '').trim();
        const platform = socialPlatformFromUrl(url);
        if (platform && !socials[platform]) socials[platform] = url;
    }
    return socials;
}

async function discoverBrokerageOfficeTargetsForCity(cityRecord) {
    const prompt = `Find 8 to 15 real estate brokerages or brokerage offices to prospect in ${cityRecord.city}, ${cityRecord.state}.

Prioritize smaller local/regional brokerages, 100% commission brokerages, flat-fee brokerages, independent realty groups, and franchise offices that may not provide a deep agent tech stack.
Include a few major franchise offices only when they have a public office roster page.
For each brokerage, find the official brokerage/office website and a public roster/team/agent page if visible.
Do not use Zillow, Realtor.com, Redfin, Homes.com, private APIs, login pages, CAPTCHA pages, or generic lead forms.

Return ONLY valid JSON:
{
  "brokerages": [
    {
      "name": "Example Realty",
      "category": "local independent | regional | 100 percent commission | franchise office | flat fee",
      "website": "https://www.example.com",
      "rosterUrl": "https://www.example.com/agents",
      "sourceUrl": "https://www.example.com/agents",
      "reason": "why this brokerage looks relevant"
    }
  ]
}`;

    const raw = await queryLeadIntelligenceResearch(prompt, { json: true });
    const data = await parseModelJsonWithRepair(raw, { allowGeminiFallback: false });
    const brokerages = Array.isArray(data.brokerages) ? data.brokerages : [];
    const seen = new Set();

    return brokerages.flatMap(item => {
        const normalized = normalizeBrokerageDiscoveryResult(item);
        if (!normalized || !normalized.name) return [];
        const key = `${normalized.name.toLowerCase()}|${cityRecord.city.toLowerCase()}|${cityRecord.state.toLowerCase()}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [{
            brokerageName: normalized.name,
            category: cleanLeadText(item.category || ''),
            city: cityRecord.city,
            state: cityRecord.state,
            searchQuery: `${normalized.name} ${cityRecord.city} ${cityRecord.state}`,
            website: normalized.website,
            rosterUrl: normalized.rosterUrl,
            sourceUrl: normalized.sourceUrl,
            status: normalized.rosterUrl ? 'Discovered' : 'Pending'
        }];
    });
}

async function discoverSpecificBrokerageOfficeUrl(office) {
    if (office.website || office.rosterUrl) return office;

    const deterministic = getDeterministicRosterUrlForOffice(office);
    if (deterministic) {
        return {
            ...office,
            ...deterministic
        };
    }

    const query = office.searchQuery || `${office.brokerageName} ${office.city} ${office.state}`;
    const prompt = `Find the official public website and agent roster page for this brokerage office search: "${query}".

This should work like a human Google search: search the brokerage name plus city, open the official office site, then identify the "Our Agents", "Agents", "Team", "Associates", or "Find an Agent" page.
Avoid Zillow, Realtor.com, Redfin, Homes.com, login pages, CAPTCHA pages, and generic directory profiles.

Return ONLY valid JSON:
{
  "name": "${office.brokerageName}",
  "website": "https://official-office-site.example",
  "rosterUrl": "https://official-office-site.example/our-agents",
  "sourceUrl": "https://official-office-site.example/our-agents"
}`;

    const raw = await queryLeadIntelligenceResearch(prompt, { json: true });
    const data = await parseModelJsonWithRepair(raw);
    const normalized = normalizeBrokerageDiscoveryResult({
        name: data.name || office.brokerageName,
        website: data.website,
        rosterUrl: data.rosterUrl,
        sourceUrl: data.sourceUrl
    });

    if (!normalized) return office;
    return {
        ...office,
        website: normalized.website,
        rosterUrl: normalized.rosterUrl,
        sourceUrl: normalized.sourceUrl
    };
}

function hasCurrentBrokerageTechResearch(profile = {}) {
    const techStack = profile.techStack && typeof profile.techStack === 'object' ? profile.techStack : {};
    return profile.researchStatus === 'Complete' && techStack.researchVersion === 'brokerage-agent-chatter-v2';
}

async function researchBrokerageTechStack(profile) {
    if (!profile || !profile.name) return profile;
    if (hasCurrentBrokerageTechResearch(profile)) return profile;

    const prompt = `Research what the real estate brokerage "${profile.name}" appears to provide to agents.

Act like a brokerage recruiting/competitive-intelligence researcher. Use public web search and deliberately look for both official brokerage pages and agent conversations.

Search patterns to try:
- "${profile.name} agent technology CRM"
- "${profile.name} tools for agents"
- "${profile.name} Moxi kvCORE BoldTrail SkySlope Dotloop"
- "site:reddit.com/r/realtors ${profile.name}"
- "site:reddit.com/r/RealEstate ${profile.name} agents"
- "${profile.name} agent reviews technology support"

Find public evidence for:
- CRM or lead management tools included for agents
- E-signature/document signing included for agents
- Lead pages, IDX pages, landing pages, or lead-generation tools
- Video email/video marketing tools
- Websites, CMA/presentation tools, marketing automation, ad automation, listing marketing, transaction portals, training/support tools
- Reddit or forum conversations where agents discuss what the brokerage gives them, what they like, and what they complain about
- Known platforms such as BoldTrail, kvCORE, Follow Up Boss, Lofty, Chime, Sierra Interactive, BoomTown, DocuSign, Dotloop, SkySlope, TransactionDesk
- For Coldwell Banker specifically, check for CB Desk, MoxiEngage, MoxiWebsites, MoxiPresent, MoxiImpress, CBx, Prospect Square, Boost/HomeSpotter, Listing Concierge, HomeBase, SkySlope, and Dotloop.

Distinguish official claims from agent chatter. For franchises, mention that tools can vary by office or region when sources indicate variation.

Do not invent facts. Use "unknown" when not found.
Do not quote long passages from Reddit. Summarize agent sentiment briefly.

Return ONLY valid JSON:
{
  "name": "${profile.name}",
  "category": "local independent | regional | franchise | 100 percent commission | flat fee | unknown",
  "website": "https://example.com",
  "nationalWebsite": "https://example.com",
  "crmOffering": "unknown or description",
  "esignOffering": "unknown or description",
  "leadTools": "unknown or description",
  "videoEmail": "unknown or description",
  "techStack": {
    "crm": "unknown",
    "esign": "unknown",
    "leadPages": "unknown",
    "videoEmail": "unknown",
    "websites": "unknown",
    "cmaPresentations": "unknown",
    "marketingAutomation": "unknown",
    "transactionManagement": "unknown",
    "knownTools": [],
    "officialSummary": "brief source-backed summary",
    "agentDiscussionSummary": "brief summary of Reddit/forum/agent-review chatter or unknown",
    "strengthsAgainstUs": ["specific strengths the brokerage can claim"],
    "gapsWeCanFill": ["specific gaps our CRM/outreach/value offer can fill"],
    "campaignAngles": ["specific email angles for agents at this brokerage"],
    "sourceEvidence": [
      {
        "sourceType": "official | reddit | forum | review | unknown",
        "title": "source title",
        "url": "https://source.example/path",
        "summary": "what this source supports"
      }
    ]
  },
  "notes": "brief sales angle based on missing or known tools"
}`;

    try {
        const raw = await queryLeadIntelligenceResearch(prompt, { json: true });
        const data = await parseModelJsonWithRepair(raw, { allowGeminiFallback: false });
        const techStack = {
            ...(data.techStack || {}),
            researchVersion: 'brokerage-agent-chatter-v2',
            researchedWith: 'official-web-plus-agent-discussion-search'
        };
        return db.upsertBrokerageProfile({
            name: profile.name,
            category: data.category,
            website: data.website || profile.website,
            nationalWebsite: data.nationalWebsite,
            crmOffering: data.crmOffering || 'unknown',
            esignOffering: data.esignOffering || 'unknown',
            leadTools: data.leadTools || 'unknown',
            videoEmail: data.videoEmail || 'unknown',
            techStack,
            notes: data.notes || [
                ...(Array.isArray(techStack.gapsWeCanFill) ? techStack.gapsWeCanFill.slice(0, 2) : []),
                ...(Array.isArray(techStack.campaignAngles) ? techStack.campaignAngles.slice(0, 2) : [])
            ].join(' '),
            researchStatus: 'Complete',
            researchedAt: new Date().toISOString()
        });
    } catch (error) {
        console.warn(`[Lead Intelligence] Brokerage tech research failed for ${profile.name}: ${error.message}`);
        db.upsertBrokerageProfile({
            name: profile.name,
            researchStatus: 'Needs Research',
            notes: `Research failed: ${error.message}`
        });
        return profile;
    }
}

async function refreshStaleBrokerageResearchProfiles(runId = null) {
    if (!LEAD_INTELLIGENCE_RESEARCH_TECH_STACK || LEAD_INTELLIGENCE_MAX_PROFILE_RESEARCH_PER_CYCLE <= 0) {
        return { researched: 0, skipped: true };
    }

    const researched = [];
    const attemptedIds = new Set();
    for (let index = 0; index < LEAD_INTELLIGENCE_MAX_PROFILE_RESEARCH_PER_CYCLE; index++) {
        const profile = db.getNextBrokerageProfileForResearch();
        if (!profile || !profile.id || attemptedIds.has(profile.id)) break;
        attemptedIds.add(profile.id);

        const message = `Refreshing brokerage systems research for ${profile.name} (${index + 1}/${LEAD_INTELLIGENCE_MAX_PROFILE_RESEARCH_PER_CYCLE})`;
        if (runId) db.updateIntelligenceRun(runId, { message });
        appendActivityLog('agent-sales', message, {
            workflow: 'lead-intelligence',
            runId,
            phase: 'brokerage-systems-refresh',
            brokerage: profile.name,
            researchStatus: profile.researchStatus || ''
        });

        const updated = await researchBrokerageTechStack(profile);
        const current = updated && hasCurrentBrokerageTechResearch(updated);
        researched.push({
            brokerage: profile.name,
            status: current ? 'Complete' : 'Needs Research'
        });
        appendActivityLog(current ? 'agent-sales' : 'system-line', `${profile.name} systems research ${current ? 'updated with agent chatter/search evidence' : 'still needs research'}.`, {
            workflow: 'lead-intelligence',
            runId,
            phase: 'brokerage-systems-refresh-result',
            brokerage: profile.name,
            status: current ? 'Complete' : 'Needs Research'
        });
    }

    return {
        researched: researched.length,
        profiles: researched
    };
}

function loadPlaywrightChromium() {
    try {
        return require('playwright-core').chromium;
    } catch (error) {
        throw new Error('playwright-core is not installed. Browser roster harvesting needs the Playwright runtime.');
    }
}

async function extractRosterContactsFromBrowserPage(page, brokerageName, office) {
    const pageUrl = page.url();
    const rawContacts = await page.evaluate(() => {
        const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
        const phoneRegex = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?:\s*(?:x|ext\.?)\s*\d+)?/i;
        const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
        const socialPattern = /(facebook|instagram|linkedin|youtube|twitter|x\.com|tiktok)\.com/i;

        function scopeFor(el) {
            let scope = el;
            let best = null;
            let bestScore = -1;
            for (let i = 0; i < 14 && scope && scope !== document.body; i++) {
                const text = clean(scope.innerText || scope.textContent || '');
                if (text.includes('@') && text.length >= 20 && text.length <= 2500) return scope;

                let score = 0;
                if (text.length >= 25 && text.length <= 1500) score += 1;
                if (text.length >= 25 && text.length <= 350) score += 2;
                if (/\b(realtor|broker|agent|licensed|owner|associate|assistant|manager)\b/i.test(text)) score += 4;
                if (scope.matches('article,li,section,[class*="card" i],[class*="agent" i],[class*="team" i],[class*="column" i]')) score += 2;
                if (scope.querySelector('h1,h2,h3,h4,[class*="heading" i],[class*="name" i]')) score += 2;
                if (/^(website\s+)?email$/i.test(text)) score -= 5;
                if (score > bestScore) {
                    best = scope;
                    bestScore = score;
                }

                scope = scope.parentElement;
            }
            return best || el.closest('article,li,section,div') || document.body;
        }

        function nameFromScope(scope, email) {
            const selectors = [
                '[itemprop="name"]',
                '[class*="agent-name" i]',
                '[class*="associate-name" i]',
                '[class*="member-name" i]',
                '[class*="heading" i]',
                '[class*="name" i]',
                'h1', 'h2', 'h3', 'h4', 'strong'
            ];
            for (const selector of selectors) {
                for (const node of scope.querySelectorAll(selector)) {
                    const text = clean(node.innerText || node.textContent || '');
                    if (text && !text.includes('@') && text.length >= 3 && text.length <= 90) return text;
                }
            }
            const lines = clean(scope.innerText || scope.textContent || '')
                .split(/(?:(?:\s{2,})|(?:\s-\s)|(?:\s\|\s)|(?:\n))/)
                .map(clean)
                .filter(Boolean);
            return lines.find(line => line !== email && !line.includes('@') && line.length >= 3 && line.length <= 90) || '';
        }

        const contacts = [];
        const seenEmails = new Set();
        const emailElements = [
            ...document.querySelectorAll('a[href^="mailto:"], [data-email], [data-contact-email]')
        ];

        for (const el of emailElements) {
            const values = [
                el.getAttribute('href') || '',
                el.getAttribute('data-email') || '',
                el.getAttribute('data-contact-email') || '',
                el.getAttribute('aria-label') || '',
                el.getAttribute('title') || '',
                el.innerText || '',
                el.textContent || ''
            ].join(' ');
            const emails = values.match(emailRegex) || [];
            for (const email of emails) {
                const normalizedEmail = email.toLowerCase();
                if (seenEmails.has(normalizedEmail)) continue;
                seenEmails.add(normalizedEmail);
                const scope = scopeFor(el);
                const text = clean(scope.innerText || scope.textContent || '');
                contacts.push({
                    name: nameFromScope(scope, normalizedEmail),
                    email: normalizedEmail,
                    phone: (text.match(phoneRegex) || [''])[0],
                    sourceUrl: location.href,
                    socials: [...scope.querySelectorAll('a[href]')]
                        .map(anchor => anchor.href)
                        .filter(href => socialPattern.test(href))
                });
            }
        }

        if (contacts.length === 0) {
            const cards = [...document.querySelectorAll('article, li, section, .card, [class*="agent" i], [class*="team" i]')];
            for (const card of cards) {
                const text = clean(card.innerText || card.textContent || '');
                const emails = text.match(emailRegex) || [];
                for (const email of emails) {
                    const normalizedEmail = email.toLowerCase();
                    if (seenEmails.has(normalizedEmail)) continue;
                    seenEmails.add(normalizedEmail);
                    contacts.push({
                        name: nameFromScope(card, normalizedEmail),
                        email: normalizedEmail,
                        phone: (text.match(phoneRegex) || [''])[0],
                        sourceUrl: location.href,
                        socials: [...card.querySelectorAll('a[href]')]
                            .map(anchor => anchor.href)
                            .filter(href => socialPattern.test(href))
                    });
                }
            }
        }

        return contacts;
    });

    return rawContacts.flatMap(contact => normalizeLeadCandidate({
        name: contact.name,
        company: brokerageName,
        email: contact.email,
        phone: contact.phone,
        website: office.website || pageUrl,
        sourceUrl: contact.sourceUrl || pageUrl
    }, `${brokerageName} ${office.city} ${office.state}`, pageUrl).map(candidate => ({
        ...candidate,
        socials: normalizeSocialLinks(contact.socials || [])
    }))).filter(candidate => isUsefulLeadEmail(candidate.email) && isLikelyIndividualAgentLeadName(candidate.name));
}

async function findNextRosterPage(page) {
    return page.evaluate(() => {
        const candidates = [...document.querySelectorAll('a[href]')].map(anchor => {
            const text = String(anchor.innerText || anchor.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            const label = String(anchor.getAttribute('aria-label') || anchor.getAttribute('title') || '').toLowerCase();
            const rel = String(anchor.getAttribute('rel') || '').toLowerCase();
            const combined = `${text} ${label} ${rel}`;
            let score = 0;
            if (/\bnext\b/.test(combined)) score += 10;
            if (combined.includes('›') || combined.includes('»') || combined.includes('>')) score += 6;
            if (rel.includes('next')) score += 12;
            if (!score) return null;
            return { href: anchor.href, score };
        }).filter(Boolean);
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0] || null;
    });
}

function isRosterChallengeText(text = '') {
    return /\b(just a moment|security verification|performing security verification|verify you are not a bot|not a robot|malicious bots|checking your browser|please verify you are human|burrow services|cloudflare|captcha|recaptcha|access denied|request forbidden)\b/i.test(String(text || ''));
}

function isBlockedRosterError(message = '') {
    return /\b(forbidden|too many requests|blocked|403|429)\b/i.test(String(message || '')) || isRosterChallengeText(message);
}

async function harvestRosterWithBrowser(office) {
    const chromium = loadPlaywrightChromium();
    const executablePath = process.env.BROWSER_CHROMIUM_PATH || process.env.CHROMIUM_PATH || '/usr/bin/chromium';
    const browser = await chromium.launch({
        headless: true,
        executablePath,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
    });

    const contacts = [];
    const visited = new Set();
    let pagesScanned = 0;

    try {
        const context = await browser.newContext({
            userAgent: SCRAPER_HEADERS['User-Agent'],
            viewport: { width: 1365, height: 900 }
        });
        const page = await context.newPage();
        page.setDefaultTimeout(ROSTER_BROWSER_TIMEOUT_MS);

        let currentUrl = office.rosterUrl || office.website;
        if (!currentUrl) throw new Error('No office website or roster URL available.');

        while (currentUrl && pagesScanned < ROSTER_BROWSER_MAX_PAGES && contacts.length < ROSTER_BROWSER_MAX_CONTACTS) {
            const normalizedCurrent = currentUrl.replace(/\/+$/, '');
            if (visited.has(normalizedCurrent)) break;
            visited.add(normalizedCurrent);

            await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: ROSTER_BROWSER_TIMEOUT_MS });
            await page.waitForTimeout(1500);

            const challengeText = await page.evaluate(() => `${document.title || ''}\n${document.body?.innerText || ''}`.slice(0, 1200));
            if (isRosterChallengeText(challengeText)) {
                throw new Error('Blocked by browser security verification / Cloudflare challenge.');
            }

            const pageContacts = await extractRosterContactsFromBrowserPage(page, office.brokerageName, office);
            contacts.push(...pageContacts);
            pagesScanned++;

            if (contacts.length >= ROSTER_BROWSER_MAX_CONTACTS) break;
            const next = await findNextRosterPage(page);
            if (!next || !next.href || visited.has(next.href.replace(/\/+$/, ''))) break;
            if (normalizeDomain(next.href) !== normalizeDomain(page.url())) break;
            currentUrl = next.href;
            await page.waitForTimeout(800);
        }
    } finally {
        await browser.close();
    }

    return {
        contacts: mergeLeadCandidatesByEmail(contacts).slice(0, ROSTER_BROWSER_MAX_CONTACTS),
        pagesScanned
    };
}

async function harvestBrokerageOfficeRoster(office) {
    let discoveredOffice = office;
    let discoveryWarning = '';
    try {
        discoveredOffice = await discoverSpecificBrokerageOfficeUrl(office);
    } catch (discoveryError) {
        discoveryWarning = formatErrorMessage(discoveryError, 'Could not discover brokerage roster URL.');
        console.warn(`[Lead Intelligence] Roster URL discovery failed for ${office.brokerageName}: ${discoveryWarning}`);
        return {
            contacts: [],
            pagesScanned: 0,
            warning: discoveryWarning,
            blocked: false
        };
    }

    if (discoveredOffice.website || discoveredOffice.rosterUrl) {
        db.updateBrokerageOffice(office.id, {
            website: discoveredOffice.website || office.website || '',
            rosterUrl: discoveredOffice.rosterUrl || office.rosterUrl || '',
            sourceUrl: discoveredOffice.sourceUrl || office.sourceUrl || '',
            status: 'Discovered'
        });
    }

    const harvestOffice = {
        ...office,
        ...discoveredOffice
    };

    try {
        const staticCandidates = await scrapeBrokerageRosterCandidatesFromWebsite(
            harvestOffice.website,
            harvestOffice.brokerageName,
            `${harvestOffice.brokerageName} ${harvestOffice.city} ${harvestOffice.state}`,
            [harvestOffice.rosterUrl, harvestOffice.sourceUrl].filter(Boolean)
        );
        if (staticCandidates.length > 0) {
            return {
                contacts: staticCandidates,
                pagesScanned: 0,
                warning: '',
                blocked: false,
                method: 'static-html'
            };
        }
    } catch (staticError) {
        console.warn(`[Lead Intelligence] Static roster harvest failed for ${office.brokerageName}: ${staticError.message}. Continuing to browser parser.`);
    }

    try {
        return await harvestRosterWithBrowser(harvestOffice);
    } catch (browserError) {
        console.warn(`[Lead Intelligence] Browser roster harvest failed for ${office.brokerageName}: ${browserError.message}. Falling back to HTTP parser.`);
        const fallbackCandidates = await scrapeBrokerageRosterCandidatesFromWebsite(
            harvestOffice.website,
            harvestOffice.brokerageName,
            `${harvestOffice.brokerageName} ${harvestOffice.city} ${harvestOffice.state}`,
            [harvestOffice.rosterUrl, harvestOffice.sourceUrl].filter(Boolean)
        );
        return {
            contacts: fallbackCandidates,
            pagesScanned: 0,
            warning: browserError.message,
            blocked: isBlockedRosterError(browserError.message)
        };
    }
}

async function runLeadIntelligenceCycle(trigger = 'manual') {
    if (leadIntelligenceWorkerRunning) {
        return { skipped: true, reason: 'lead intelligence worker already running' };
    }

    leadIntelligenceWorkerRunning = true;
    let runId;

    try {
        seedLeadIntelligenceDefaults();
        runId = db.insertIntelligenceRun({ type: 'lead-intelligence', status: 'Running', message: `Started by ${trigger}` });
        appendActivityLog('agent-sales', `Lead Intelligence started by ${trigger}.`, {
            workflow: 'lead-intelligence',
            runId,
            trigger
        });

        const attempts = [];
        let totalContacts = 0;
        let totalPagesScanned = 0;
        let discoveredOffices = 0;
        let suppressedBrandOffices = 0;
        let lastOffice = null;
        let stopReason = '';
        let refreshedProfileResearch = { researched: 0, profiles: [] };

        for (let cycleIndex = 0; cycleIndex < LEAD_INTELLIGENCE_MAX_OFFICES_PER_CYCLE; cycleIndex++) {
            let office = db.getNextBrokerageOfficeForHarvest();
            if (!office) {
                const city = db.getNextMarketCityForDiscovery();
                if (!city) {
                    stopReason = attempts.length ? 'no more queued offices or cities' : 'no cities available';
                    break;
                }

                const discoveryMessage = `Discovering brokerages in ${city.city}, ${city.state}`;
                db.updateIntelligenceRun(runId, { cityId: city.id, message: discoveryMessage });
                appendActivityLog('agent-sales', discoveryMessage, {
                    workflow: 'lead-intelligence',
                    runId,
                    phase: 'brokerage-discovery',
                    city: city.city,
                    state: city.state
                });
                const offices = await discoverBrokerageOfficeTargetsForCity(city);
                offices.forEach(item => db.upsertBrokerageOffice(item));
                discoveredOffices += offices.length;
                appendActivityLog('agent-sales', `Discovered ${offices.length} brokerage office target(s) in ${city.city}, ${city.state}.`, {
                    workflow: 'lead-intelligence',
                    runId,
                    phase: 'brokerage-discovery',
                    city: city.city,
                    state: city.state,
                    discoveredOffices: offices.length
                });
                db.updateMarketCity(city.id, {
                    status: 'Discovered',
                    lastDiscoveryAt: new Date().toISOString()
                });
                office = db.getNextBrokerageOfficeForHarvest();
            }

            if (!office) {
                stopReason = attempts.length ? 'brokerage discovery produced no queued offices' : 'no brokerage offices queued';
                break;
            }

            lastOffice = office;
            const harvestMessage = `Harvesting ${office.brokerageName} in ${office.city}, ${office.state} (${cycleIndex + 1}/${LEAD_INTELLIGENCE_MAX_OFFICES_PER_CYCLE})`;
            db.updateIntelligenceRun(runId, {
                brokerageOfficeId: office.id,
                message: harvestMessage
            });
            appendActivityLog('agent-sales', harvestMessage, {
                workflow: 'lead-intelligence',
                runId,
                phase: 'roster-harvest',
                brokerage: office.brokerageName,
                city: office.city,
                state: office.state,
                cycleIndex: cycleIndex + 1,
                maxOffices: LEAD_INTELLIGENCE_MAX_OFFICES_PER_CYCLE
            });

            const harvest = await harvestBrokerageOfficeRoster(office);

            let insertedOrUpdated = 0;
            for (const contact of harvest.contacts) {
                const saved = db.upsertRosterContact({
                    brokerageOfficeId: office.id,
                    brokerageName: office.brokerageName,
                    city: office.city,
                    state: office.state,
                    name: contact.name,
                    email: contact.email,
                    phone: contact.phone,
                    website: contact.website,
                    sourceUrl: contact.sourceUrl,
                    socials: contact.socials || {}
                });
                if (saved) insertedOrUpdated++;
            }

            const harvestStatus = insertedOrUpdated > 0 ? 'Harvested' : harvest.blocked ? 'Blocked' : harvest.warning ? 'Failed' : 'No Contacts';
            let status = harvestStatus;
            let suppressed = 0;
            let skippedProfileResearch = false;
            let doNotScrapeReason = '';
            const brandContactCount = db.getBrokerageRosterContactCount(office.brokerageName);
            const shouldStopBrokerageAfterZeroContactResult = insertedOrUpdated === 0 && shouldMarkBrokerageDoNotScrapeAfterResult(office, harvestStatus, harvest);
            const noUsableRosterForBrand = brandContactCount === 0 && shouldStopBrokerageAfterZeroContactResult;

            if (shouldStopBrokerageAfterZeroContactResult) {
                status = 'Do Not Scrape';
                doNotScrapeReason = `${office.brokerageName} marked do not scrape after ${harvestStatus.toLowerCase()} result in ${office.city}, ${office.state}: ${harvest.warning || 'No harvestable public roster contacts.'}`;
                skippedProfileResearch = true;
                if (noUsableRosterForBrand) {
                    db.upsertBrokerageProfile({
                        name: office.brokerageName,
                        researchStatus: 'Do Not Scrape',
                        notes: doNotScrapeReason,
                        techStack: {
                            researchVersion: 'roster-gated-v1',
                            doNotScrape: true,
                            reason: doNotScrapeReason,
                            lastRosterStatus: harvestStatus,
                            lastRosterCity: office.city,
                            lastRosterState: office.state
                        }
                    });
                }
            }

            db.updateBrokerageOffice(office.id, {
                status,
                lastHarvestAt: new Date().toISOString(),
                lastError: doNotScrapeReason || harvest.warning || '',
                rosterPageCount: harvest.pagesScanned || 0,
                contactCount: insertedOrUpdated
            });

            if (doNotScrapeReason) {
                suppressed = db.suppressQueuedBrokerageBrand(office.brokerageName, doNotScrapeReason, office.id, 'Do Not Scrape');
                suppressedBrandOffices += suppressed;
                appendActivityLog('system-line', `${office.brokerageName} marked Do Not Scrape; skipped systems research because no usable roster contacts were found.`, {
                    workflow: 'lead-intelligence',
                    runId,
                    phase: 'do-not-scrape',
                    brokerage: office.brokerageName,
                    city: office.city,
                    state: office.state,
                    harvestStatus,
                    suppressedBrandOffices: suppressed
                });
            } else if (shouldSuppressBrokerageBrandAfterResult(office, status, harvest)) {
                const reason = `${office.brokerageName} skipped after ${status.toLowerCase()} result in ${office.city}, ${office.state}: ${harvest.warning || 'No harvestable public roster contacts.'}`;
                suppressed = db.suppressQueuedBrokerageBrand(office.brokerageName, reason, office.id, 'Skipped Brand');
                suppressedBrandOffices += suppressed;
            }

            if (!skippedProfileResearch && LEAD_INTELLIGENCE_RESEARCH_TECH_STACK && db.getBrokerageRosterContactCount(office.brokerageName) > 0) {
                const profile = db.getBrokerageProfileByName(office.brokerageName);
                if (profile && !hasCurrentBrokerageTechResearch(profile)) {
                    await researchBrokerageTechStack(profile);
                }
            }

            const attempt = {
                brokerage: office.brokerageName,
                city: office.city,
                state: office.state,
                status,
                harvestStatus,
                contacts: insertedOrUpdated,
                pagesScanned: harvest.pagesScanned || 0,
                warning: harvest.warning || '',
                suppressedBrandOffices: suppressed,
                skippedProfileResearch
            };
            attempts.push(attempt);
            totalContacts += insertedOrUpdated;
            totalPagesScanned += harvest.pagesScanned || 0;
            appendActivityLog(insertedOrUpdated > 0 ? 'agent-sales' : 'system-line', `${office.brokerageName} ${office.city}, ${office.state}: ${status}; ${insertedOrUpdated} contact(s), ${harvest.pagesScanned || 0} page(s) scanned.`, {
                workflow: 'lead-intelligence',
                runId,
                phase: 'roster-harvest-result',
                ...attempt
            });

            if (insertedOrUpdated > 0 && LEAD_INTELLIGENCE_STOP_AFTER_CONTACTS) {
                stopReason = 'contacts harvested';
                break;
            }
        }

        refreshedProfileResearch = await refreshStaleBrokerageResearchProfiles(runId);

        if (attempts.length === 0) {
            const didRefreshProfiles = refreshedProfileResearch.researched > 0;
            db.updateIntelligenceRun(runId, {
                status: 'Complete',
                finishedAt: new Date().toISOString(),
                message: didRefreshProfiles
                    ? `Updated systems research for ${refreshedProfileResearch.researched} brokerage profile(s).`
                    : stopReason || 'No lead intelligence work was available.',
                stats: {
                    discoveredOffices,
                    contacts: 0,
                    attempts: [],
                    refreshedProfileResearch
                }
            });
            appendActivityLog(didRefreshProfiles ? 'agent-sales' : 'system-line', didRefreshProfiles
                ? `Lead Intelligence updated systems research for ${refreshedProfileResearch.researched} brokerage profile(s).`
                : `Lead Intelligence found no work to run: ${stopReason || 'no work available'}.`, {
                workflow: 'lead-intelligence',
                runId,
                phase: 'complete',
                discoveredOffices,
                contacts: 0,
                refreshedProfiles: refreshedProfileResearch.researched
            });
            return {
                skipped: !didRefreshProfiles,
                reason: didRefreshProfiles ? 'refreshed stale brokerage research' : stopReason || 'no work available',
                refreshedProfileResearch
            };
        }

        const harvestedAttempts = attempts.filter(item => item.contacts > 0).length;
        const message = totalContacts > 0
            ? `Harvested ${totalContacts} contact(s) from ${harvestedAttempts} office(s) after checking ${attempts.length} office(s).`
            : `Checked ${attempts.length} office(s); no contacts harvested.`;

        db.updateIntelligenceRun(runId, {
            status: 'Complete',
            finishedAt: new Date().toISOString(),
            brokerageOfficeId: lastOffice && lastOffice.id,
            message,
            stats: {
                contacts: totalContacts,
                officesChecked: attempts.length,
                discoveredOffices,
                pagesScanned: totalPagesScanned,
                suppressedBrandOffices,
                refreshedProfileResearch,
                stopReason: stopReason || 'max offices per cycle reached',
                attempts
            }
        });
        appendActivityLog('agent-sales', `Lead Intelligence complete: ${message}`, {
            workflow: 'lead-intelligence',
            runId,
            phase: 'complete',
            contacts: totalContacts,
            officesChecked: attempts.length,
            discoveredOffices,
            pagesScanned: totalPagesScanned,
            suppressedBrandOffices,
            refreshedProfiles: refreshedProfileResearch.researched,
            stopReason: stopReason || 'max offices per cycle reached'
        });

        return {
            skipped: false,
            contacts: totalContacts,
            officesChecked: attempts.length,
            discoveredOffices,
            pagesScanned: totalPagesScanned,
            suppressedBrandOffices,
            refreshedProfileResearch,
            stopReason: stopReason || 'max offices per cycle reached',
            attempts
        };
    } catch (error) {
        const message = formatErrorMessage(error, 'Lead intelligence cycle failed.');
        console.error('[Lead Intelligence] Cycle failed:', message);
        if (runId) {
            db.updateIntelligenceRun(runId, {
                status: 'Failed',
                finishedAt: new Date().toISOString(),
                message,
                error: message
            });
        }
        appendActivityLog('system-line', `Lead Intelligence failed: ${message}`, {
            workflow: 'lead-intelligence',
            runId,
            phase: 'failed'
        });
        return { skipped: false, error: message };
    } finally {
        leadIntelligenceWorkerRunning = false;
    }
}

function serializeLeadScrapeJob(job) {
    return {
        id: job.id,
        niche: job.niche,
        count: job.count,
        status: job.status,
        phase: job.phase,
        message: job.message,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        result: job.result,
        error: job.error,
        details: job.details
    };
}

function updateLeadScrapeJob(job, changes) {
    Object.assign(job, changes, { updatedAt: new Date().toISOString() });
    return job;
}

function cleanupLeadScrapeJobs() {
    const cutoffMs = Date.now() - (2 * 60 * 60 * 1000);
    for (const [id, job] of leadScrapeJobs.entries()) {
        const updatedAt = Date.parse(job.updatedAt || job.createdAt || '');
        if (Number.isFinite(updatedAt) && updatedAt < cutoffMs) {
            leadScrapeJobs.delete(id);
        }
    }
}

function startLeadScrapeJob(niche, count) {
    cleanupLeadScrapeJobs();

    const now = new Date().toISOString();
    const job = {
        id: crypto.randomUUID(),
        niche,
        count,
        status: 'queued',
        phase: 'queued',
        message: 'Queued lead scrape job.',
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        completedAt: null,
        result: null,
        error: null,
        details: null
    };

    leadScrapeJobs.set(job.id, job);
    appendActivityLog('agent-sales', `Lead scrape queued for "${niche}" (${count} requested).`, {
        workflow: 'lead-scrape',
        jobId: job.id,
        phase: 'queued',
        niche,
        count
    });

    setImmediate(async () => {
        try {
            updateLeadScrapeJob(job, {
                status: 'running',
                phase: 'starting',
                message: `Starting lead scrape for "${niche}".`,
                startedAt: new Date().toISOString()
            });
            appendActivityLog('agent-sales', `Lead scrape started for "${niche}".`, {
                workflow: 'lead-scrape',
                jobId: job.id,
                phase: 'starting',
                niche,
                count
            });

            const result = await runLeadScrape(niche, count, (phase, message) => {
                updateLeadScrapeJob(job, { phase, message });
                appendActivityLog('agent-sales', message, {
                    workflow: 'lead-scrape',
                    jobId: job.id,
                    phase,
                    niche,
                    count
                });
            });

            updateLeadScrapeJob(job, {
                status: 'completed',
                phase: 'completed',
                message: `Scrape complete. Added ${result.leads.length} new lead(s).`,
                completedAt: new Date().toISOString(),
                result
            });
            appendActivityLog('agent-sales', `Lead scrape complete for "${niche}". Added ${result.leads.length} new lead(s).`, {
                workflow: 'lead-scrape',
                jobId: job.id,
                phase: 'completed',
                niche,
                requested: count,
                added: result.leads.length,
                skipped: result.skipped || 0
            });
        } catch (error) {
            const message = formatErrorMessage(error, 'Lead scrape failed.');
            updateLeadScrapeJob(job, {
                status: 'failed',
                phase: 'failed',
                message,
                completedAt: new Date().toISOString(),
                error: message,
                details: error.details || null
            });
            appendActivityLog('system-line', `Lead scrape failed for "${niche}": ${message}`, {
                workflow: 'lead-scrape',
                jobId: job.id,
                phase: 'failed',
                niche,
                count
            });
        }
    });

    return job;
}

// 1. Web Scraper & Profile Summarizer Endpoint
app.post('/api/scrape', async (req, res) => {
    let { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }

    try {
        let websiteResearch;
        try {
            websiteResearch = await crawlBusinessWebsite(url);
        } catch (crawlError) {
            const normalizedUrl = normalizeWebsiteUrl(url);
            console.warn(`[Scraper] Direct crawl failed for ${normalizedUrl}. Falling back to Gemini Search grounding.`, crawlError.message);
            websiteResearch = {
                normalizedUrl,
                baseHost: normalizeDomain(normalizedUrl),
                pagesScanned: [],
                socialLinks: {},
                combinedText: `Direct website crawl failed with: ${crawlError.message}. Use Google Search grounding to research the company at ${normalizedUrl}, including official pages, product pages, competitor references, and public social profiles.`
            };
        }

        if (websiteResearch.combinedText.length < 50) {
            return res.status(400).json({ error: "Could not scrape enough readable text content from the website." });
        }

        console.log(`[Scraper] Scanned ${websiteResearch.pagesScanned.length} pages from ${websiteResearch.baseHost}. Querying Gemini for deep business intelligence...`);

        const prompt = `You are a senior business analyst and ad agency strategist.
Use the scraped company website text plus Google Search grounding to build an onboarding intelligence report. Research the company, its products, value proposition, likely buying audience, direct competitors, competitor positioning, and public social profiles.

Rules:
- Prefer verifiable public facts from the company site and search results.
- Do not invent exact pricing, integrations, guarantees, or social URLs. Use empty strings when unknown.
- Competitors must be real businesses in the same buying category, not vague alternatives.
- Return 5-8 direct competitors whenever possible. If the market is small, return every credible direct competitor you can verify.
- Always populate swotProfile as four labeled paragraphs: Strengths, Weaknesses, Opportunities, Threats.
- Keep paragraphs concise but specific enough for AI ad copy, social content, and client email replies.
- Return ONLY valid JSON with no markdown.

Company website: ${websiteResearch.normalizedUrl}
Company social links found on site: ${JSON.stringify(websiteResearch.socialLinks)}
Pages scanned: ${websiteResearch.pagesScanned.join(', ')}

Scraped company website text or crawl fallback note:
-----------------
${websiteResearch.combinedText}
-----------------

Return this exact JSON shape:
{
  "businessName": "The Business Name here",
  "description": "A 3-5 sentence company profile covering what the company sells, the problem it solves, why it is valuable, and what makes it credible.",
  "offers": "- Offer 1\\n- Offer 2\\n- Offer 3",
  "audience": "Segment 1, Segment 2, Segment 3, Segment 4",
  "valueProposition": "A concise positioning statement for ads and outreach.",
  "competitors": "competitor1.com, competitor2.com, competitor3.com, competitor4.com, competitor5.com",
  "companySocialLinks": {
    "website": "https://example.com",
    "linkedin": "",
    "facebook": "",
    "instagram": "",
    "youtube": "",
    "tiktok": "",
    "x": ""
  },
  "competitorProfiles": [
    {
      "name": "Competitor name",
      "domain": "competitor.com",
      "summary": "What they offer and who they appear to serve.",
      "strengths": "Specific competitive strengths.",
      "weaknesses": "Specific openings or limitations compared with the scanned company.",
      "differentiationAgainstCompany": "How the scanned company can credibly position against them.",
      "socialLinks": {
        "linkedin": "",
        "facebook": "",
        "instagram": "",
        "youtube": "",
        "tiktok": "",
        "x": ""
      }
    }
  ],
  "swotProfile": "Strengths: paragraph.\\n\\nWeaknesses: paragraph.\\n\\nOpportunities: paragraph.\\n\\nThreats: paragraph.",
  "businessReport": "A detailed but compact report with company profile, market landscape, competitive advantages, improvement opportunities, content angles, ad hooks, and support/email guidance."
}`;

        const rawJsonResult = await queryGeminiWithSearch(prompt, { json: true, model: GEMINI_RESEARCH_MODEL });
        const result = await parseModelJsonWithRepair(rawJsonResult);
        const initialProfiles = Array.isArray(result.competitorProfiles) ? result.competitorProfiles : [];
        const listedDomains = String(result.competitors || '').split(',').map(domain => normalizeDomain(domain)).filter(Boolean);
        const competitorProfiles = await ensureMinimumCompetitorProfiles({
            profiles: initialProfiles,
            competitorDomains: listedDomains,
            businessName: result.businessName,
            description: result.description,
            offers: result.offers,
            minimum: 5
        });
        const competitorDomains = competitorProfiles
            .map(profile => normalizeDomain(profile.domain || profile.website || profile.name))
            .filter(Boolean);
        const competitors = competitorDomains.join(', ');
        let swotProfile = normalizeSwotProfile(
            result.swotProfile ||
            result.swot_profile ||
            result.swotAnalysis ||
            result.swot_analysis ||
            result.SWOT ||
            result.SWOTAnalysis ||
            result.businessAnalysis,
            result.businessReport
        );

        if (!swotProfile) {
            console.warn(`[Scraper] Primary research did not include a parseable SWOT. Generating fallback SWOT from company and competitor data.`);
            swotProfile = await generateFallbackSwotProfile({ result, competitorProfiles });
        }

        if (!swotProfile) {
            swotProfile = buildDeterministicSwotProfile({
                businessName: result.businessName,
                description: result.description,
                offers: result.offers,
                valueProposition: result.valueProposition,
                competitorProfiles
            });
        }

        res.json({
            ...result,
            competitors,
            swotProfile,
            competitorProfiles,
            researchMeta: {
                pagesScanned: websiteResearch.pagesScanned,
                companyDomain: websiteResearch.baseHost,
                generatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error(`[Scraper Error]`, error.message);
        res.status(500).json({ error: `Scraping failed: ${error.message}` });
    }
});

// 2. AI Target Audience Identification Endpoint
app.post('/api/audience', async (req, res) => {
    const { description, offers } = req.body;
    if (!description) {
        return res.status(400).json({ error: "Business description is required" });
    }

    const prompt = `You are a strategic marketing executive. 
Analyze the business profile below and identify 3-4 target audience segments or ideal customer profiles (ICP).
Provide a comma-separated list of these target audience segments, keeping it concise and optimized for campaign targeting.

Business Profile:
Description: ${description}
Core Offers: ${offers || 'Not defined'}

Format your response as a single line, listing the target audience groups separated by commas. (e.g. "Residential real estate agents, independent mortgage brokers, real estate brokerage teams").`;

    try {
        console.log(`[Audience Agent] Querying Gemini for Target Audience profile...`);
        const audienceResult = await queryGemini(prompt);
        res.json({ audience: audienceResult.trim() });
    } catch (error) {
        console.error(`[Audience Error]`, error.message);
        res.status(500).json({ error: `Audience determination failed: ${error.message}` });
    }
});

// 3. AI Competitor Domains Identification Endpoint
app.post('/api/competitors', async (req, res) => {
    const { description, offers } = req.body;
    if (!description) {
        return res.status(400).json({ error: "Business description is required" });
    }

    const prompt = `You are a strategic marketing executive.
Use Google Search grounding to identify 5-8 real direct competitors for the business profile below. Include useful public social profile URLs when you can verify them.

Business Profile:
Description: ${description}
Core Offers: ${offers || 'Not defined'}

Return ONLY valid JSON in this shape:
{
  "competitors": "competitor1.com, competitor2.com, competitor3.com, competitor4.com, competitor5.com",
  "competitorProfiles": [
    {
      "name": "Competitor name",
      "domain": "competitor.com",
      "summary": "What they offer and who they serve.",
      "strengths": "Specific competitive strengths.",
      "weaknesses": "Openings or limitations compared with this business.",
      "differentiationAgainstCompany": "How this business can position against them.",
      "socialLinks": {
        "linkedin": "",
        "facebook": "",
        "instagram": "",
        "youtube": "",
        "tiktok": "",
        "x": ""
      }
    }
  ]
}`;

    try {
        console.log(`[Competitors Agent] Querying Gemini for Competitor domains...`);
        const rawResult = await queryGeminiWithSearch(prompt, { json: true, model: GEMINI_RESEARCH_MODEL });
        const data = await parseModelJsonWithRepair(rawResult);
        const listedDomains = String(data.competitors || '').split(',').map(domain => normalizeDomain(domain)).filter(Boolean);
        const competitorProfiles = await ensureMinimumCompetitorProfiles({
            profiles: Array.isArray(data.competitorProfiles) ? data.competitorProfiles : [],
            competitorDomains: listedDomains,
            businessName: '',
            description,
            offers,
            minimum: 5
        });
        res.json({
            competitors: competitorProfiles.map(profile => profile.domain).filter(Boolean).join(', '),
            competitorProfiles
        });
    } catch (error) {
        console.error(`[Competitors Error]`, error.message);
        res.status(500).json({ error: `Competitor lookup failed: ${error.message}` });
    }
});

app.post('/api/competitor-profile', async (req, res) => {
    const { domain, description, offers, businessName } = req.body;
    const cleanDomain = normalizeDomain(domain || '');
    if (!cleanDomain) {
        return res.status(400).json({ error: "Competitor domain is required" });
    }

    const prompt = `You are a competitive intelligence researcher.
Use Google Search grounding to research this specific competitor and find its useful public social profiles.

Our business:
Name: ${businessName || 'Unknown'}
Description: ${description || 'Not provided'}
Core Offers: ${offers || 'Not provided'}

Competitor domain: ${cleanDomain}

Return ONLY valid JSON:
{
  "competitorProfile": {
    "name": "Competitor name",
    "domain": "${cleanDomain}",
    "summary": "What they offer and who they serve.",
    "strengths": "Specific competitive strengths.",
    "weaknesses": "Openings or limitations compared with our business.",
    "differentiationAgainstCompany": "How our business can position against them.",
    "socialLinks": {
      "linkedin": "",
      "facebook": "",
      "instagram": "",
      "youtube": "",
      "tiktok": "",
      "x": ""
    }
  }
}`;

    try {
        console.log(`[Competitor Profile] Researching ${cleanDomain}...`);
        const rawResult = await queryGeminiWithSearch(prompt, { json: true, model: GEMINI_RESEARCH_MODEL });
        const data = await parseModelJsonWithRepair(rawResult);
        const profile = normalizeCompetitorProfile(data.competitorProfile || data);
        res.json({ competitorProfile: profile || { domain: cleanDomain, name: cleanDomain, socialLinks: {} } });
    } catch (error) {
        console.error(`[Competitor Profile Error]`, error.message);
        res.status(500).json({ error: `Competitor profile lookup failed: ${error.message}` });
    }
});

const TREND_RESEARCH_MAX_QUERIES = Math.max(4, Math.min(24, parseInt(process.env.TREND_RESEARCH_MAX_QUERIES || '12', 10) || 12));
const TREND_TERM_STOPWORDS = new Set([
    'about', 'after', 'again', 'agency', 'agent', 'agents', 'also', 'and', 'are', 'audience',
    'business', 'client', 'company', 'core', 'customer', 'customers', 'description', 'for',
    'from', 'have', 'help', 'into', 'marketing', 'more', 'offer', 'offers', 'only', 'our',
    'service', 'services', 'software', 'that', 'their', 'them', 'these', 'this', 'value',
    'with', 'your'
]);

function cleanTrendTerm(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/[^a-z0-9+#.\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function dedupeStrings(values = [], limit = 20) {
    const seen = new Set();
    const output = [];
    for (const value of values) {
        const cleaned = cleanTrendTerm(value);
        if (!cleaned || cleaned.length < 3 || seen.has(cleaned)) continue;
        seen.add(cleaned);
        output.push(cleaned);
        if (output.length >= limit) break;
    }
    return output;
}

function truncateForPrompt(value, maxLength = 900) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function splitCompetitorList(competitors) {
    return String(competitors || '')
        .split(',')
        .map(item => normalizeDomain(item.trim()) || item.trim())
        .filter(Boolean);
}

function competitorDomainToBrand(domain) {
    return String(domain || '')
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .split('/')[0]
        .split('.')[0]
        .replace(/[-_]+/g, ' ')
        .trim();
}

function extractKeywordCandidatesFromText(text) {
    const cleaned = cleanTrendTerm(text);
    if (!cleaned) return [];
    const words = cleaned.split(/\s+/).filter(word => word.length > 2 && !TREND_TERM_STOPWORDS.has(word));
    const candidates = [];
    const important = /\b(ai|crm|realtor|realtors|real|estate|broker|brokerage|lead|leads|follow|automation|listing|listings|software|transaction|marketing)\b/i;

    for (let size = 2; size <= 4; size++) {
        for (let i = 0; i <= words.length - size; i++) {
            const phrase = words.slice(i, i + size).join(' ');
            if (important.test(phrase)) candidates.push(phrase);
        }
    }

    return dedupeStrings(candidates, 12);
}

function inferFallbackTrendKeywords(context = {}) {
    const combined = [
        context.bizName,
        context.bizDesc,
        context.bizAudience,
        context.bizSwot,
        context.businessReport,
        context.agencyGoal,
        context.coreMessage
    ].join(' ').toLowerCase();

    const terms = [];
    if (/real estate|realtor|brokerage|listing|agent/.test(combined)) {
        terms.push(
            'real estate crm',
            'ai for realtors',
            'realtor software',
            'crm for realtors',
            'real estate agent crm',
            'real estate ai tools',
            'real estate lead follow up',
            'real estate lead generation',
            'realtor marketing automation',
            'real estate client management',
            'listing follow up automation',
            'real estate database management'
        );
    }
    if (/crm|pipeline|lead|follow up|sales/.test(combined)) {
        terms.push(
            'crm automation',
            'lead follow up automation',
            'sales pipeline software',
            'client follow up system'
        );
    }
    if (/ai|automation|automated/.test(combined)) {
        terms.push(
            'ai automation tools',
            'ai business automation',
            'ai sales assistant'
        );
    }

    const competitorTerms = splitCompetitorList(context.competitors)
        .map(competitorDomainToBrand)
        .filter(Boolean)
        .map(brand => `${brand} alternatives`);

    return dedupeStrings([
        ...terms,
        ...extractKeywordCandidatesFromText(combined),
        ...competitorTerms,
        'business growth tips'
    ], 18);
}

function keywordObjectsFromTerms(terms = [], source = 'Onboarding keyword') {
    return dedupeStrings(terms, 20).map((term, index) => ({
        term,
        reason: source,
        priority: Math.max(1, 100 - index * 5)
    }));
}

async function buildTrendKeywordPlan(context = {}) {
    const fallbackTerms = inferFallbackTrendKeywords(context);
    const fallbackPlan = {
        primarySearchTerms: fallbackTerms.slice(0, 8),
        viralKeywordHypotheses: fallbackTerms.slice(0, 12),
        customerPainPoints: [],
        keywords: keywordObjectsFromTerms(fallbackTerms, 'Derived from onboarding profile')
    };

    const competitorProfiles = context.competitorProfiles && typeof context.competitorProfiles === 'object'
        ? Object.values(context.competitorProfiles).slice(0, 8)
        : [];
    const prompt = `Use Google Search grounding and the onboarding profile below to build a social-content research keyword plan.
The goal is to find real high-engagement short-form posts/videos and the keywords likely driving them.

Business name: ${context.bizName || 'Client Business'}
Business description and offers: ${truncateForPrompt(context.bizDesc, 1200)}
Target audience: ${truncateForPrompt(context.bizAudience, 700)}
Strategy/SWOT notes: ${truncateForPrompt(context.bizSwot, 900)}
Business report: ${truncateForPrompt(context.businessReport, 900)}
Known competitors: ${context.competitors || 'None provided'}
Competitor profile notes: ${truncateForPrompt(JSON.stringify(competitorProfiles), 1200)}

Return JSON only:
{
  "primarySearchTerms": ["3-6 word search terms"],
  "viralKeywordHypotheses": ["keywords/topics likely tied to viral posts"],
  "customerPainPoints": ["audience pains to search"],
  "keywords": [
    { "term": "real estate crm", "reason": "why this matters", "priority": 100 }
  ]
}

Rules:
- Include direct category terms even without competitor URLs.
- For a real estate CRM business, include terms like real estate crm, ai for realtors, realtor software, crm for realtors, real estate lead follow up, and real estate ai tools when relevant.
- Favor buying-intent, pain-point, and creator-hook phrases people would use in Instagram Reels, TikTok, YouTube Shorts, Facebook Reels, Reddit, and LinkedIn content.
- Do not invent exact engagement numbers.`;

    try {
        const raw = await queryGeminiWithSearch(prompt, { json: true, model: GEMINI_RESEARCH_MODEL });
        const data = await parseModelJsonWithRepair(raw);
        const generatedTerms = dedupeStrings([
            ...(Array.isArray(data.primarySearchTerms) ? data.primarySearchTerms : []),
            ...(Array.isArray(data.viralKeywordHypotheses) ? data.viralKeywordHypotheses : []),
            ...(Array.isArray(data.customerPainPoints) ? data.customerPainPoints : []),
            ...(Array.isArray(data.keywords) ? data.keywords.map(item => item && item.term) : []),
            ...fallbackTerms
        ], 18);
        const keywordObjects = Array.isArray(data.keywords)
            ? data.keywords
                .map((item, index) => ({
                    term: cleanTrendTerm(item && item.term),
                    reason: String((item && item.reason) || 'AI keyword research').trim(),
                    priority: Number(item && item.priority) || Math.max(1, 100 - index * 5)
                }))
                .filter(item => item.term)
            : [];

        return {
            primarySearchTerms: dedupeStrings([...(Array.isArray(data.primarySearchTerms) ? data.primarySearchTerms : []), ...generatedTerms], 10),
            viralKeywordHypotheses: dedupeStrings([...(Array.isArray(data.viralKeywordHypotheses) ? data.viralKeywordHypotheses : []), ...generatedTerms], 14),
            customerPainPoints: Array.isArray(data.customerPainPoints) ? data.customerPainPoints.slice(0, 8) : [],
            keywords: [...keywordObjects, ...keywordObjectsFromTerms(generatedTerms, 'Derived from onboarding profile')]
                .filter((item, index, arr) => arr.findIndex(other => other.term === item.term) === index)
                .slice(0, 16)
        };
    } catch (error) {
        console.warn('[Trends Agent] Keyword plan research failed; using deterministic onboarding keywords.', error.message);
        return fallbackPlan;
    }
}

function buildTrendResearchQueries(plan = {}, context = {}) {
    const competitors = splitCompetitorList(context.competitors);
    const competitorBrands = competitors.map(competitorDomainToBrand).filter(Boolean);
    const terms = dedupeStrings([
        ...(Array.isArray(plan.primarySearchTerms) ? plan.primarySearchTerms : []),
        ...(Array.isArray(plan.viralKeywordHypotheses) ? plan.viralKeywordHypotheses : []),
        ...(Array.isArray(plan.keywords) ? plan.keywords.map(item => item && item.term) : []),
        ...inferFallbackTrendKeywords(context)
    ], 18);

    const platformRotations = [
        { platform: 'youtube', suffix: 'youtube shorts viral' },
        { platform: 'instagram', suffix: 'instagram reels viral' },
        { platform: 'tiktok', suffix: 'tiktok viral tips' },
        { platform: 'facebook', suffix: 'facebook reels viral' },
        { platform: 'reddit', suffix: 'reddit discussion' },
        { platform: 'linkedin', suffix: 'linkedin post' }
    ];

    const queries = [];
    competitorBrands.slice(0, 4).forEach((brand, index) => {
        const platform = platformRotations[index % platformRotations.length];
        const category = terms[0] || 'business software';
        queries.push({
            platform: platform.platform,
            keyword: `${brand} ${category}`,
            query: `${brand} ${category} ${platform.suffix}`.slice(0, 140)
        });
    });

    terms.forEach((term, index) => {
        const platform = platformRotations[index % platformRotations.length];
        queries.push({
            platform: platform.platform,
            keyword: term,
            query: `${term} ${platform.suffix}`.slice(0, 140)
        });
    });

    return queries
        .filter((item, index, arr) => arr.findIndex(other => other.query === item.query) === index)
        .slice(0, TREND_RESEARCH_MAX_QUERIES);
}

function scoreTrendEngagement(trend = {}) {
    const score = Number(trend.trendScore) || 0;
    const engagement = String(trend.engagement || '').toLowerCase();
    const matches = [...engagement.matchAll(/(\d+(?:\.\d+)?)(k|m)?\s*(views|likes|comments|reposts|shares|replies)?/g)];
    const parsed = matches.reduce((total, match) => {
        let value = Number(match[1]) || 0;
        if (match[2] === 'k') value *= 1000;
        if (match[2] === 'm') value *= 1000000;
        return total + value;
    }, 0);
    return score * 1000 + parsed;
}

function summarizeKeywordPerformance(plan = {}, trends = []) {
    const byTerm = new Map();
    const seedKeywords = Array.isArray(plan.keywords) ? plan.keywords : [];
    seedKeywords.forEach((keyword, index) => {
        if (!keyword || !keyword.term) return;
        const term = cleanTrendTerm(keyword.term);
        byTerm.set(term, {
            term,
            reason: keyword.reason || 'Selected from onboarding profile',
            priority: Number(keyword.priority) || Math.max(1, 100 - index * 5),
            trendCount: 0,
            bestEngagement: '',
            score: Number(keyword.priority) || 0
        });
    });

    trends.forEach(trend => {
        const term = cleanTrendTerm(trend.searchKeyword || trend.keyword || trend.topic);
        if (!term) return;
        const current = byTerm.get(term) || {
            term,
            reason: 'Returned high-engagement posts in trend research',
            priority: 50,
            trendCount: 0,
            bestEngagement: '',
            score: 0
        };
        current.trendCount += 1;
        const trendScore = scoreTrendEngagement(trend);
        current.score += 100 + trendScore;
        if (!current.bestEngagement || trendScore > current.bestTrendScore) {
            current.bestEngagement = trend.engagement || current.bestEngagement;
            current.bestTrendScore = trendScore;
        }
        byTerm.set(term, current);
    });

    return [...byTerm.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map(item => ({
            term: item.term,
            reason: item.reason,
            trendCount: item.trendCount,
            bestEngagement: item.bestEngagement,
            priority: item.priority
        }));
}

function trendCacheKey(context = {}) {
    return crypto.createHash('sha256')
        .update(JSON.stringify({
            bizName: context.bizName || '',
            bizDesc: context.bizDesc || '',
            bizAudience: context.bizAudience || '',
            competitors: context.competitors || ''
        }))
        .digest('hex')
        .slice(0, 24);
}

async function researchGroundedSocialTrends(context = {}, plan = {}, limit = 8) {
    const keywords = (Array.isArray(plan.keywords) ? plan.keywords : [])
        .map(item => item.term)
        .filter(Boolean)
        .slice(0, 10)
        .join(', ');
    const prompt = `Use Google Search grounding to find real public recent social/video/content examples for this market.
Business: ${context.bizName || 'Client Business'}
Audience: ${truncateForPrompt(context.bizAudience, 500)}
Description/offers: ${truncateForPrompt(context.bizDesc, 800)}
Known competitors: ${context.competitors || 'None provided'}
Priority keywords: ${keywords || inferFallbackTrendKeywords(context).slice(0, 8).join(', ')}

Return JSON only:
{
  "trends": [
    {
      "platform": "youtube|instagram|tiktok|facebook|linkedin|reddit|market",
      "competitor": "creator/company/source name",
      "topic": "short topic",
      "body": "brief paraphrase of the real post/content angle",
      "engagementMetrics": "visible public metrics like 12K views, 530 likes, 42 comments; empty string if not visible",
      "trendSignal": "why this is a relevant/high-performing angle when public metrics are not visible",
      "engagement": "legacy fallback; use public metrics if visible, otherwise use the trend signal",
      "keyword": "keyword that found it",
      "sourceUrl": "public source URL if available"
    }
  ]
}

Only include items supported by search results. Do not invent exact likes/views/comments.`;

    try {
        const raw = await queryGeminiWithSearch(prompt, { json: true, model: GEMINI_RESEARCH_MODEL });
        const data = await parseModelJsonWithRepair(raw);
        const trends = Array.isArray(data.trends) ? data.trends : [];
        return trends.slice(0, limit).map((trend, index) => ({
            id: index + 1,
            competitor: String(trend.competitor || 'Market keyword').trim(),
            platform: cleanTrendTerm(trend.platform || 'market').split(' ')[0] || 'market',
            topic: String(trend.topic || trend.keyword || 'Market trend').trim().slice(0, 120),
            body: String(trend.body || trend.topic || '').trim(),
            mediaUrl: '',
            engagementMetrics: String(trend.engagementMetrics || '').trim(),
            trendSignal: String(trend.trendSignal || trend.engagement || 'Search-backed trend signal').trim(),
            engagement: String(trend.engagementMetrics || trend.engagement || trend.trendSignal || 'Search-backed trend signal').trim(),
            searchKeyword: cleanTrendTerm(trend.keyword || trend.topic),
            sourceUrl: String(trend.sourceUrl || '').trim(),
            researchSource: 'grounded-search'
        })).filter(trend => trend.body || trend.topic);
    } catch (error) {
        console.warn('[Trends Agent] Grounded trend fallback failed.', error.message);
        return [];
    }
}

function runLast30DaysSearch(scriptPath, query, platformHint, keyword) {
    return new Promise((resolve) => {
        const safeQuery = String(query || '').replace(/["\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!scriptPath || !fs.existsSync(scriptPath)) {
            if (!missingLast30DaysScriptsLogged.has(String(scriptPath || 'missing'))) {
                missingLast30DaysScriptsLogged.add(String(scriptPath || 'missing'));
                console.warn(`[Trends Scraper] last30days script is not available at ${scriptPath || '(not configured)'}; using grounded search fallback.`);
            }
            return resolve([]);
        }

        console.log(`[Trends Scraper] Running ${platformHint} query: ${safeQuery}`);
        const pythonCommand = process.platform === 'win32' ? 'py' : 'python3';
        const pythonArgs = process.platform === 'win32'
            ? ['-3.12', scriptPath, safeQuery, '--emit=compact', '--quick']
            : [scriptPath, safeQuery, '--emit=compact', '--quick'];

        execFile(pythonCommand, pythonArgs, { timeout: 45000 }, (error, stdout) => {
            if (error) {
                console.error(`[Trends CLI Error:${platformHint}]`, error.message);
                return resolve([]);
            }

            try {
                const trends = parseCLIOutputToTrends(stdout, null, platformHint).map(trend => ({
                    ...trend,
                    engagement: trend.hasParsedEngagement
                        ? trend.engagement
                        : (trend.trendScore ? `Trend score ${trend.trendScore}` : "High engagement signal"),
                    searchQuery: safeQuery,
                    searchKeyword: keyword || safeQuery,
                    researchSource: 'last30days'
                }));
                resolve(trends);
            } catch (parseError) {
                console.error(`[Trends Parse Error:${platformHint}]`, parseError.message);
                resolve([]);
            }
        });
    });
}

// 4. Competitor Trends Scraper Endpoint
app.post('/api/trends', async (req, res) => {
    const {
        competitors,
        bizName,
        bizDesc,
        bizAudience,
        bizSwot,
        businessReport,
        competitorProfiles,
        agencyGoal,
        coreMessage
    } = req.body;
    
    try {
        const context = {
            competitors,
            bizName,
            bizDesc,
            bizAudience,
            bizSwot,
            businessReport,
            competitorProfiles,
            agencyGoal,
            coreMessage
        };

        console.log(`[Trends Agent] Building onboarding-aware keyword plan for research...`);
        const cacheKey = trendCacheKey(context);
        const keywordPlan = await buildTrendKeywordPlan(context);
        const researchQueries = buildTrendResearchQueries(keywordPlan, context);
        console.log(`[Trends Agent] Research queries:`, researchQueries.map(item => item.query));

        // Execute last30days CLI tool via Python 3.12 with platform-specific searches.
        const scriptPath = path.resolve('C:\\Users\\daved\\.gemini\\config\\plugins\\last30days-plugin\\skills\\last30days\\scripts\\last30days.py');
        const queryResults = await Promise.all(
            researchQueries.map(item => runLast30DaysSearch(scriptPath, item.query, item.platform, item.keyword))
        );

        const competitorList = (competitors || "market").split(",").map(c => c.trim()).filter(Boolean);
        const seen = new Set();
        const trends = queryResults.flat().map((trend, index) => {
            const key = `${trend.platform}:${trend.topic}:${trend.body}:${trend.sourceUrl || ''}`.toLowerCase();
            if (seen.has(key)) return null;
            seen.add(key);
            return {
                ...trend,
                id: index + 1,
                competitor: trend.competitor || competitorList[index % Math.max(competitorList.length, 1)] || "market"
            };
        }).filter(Boolean)
            .sort((a, b) => scoreTrendEngagement(b) - scoreTrendEngagement(a))
            .slice(0, 12);

        let finalTrends = trends;
        if (finalTrends.length === 0) {
            console.warn(`[Trends Scraper] No platform trends parsed from last30days. Trying grounded search synthesis.`);
            finalTrends = await researchGroundedSocialTrends(context, keywordPlan, 8);
        }

        const keywords = summarizeKeywordPerformance(keywordPlan, finalTrends);

        if (finalTrends.length > 0) {
            const platformMix = trends.reduce((acc, t) => {
                acc[t.platform] = (acc[t.platform] || 0) + 1;
                return acc;
            }, {});
            trendResultCache.set(cacheKey, {
                trends: finalTrends,
                keywords,
                searchedQueries: researchQueries.map(item => item.query),
                keywordPlan,
                cachedAt: new Date().toISOString()
            });
            console.log(`[Trends Scraper] Returning ${finalTrends.length} trends. Mix:`, platformMix);
            return res.json({
                trends: finalTrends,
                keywords,
                searchedQueries: researchQueries.map(item => item.query),
                keywordPlan
            });
        }

        const cached = trendResultCache.get(cacheKey);
        if (cached && Array.isArray(cached.trends) && cached.trends.length > 0) {
            console.warn(`[Trends Scraper] No new trends parsed; returning cached trend cards from ${cached.cachedAt}.`);
            return res.json({
                ...cached,
                keywords,
                searchedQueries: researchQueries.map(item => item.query),
                stale: true,
                warning: 'No new competitor posts were parsed, so the last successful trend cards were kept.'
            });
        }

        console.warn(`[Trends Scraper] No platform or grounded trends parsed.`);
        return res.json({
            trends: [],
            keywords,
            searchedQueries: researchQueries.map(item => item.query),
            keywordPlan
        });

    } catch (error) {
        console.error(`[Trends Error]`, error.message);
        res.status(502).json({ error: `Trend research failed: ${error.message}` });
    }
});

// Create downloads directory on startup for static media files
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}

// yt-dlp: Inspect Video Metadata
app.post('/api/inspect-video', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing video URL." });

    console.log(`[Asset Downloader] Inspecting video URL: ${url}`);
    const cmd = `yt-dlp --js-runtimes node --dump-json "${url}"`;

    exec(cmd, { timeout: 20000 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[Inspect Error]`, error.message);
            return res.status(500).json({ error: "Failed to inspect URL: " + error.message });
        }
        try {
            const meta = JSON.parse(stdout);
            res.json({
                title: meta.title || "Unknown Video",
                description: meta.description || "",
                duration: meta.duration || 0,
                uploader: meta.uploader || "Unknown",
                thumbnail: meta.thumbnail || "",
                url: url
            });
        } catch (e) {
            res.status(500).json({ error: "Failed to parse video metadata." });
        }
    });
});

// Helper to get predicted filename from yt-dlp
function getPredictedFilename(url, formatOption, outTemplate) {
    return new Promise((resolve, reject) => {
        const cmd = `yt-dlp --js-runtimes node --restrict-filenames -f "${formatOption}" --print filename -o "${outTemplate}" "${url}"`;
        exec(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
            if (error) return reject(error);
            resolve(stdout.trim());
        });
    });
}

function runYtDlpDownload(url, formatOption, outTemplate, timeout = 90000) {
    return new Promise((resolve, reject) => {
        const cmd = `yt-dlp --js-runtimes node --restrict-filenames -f "${formatOption}" -o "${outTemplate}" "${url}"`;
        exec(cmd, { timeout }, (error, stdout, stderr) => {
            if (error) return reject(error);
            resolve({ stdout, stderr });
        });
    });
}

async function getPredictedFilenameWithFallback(url, primaryFormat, fallbackFormat, outTemplate) {
    try {
        return await getPredictedFilename(url, primaryFormat, outTemplate);
    } catch (primaryError) {
        console.warn(`[yt-dlp] Filename prediction failed for ${primaryFormat}, retrying ${fallbackFormat}:`, primaryError.message);
        return getPredictedFilename(url, fallbackFormat, outTemplate);
    }
}

async function runYtDlpDownloadWithFallback(url, primaryFormat, fallbackFormat, outTemplate, timeout = 90000) {
    try {
        return await runYtDlpDownload(url, primaryFormat, outTemplate, timeout);
    } catch (primaryError) {
        console.warn(`[yt-dlp] Download failed for ${primaryFormat}, retrying ${fallbackFormat}:`, primaryError.message);
        return runYtDlpDownload(url, fallbackFormat, outTemplate, timeout);
    }
}

// yt-dlp: Download Video (best available, falling back to pre-merged)
app.post('/api/download-video', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing video URL." });

    console.log(`[Asset Downloader] Starting video download: ${url}`);
    const formatOption = "22/18/best[ext=mp4][vcodec^=avc1]/best[ext=mp4]";
    const fallbackFormat = "18/best";
    const outTemplate = "downloads/%(title)s.%(ext)s";

    try {
        const predictedPath = await getPredictedFilenameWithFallback(url, formatOption, fallbackFormat, outTemplate);
        const filename = path.basename(predictedPath);
        const localPath = path.join(downloadsDir, filename);

        // If file already exists, return immediately!
        if (fs.existsSync(localPath)) {
            console.log(`[Asset Downloader] File already cached: ${filename}`);
            return res.json({
                message: "Download completed (Cached)",
                filename: filename,
                downloadUrl: `/downloads/${filename}`
            });
        }

        runYtDlpDownloadWithFallback(url, formatOption, fallbackFormat, outTemplate, 90000)
            .then(() => {
            console.log(`[Asset Downloader] Download complete: ${filename}`);
            res.json({
                message: "Download completed successfully",
                filename: filename,
                downloadUrl: `/downloads/${filename}`
            });
            })
            .catch((error) => {
                console.error(`[Download Video Error]`, error.message);
                res.status(500).json({ error: "Video download failed: " + error.message });
            });
    } catch (err) {
        console.error(`[Download Video Path Error]`, err.message);
        res.status(500).json({ error: "Failed to initiate download: " + err.message });
    }
});

// yt-dlp: Extract Audio (MP3/M4A best audio stream)
app.post('/api/extract-audio', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing video URL." });

    console.log(`[Asset Downloader] Starting audio extraction: ${url}`);
    const formatOption = "bestaudio";
    const outTemplate = "downloads/%(title)s.%(ext)s";

    try {
        const predictedPath = await getPredictedFilename(url, formatOption, outTemplate);
        const filename = path.basename(predictedPath);
        const localPath = path.join(downloadsDir, filename);

        if (fs.existsSync(localPath)) {
            console.log(`[Asset Downloader] Audio file already cached: ${filename}`);
            return res.json({
                message: "Audio extracted (Cached)",
                filename: filename,
                downloadUrl: `/downloads/${filename}`
            });
        }

        const cmd = `yt-dlp --js-runtimes node --restrict-filenames -f "${formatOption}" -o "${outTemplate}" "${url}"`;
        exec(cmd, { timeout: 90000 }, (error, stdout, stderr) => {
            if (error) {
                console.error(`[Extract Audio Error]`, error.message);
                return res.status(500).json({ error: "Audio extraction failed: " + error.message });
            }
            console.log(`[Asset Downloader] Audio complete: ${filename}`);
            res.json({
                message: "Audio extraction completed successfully",
                filename: filename,
                downloadUrl: `/downloads/${filename}`
            });
        });
    } catch (err) {
        console.error(`[Extract Audio Path Error]`, err.message);
        res.status(500).json({ error: "Failed to initiate audio download: " + err.message });
    }
});

// yt-dlp: Extract and Clean Subtitle Transcript
app.post('/api/extract-transcript', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing video URL." });

    console.log(`[Asset Downloader] Starting transcript extraction: ${url}`);
    // Subtitles templates output will be saved as downloads/title.en.vtt or downloads/title.vtt
    const outTemplate = "downloads/%(title)s";

    try {
        const predictedPath = await getPredictedFilename(url, "best", outTemplate);
        const baseTitle = path.basename(predictedPath);

        // Run subtitle download
        const cmd = `yt-dlp --js-runtimes node --restrict-filenames --write-auto-subs --skip-download -o "${outTemplate}" "${url}"`;
        exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
            if (error) {
                console.error(`[Extract Subtitles Error]`, error.message);
                return res.status(500).json({ error: "Subtitle download failed: " + error.message });
            }

            // Find the vtt file in downloads
            const files = fs.readdirSync(downloadsDir);
            // Look for a file starting with baseTitle and ending with .vtt
            const vttFile = files.find(f => f.startsWith(baseTitle) && f.endsWith('.vtt'));

            if (!vttFile) {
                return res.status(404).json({ error: "No subtitles found or auto-generated for this video." });
            }

            const vttPath = path.join(downloadsDir, vttFile);
            const vttContent = fs.readFileSync(vttPath, 'utf8');

            // Parse and clean VTT content to clean text transcript
            const cleanText = parseVTTTranscript(vttContent);
            console.log(`[Asset Downloader] Subtitle transcription completed for: ${vttFile}`);

            res.json({
                filename: vttFile,
                transcript: cleanText
            });
        });
    } catch (err) {
        console.error(`[Extract Transcript Path Error]`, err.message);
        res.status(500).json({ error: "Failed to initiate transcript download: " + err.message });
    }
});

// Helper: Parse and clean WebVTT subtitle formatting
function parseVTTTranscript(vttText) {
    const lines = vttText.split(/\r?\n/);
    const cleanedParagraphs = [];
    let lastLine = "";

    lines.forEach(line => {
        let trimmed = line.trim();
        // Skip metadata header, timing lines, and empty lines
        if (
            !trimmed ||
            trimmed.startsWith("WEBVTT") ||
            trimmed.startsWith("Kind:") ||
            trimmed.startsWith("Language:") ||
            trimmed.includes("-->") ||
            trimmed.startsWith("Style:") ||
            trimmed.startsWith("Region:")
        ) {
            return;
        }

        // Clean out inline tags like <c> or </c>
        trimmed = trimmed.replace(/<[^>]*>/g, '');

        // Deduplicate consecutive lines (WebVTT often repeats lines with word-by-word highlights)
        if (trimmed === lastLine) {
            return;
        }

        cleanedParagraphs.push(trimmed);
        lastLine = trimmed;
    });

    // Merge short segments, remove trailing spacing, deduplicate overlapping duplicates
    const merged = cleanedParagraphs.filter((val, index, self) => {
        // Simple overlap filter: if a line is a subset of the previous one or vice versa, keep only the unique
        if (index > 0 && self[index - 1].includes(val)) return false;
        return true;
    }).join(" ");

    return merged || "No readable captions in subtitle file.";
}

// yt-dlp: Auto-Search, Ingest, and Download a Viral Video
app.post('/api/auto-ingest-trends-video', async (req, res) => {
    const { bizDesc, bizAudience, bizName } = req.body;

    console.log(`[Auto-Ingester] Request received. Optimizing search query based on business profile...`);

    const queryPrompt = `You are an AI research agent for '${bizName || 'Client Business'}'.
Our business description: ${bizDesc || 'Client business description not provided.'}
Target Audience: ${bizAudience || 'Target audience not provided.'}

Generate a short 3-4 word YouTube search query to find trending and viral short tips, guides, or hacks videos that our target audience finds highly engaging. Focus on topics like productivity hacks, realtor burnout, transaction coordination tips, or real estate tech tools.
Output ONLY the query. Do not wrap in quotes or add comments.`;

    let searchQuery = "business tips shorts";
    try {
        const rawQuery = await queryGemini(queryPrompt);
        searchQuery = rawQuery.trim().replace(/["']/g, "");
        console.log(`[Auto-Ingester] Optimized search topic: "${searchQuery}"`);
    } catch (geminiErr) {
        console.warn(`[Auto-Ingester] Gemini search query optimization failed. Falling back to default query.`, geminiErr.message);
    }

    // Now, run yt-dlp ytsearch1 to get the top matching video URL and metadata!
    const searchCmd = `yt-dlp --js-runtimes node --flat-playlist --dump-json "ytsearch1:${searchQuery} shorts"`;
    console.log(`[Auto-Ingester] Running search command: ${searchCmd}`);

    exec(searchCmd, { timeout: 20000 }, async (searchError, searchStdout, searchStderr) => {
        if (searchError) {
            console.error(`[Auto-Ingester Search Error]`, searchError.message);
            return res.status(500).json({ error: "Failed to search trending videos: " + searchError.message });
        }

        let videoMeta = null;
        try {
            videoMeta = JSON.parse(searchStdout);
        } catch (e) {
            console.error(`[Auto-Ingester JSON Parse Error]`, e.message);
            return res.status(500).json({ error: "Failed to parse searched video metadata." });
        }

        const videoUrl = videoMeta.webpage_url || videoMeta.url;
        if (!videoUrl) {
            return res.status(404).json({ error: "No video matching the search topic was found." });
        }

        console.log(`[Auto-Ingester] Found video: "${videoMeta.title}" (${videoUrl}). Starting download and transcription...`);

        // Execute download and subtitle download together or sequentially.
        const formatOption = "22/18/best[ext=mp4][vcodec^=avc1]/best[ext=mp4]";
        const fallbackFormat = "18/best";
        const outTemplate = "downloads/%(title)s.%(ext)s";
        const subTemplate = "downloads/%(title)s";

        try {
            const predictedPath = await getPredictedFilenameWithFallback(videoUrl, formatOption, fallbackFormat, outTemplate);
            const baseTitle = path.basename(predictedPath);
            
            // Clean filename helper to remove spaces and special characters matching restrict-filenames
            const cleanTitle = baseTitle.replace(/\.[^/.]+$/, "");
            
            // 1. Download video file if not cached
            runYtDlpDownloadWithFallback(videoUrl, formatOption, fallbackFormat, outTemplate, 90000)
                .then(() => {
                // Scan files in downloads directory to find the actual downloaded video file
                const files = fs.readdirSync(downloadsDir);
                const downloadedFile = files.find(f => f.startsWith(cleanTitle) && !/\.f\d+\./.test(f) && f.endsWith('.mp4')) ||
                                       files.find(f => f.startsWith(cleanTitle) && !/\.f\d+\./.test(f) && (f.endsWith('.mp4') || f.endsWith('.webm')));
                const filename = downloadedFile || (cleanTitle + ".mp4");

                console.log(`[Auto-Ingester] Video downloaded successfully: ${filename}`);

                // 2. Fetch subtitles for transcription
                const subCmd = `yt-dlp --js-runtimes node --restrict-filenames --write-auto-subs --skip-download -o "${subTemplate}" "${videoUrl}"`;
                exec(subCmd, { timeout: 30000 }, (subError) => {
                    if (subError) {
                        console.error(`[Auto-Ingester Sub Error]`, subError.message);
                        // Even if subtitles fail, return the video download
                        return res.json({
                            message: "Ingested video successfully (No transcript)",
                            title: videoMeta.title,
                            uploader: videoMeta.uploader,
                            url: videoUrl,
                            filename: filename,
                            downloadUrl: `/downloads/${filename}`,
                            transcript: "No auto-generated captions could be found for this video."
                        });
                    }

                    // Find the vtt file in downloads
                    const vttFile = files.find(f => f.startsWith(cleanTitle) && f.endsWith('.vtt')) || 
                                   fs.readdirSync(downloadsDir).find(f => f.startsWith(cleanTitle) && f.endsWith('.vtt'));

                    let cleanTranscript = "No transcript could be parsed.";
                    if (vttFile) {
                        const vttPath = path.join(downloadsDir, vttFile);
                        const vttContent = fs.readFileSync(vttPath, 'utf8');
                        cleanTranscript = parseVTTTranscript(vttContent);
                    }

                    console.log(`[Auto-Ingester] Video ingestion cycle completed for: "${videoMeta.title}"`);
                    res.json({
                        message: "Ingested and transcribed video successfully",
                        title: videoMeta.title,
                        uploader: videoMeta.uploader,
                        url: videoUrl,
                        filename: filename,
                        downloadUrl: `/downloads/${filename}`,
                        transcript: cleanTranscript
                    });
                });
                })
                .catch((dlError) => {
                    console.error(`[Auto-Ingester DL Error]`, dlError.message);
                    res.status(500).json({ error: "Video download failed: " + dlError.message });
                });
        } catch (dlPathErr) {
            res.status(500).json({ error: "Failed to resolve video download path: " + dlPathErr.message });
        }
    });
});

// 6. AI Spokesperson Avatar Generation
app.post('/api/generate-avatar', async (req, res) => {
    const { postId, listName, avatarId, script, style, sourceMediaUrl, sourceUrl } = req.body;
    if (!avatarId) {
        return res.status(400).json({ error: "Missing Avatar ID." });
    }

    console.log(`[Avatar Studio] Request received to render talking avatar for character: "${avatarId}"`);

    const avatarWebhookUrl = process.env.AVATAR_WEBHOOK_URL;
    if (!avatarWebhookUrl) {
        console.log(`[Avatar Studio] No AVATAR_WEBHOOK_URL configured. Falling back to direct stock spokesperson video CDN (Free Mode).`);
        
        const stockVideos = {
            sarah: "/downloads/avatar_sarah.mp4",
            john: "/downloads/avatar_john.mp4",
            chloe: "/downloads/avatar_chloe.mp4",
            david: "/downloads/avatar_david.mp4"
        };

        const stockUrl = stockVideos[avatarId.toLowerCase()] || stockVideos.sarah;
        const finalUrl = `${stockUrl}?avatar_${avatarId.toLowerCase()}`;

        return res.json({
            success: true,
            message: "Avatar video rendered successfully (Free Mode)",
            mediaUrl: finalUrl,
            script: script
        });
    }

    try {
        const response = await fetch(avatarWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                postId,
                listName,
                avatarId,
                style,
                script,
                sourceMediaUrl,
                sourceUrl
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Avatar renderer returned HTTP ${response.status}: ${text.slice(0, 300)}`);
        }

        const data = await response.json();
        if (!data.mediaUrl) {
            throw new Error("Avatar renderer did not return a mediaUrl.");
        }

        res.json({
            success: true,
            message: "Avatar video rendered successfully",
            mediaUrl: data.mediaUrl,
            script: data.script || script
        });
    } catch (err) {
        console.error(`[AI Avatar Error] Rendering failed:`, err);
        res.status(502).json({ error: err.message });
    }
});

// Helper: Parse last30days CLI output to trends format
function parseCLIOutputToTrends(stdout, competitorsList, platformHint) {
    const competitors = (competitorsList || "market").split(",").map(c => c.trim());
    const trends = [];
    
    // Split by "### "
    const parts = stdout.split(/\n###\s+/);
    if (parts.length <= 1) return [];

    // Skip the first part (preamble)
    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part.includes("## Stats")) {
            break;
        }

        const lines = part.split("\n");
        const headerLine = lines[0].trim();
        
        const headerMatch = headerLine.match(/^(\d+)\.\s+(.*)$/);
        if (!headerMatch) continue;

        const topicId = parseInt(headerMatch[1]);
        const headerText = headerMatch[2].trim();
        const scoreMatch = headerText.match(/\(score\s+(\d+)/i);
        const sourceMatch = headerText.match(/sources:\s*([^)]+)/i);
        const trendScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
        let topicTitle = headerText.replace(/\s+\(score\s+.*$/i, '').trim();
        const sourcesStr = (sourceMatch && sourceMatch[1] ? sourceMatch[1] : "").toLowerCase();

        let body = "";
        let platform = platformHint || "instagram";
        let username = "";
        let engagementStr = "";

        const rand = Math.random();
        if (sourcesStr.includes("youtube")) {
            platform = "youtube";
        } else if (sourcesStr.includes("tiktok") || sourcesStr.includes("instagram")) {
            platform = sourcesStr.includes("tiktok") ? "tiktok" : "instagram";
        } else if (sourcesStr.includes("facebook")) {
            platform = "facebook";
        } else if (sourcesStr.includes("x") || sourcesStr.includes("twitter")) {
            platform = "twitter";
        } else if (sourcesStr.includes("reddit")) {
            platform = "reddit";
        } else if (!platformHint) {
            // Keep vague general results weighted toward consumer social/video.
            if (rand < 0.35) platform = "instagram";
            else if (rand < 0.65) platform = "youtube";
            else if (rand < 0.85) platform = "facebook";
            else platform = "twitter";
        }

        for (let j = 1; j < lines.length; j++) {
            const line = lines[j].trim();
            
            if (line.startsWith("- Evidence:")) {
                body = line.replace("- Evidence:", "").trim();
            } else if (line.includes("|") && (line.includes("@") || line.includes("views") || line.includes("likes") || line.includes("score:"))) {
                const parts = line.split("|");
                if (parts[1]) {
                    username = parts[1].trim();
                }
                const statsPart = parts.find(p => p.includes("[") && p.includes("]") && (p.includes("likes") || p.includes("views") || p.includes("rt") || p.includes("re")));
                if (statsPart) {
                    engagementStr = statsPart.replace(/[\[\]]/g, "").trim();
                }
            }
        }

        if (!body) {
            for (let j = 1; j < lines.length; j++) {
                const line = lines[j].trim();
                if (line && !line.startsWith("-") && !line.startsWith("1.") && !line.startsWith("2.") && !line.startsWith("3.")) {
                    body = line;
                    break;
                }
            }
        }
        if (!body) body = topicTitle;

        body = body.replace(/^["']|["']$/g, "").trim();

        let competitor = competitors[i % competitors.length];
        for (const comp of competitors) {
            const domainWord = comp.replace(/\.(com|net|org|app)/, "");
            if (body.toLowerCase().includes(domainWord.toLowerCase())) {
                competitor = comp;
                break;
            }
        }

        if (topicTitle.length > 80) {
            topicTitle = topicTitle.substring(0, 80) + "...";
        }

        let engagement = "High engagement signal";
        if (engagementStr) {
            engagement = engagementStr
                .replace(/likes?/g, " Likes")
                .replace(/views?/g, " Views")
                .replace(/cmts?/g, " Comments")
                .replace(/rt/g, " Reposts")
                .replace(/re/g, " Replies")
                .replace(/,/g, " · ");
        } else {
            const likes = Math.floor(Math.random() * 200) + 15;
            const comments = Math.floor(likes * 0.15) + 2;
            engagement = `${likes} Likes · ${comments} Comments`;
        }

        const mockImages = [
            "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=400&h=250&q=80",
            "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&h=250&q=80",
            "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&h=250&q=80",
            "https://images.unsplash.com/photo-1560520653-9e0e4c89fd11?auto=format&fit=crop&w=400&h=250&q=80",
            "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=400&h=250&q=80"
        ];
        const youtubeImages = [
            "https://images.unsplash.com/photo-1558036117-15d82a90b9b1?auto=format&fit=crop&w=400&h=250&q=80",
            "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=400&h=250&q=80"
        ];
        const mediaUrl = platform === "youtube"
            ? youtubeImages[topicId % youtubeImages.length]
            : mockImages[topicId % mockImages.length];

        trends.push({
            id: topicId,
            competitor,
            platform,
            topic: topicTitle,
            body,
            mediaUrl,
            engagement,
            trendScore,
            hasParsedEngagement: Boolean(engagementStr)
        });
    }

    return trends;
}

// Legacy trend examples, not used by the live trend endpoint.
function getMockTrends(competitorsList) {
    const competitors = (competitorsList || "market").split(",").map(c => c.trim());
    return [
        {
            id: 1,
            competitor: competitors[0] || "market",
            platform: "linkedin",
            topic: "The Admin Time Drain in Real Estate Listings",
            body: "Realtors, stop spending your weekends doing paperwork. Chasing compliance signatures is costing you deals. Focus on listings, delegate the compliance files.",
            mediaUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&h=250&q=80",
            engagement: "485 Likes · 42 Comments"
        },
        {
            id: 2,
            competitor: competitors[1] || competitors[0] || "market",
            platform: "twitter",
            topic: "Compliance Checklist Stress at midnight",
            body: "Missing broker signatures at 11 PM before a closing is the worst feeling. Auto-verify files to get deals closed with zero admin headaches.",
            mediaUrl: "https://images.unsplash.com/photo-1560520653-9e0e4c89fd11?auto=format&fit=crop&w=400&h=250&q=80",
            engagement: "1,220 Likes · 18 Reposts"
        }
    ];
}

// 5. Rewrite Trend for Client Endpoint
app.post('/api/rewrite-trend', async (req, res) => {
    const { bizName, bizDesc, bizOffers, trendBody, platform } = req.body;
    if (!trendBody) {
        return res.status(400).json({ error: "Trend body is required" });
    }

    const prompt = `You are a professional social media ghostwriter. 
Take the following competitor's high-performing post:
"${trendBody}"

Rewrite this post to promote our client: '${bizName || 'Client Business'}'.
Our client description: ${bizDesc}
Our client offers: ${bizOffers || 'compliance automation'}

Make it highly engaging, optimized for ${platform || 'LinkedIn'}, and focus on the same core message/pain point as the original post, but position our client as the ultimate solution. 
Include 3 relevant hashtags. Keep it under 280 characters. Output only the rewritten post body text.`;

    try {
        console.log(`[Ghostwriter Agent] Rewriting competitor trend for ${bizName}...`);
        const rewrittenText = await queryGemini(prompt);
        res.json({ text: rewrittenText.trim() });
    } catch (error) {
        console.error(`[Rewrite Error]`, error.message);
        res.status(500).json({ error: `Rewrite failed: ${error.message}` });
    }
});

// 3. Gemini Secure API Proxy Endpoint
app.post('/api/gemini-proxy', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
    }

    try {
        console.log(`[Gemini Proxy] Querying Gemini for campaign or social content...`);
        const responseText = await queryGemini(prompt);
        res.json({ text: responseText });
    } catch (error) {
        console.error(`[Gemini Proxy Error]`, error.message);
        res.status(500).json({ error: `AI query failed: ${error.message}` });
    }
});

// Mailgun outbound sender utility
function getPublicAppUrl() {
    if (!PUBLIC_APP_URL) {
        if (EMAIL_COMPLIANCE_REQUIRED) {
            throw new Error('PUBLIC_APP_URL is required before outbound email can be sent.');
        }
        return '';
    }
    return PUBLIC_APP_URL;
}

function buildUnsubscribeUrl(email) {
    const baseUrl = getPublicAppUrl();
    if (!baseUrl) return '';
    return `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(String(email || '').trim().toLowerCase())}`;
}

function appendEmailComplianceFooter(text, recipientEmail) {
    if (EMAIL_COMPLIANCE_REQUIRED && !OUTBOUND_POSTAL_ADDRESS) {
        throw new Error('OUTBOUND_POSTAL_ADDRESS is required before outbound email can be sent.');
    }

    const unsubscribeUrl = buildUnsubscribeUrl(recipientEmail);
    const footerLines = [];
    if (unsubscribeUrl) footerLines.push(`Unsubscribe: ${unsubscribeUrl}`);
    if (OUTBOUND_POSTAL_ADDRESS) footerLines.push(`Mailing address: ${OUTBOUND_POSTAL_ADDRESS}`);

    if (footerLines.length === 0) return String(text || '');
    return `${String(text || '').trim()}\n\n--\n${footerLines.join('\n')}`;
}

async function sendMailgunEmail({ to, subject, text }) {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    const from = process.env.MAILGUN_FROM_EMAIL || `Sales Agent <sales@${domain}>`;
    const recipientEmail = String(to || '').trim().toLowerCase();

    if (!recipientEmail) {
        throw new Error('Recipient email is required');
    }

    if (db.isEmailDnc(recipientEmail)) {
        throw new Error(`Refusing to email DNC recipient: ${recipientEmail}`);
    }
    
    if (!apiKey || !domain) {
        throw new Error('Mailgun API key or domain is not configured. Email was not sent.');
    }

    const unsubscribeUrl = buildUnsubscribeUrl(recipientEmail);
    const finalText = appendEmailComplianceFooter(text, recipientEmail);
    
    const url = `https://api.mailgun.net/v3/${domain}/messages`;
    const auth = Buffer.from(`api:${apiKey}`).toString('base64');
    
    const params = new URLSearchParams();
    params.append('from', from);
    params.append('to', recipientEmail);
    params.append('subject', subject);
    params.append('text', finalText);
    if (unsubscribeUrl) {
        params.append('h:List-Unsubscribe', `<${unsubscribeUrl}>`);
        params.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');
    }
    
    const response = await axios.post(url, params, {
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    
    return response.data;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableMailgunError(error) {
    const status = error && error.response ? error.response.status : null;
    if (status === 429) return true;
    if (status >= 500 && status <= 599) return true;
    return Boolean(error && error.request && !error.response);
}

async function sendMailgunEmailWithRetry(message, { attempts = 3, baseDelayMs = 1500 } = {}) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await sendMailgunEmail(message);
        } catch (err) {
            lastError = err;
            if (attempt >= attempts || !isRetryableMailgunError(err)) {
                throw err;
            }
            const delayMs = baseDelayMs * attempt;
            console.warn(`[Mailgun Retry] Attempt ${attempt} failed, retrying in ${delayMs}ms: ${err.message}`);
            await sleep(delayMs);
        }
    }
    throw lastError;
}

function getConfiguredCampaignChain(settings = readCrmSettings()) {
    return [
        settings.firstCampaignId,
        settings.secondCampaignId,
        settings.thirdCampaignId
    ].filter(Boolean);
}

function getCampaignOrder(campaignId, settings = readCrmSettings()) {
    const index = getConfiguredCampaignChain(settings).findIndex(id => String(id) === String(campaignId));
    return index >= 0 ? index + 1 : 1;
}

function getNextCampaignId(currentCampaignId, settings = readCrmSettings()) {
    const chain = getConfiguredCampaignChain(settings);
    const index = chain.findIndex(id => String(id) === String(currentCampaignId));
    return index >= 0 ? chain[index + 1] || null : null;
}

function parseCampaignDelayMs(delayText, fallbackMs = 24 * 60 * 60 * 1000) {
    const text = String(delayText || '').toLowerCase();
    if (text.includes('immediate')) return 0;
    const value = parseInt(text, 10);
    if (!value) return fallbackMs;
    if (text.includes('hour')) return value * 60 * 60 * 1000;
    if (text.includes('minute')) return value * 60 * 1000;
    return value * 24 * 60 * 60 * 1000;
}

function selectDefaultCampaignCta(settings = readCrmSettings(), bizWebsite = '') {
    return settings.demoVideoUrl || settings.youtubePageUrl || settings.salesPageUrl || bizWebsite || '';
}

function applySalesAssetPlaceholders(text, settings = readCrmSettings(), bizWebsite = '', campaign = {}) {
    const campaignCta = campaign.videoAsset || selectDefaultCampaignCta(settings, bizWebsite);
    const bookingFallback = settings.bookingLink || settings.salesPageUrl || bizWebsite || 'reply with a couple times that work for you';
    return String(text || '')
        .replace(/\[CTA Link\]/g, campaignCta)
        .replace(/\[Booking Link\]/g, bookingFallback)
        .replace(/\[Calendar Link\]/g, bookingFallback)
        .replace(/\[Demo Link\]/g, settings.demoVideoUrl || settings.youtubePageUrl || campaignCta)
        .replace(/\[YouTube Link\]/g, settings.youtubePageUrl || settings.demoVideoUrl || campaignCta)
        .replace(/\[Sales Page\]/g, settings.salesPageUrl || campaignCta)
        .replace(/\[Website\]/g, bizWebsite || settings.salesPageUrl || campaignCta);
}

function personalizeCampaignBody(template, lead, campaign, bizName, bizWebsite, settings = readCrmSettings()) {
    const personalized = String(template || '')
        .replace(/\[Lead Name\]/g, (lead.name || '').split(' ')[0] || lead.name || 'there')
        .replace(/\[Agent Name\]/g, (lead.name || '').split(' ')[0] || lead.name || 'there')
        .replace(/\[Your Name\]/g, bizName || 'our team');
    return applySalesAssetPlaceholders(personalized, settings, bizWebsite, campaign);
}

function getNextStepDueAt(campaign, currentStep) {
    const nextStep = campaign.steps[currentStep];
    if (!nextStep) return null;
    return new Date(Date.now() + parseCampaignDelayMs(nextStep.delay)).toISOString();
}

async function sendCampaignStepToLead({ lead, campaign, enrollment, bizName = 'our team', bizWebsite = '', settings = readCrmSettings() }) {
    const nextStepNumber = (enrollment.currentStep || 0) + 1;
    const step = campaign.steps[nextStepNumber - 1];
    if (!step) {
        db.updateEnrollment(enrollment.id, {
            status: 'Completed',
            completedAt: new Date().toISOString(),
            nextActionAt: null
        });
        return { sent: false, completed: true };
    }

    const customizedBody = personalizeCampaignBody(step.body, lead, campaign, bizName, bizWebsite, settings);
    await sendMailgunEmail({
        to: lead.email,
        subject: step.subject,
        text: customizedBody
    });

    const nowIso = new Date().toISOString();
    const nextActionAt = nextStepNumber < campaign.steps.length
        ? getNextStepDueAt(campaign, nextStepNumber)
        : getNextStepDueAt(campaign, nextStepNumber - 1);

    lead.stage = 'Emailed';
    lead.currentCampaignId = campaign.id;
    lead.currentCampaignStep = nextStepNumber;
    lead.lastStepTime = Date.now();
    if (!lead.history) lead.history = [];
    lead.history.push({
        sender: 'agent',
        time: new Date().toLocaleTimeString(),
        text: `[OUTBOUND EMAIL - CAMPAIGN ${enrollment.campaignOrder} STEP ${step.step || nextStepNumber}]\nSubject: ${step.subject}\n\n${customizedBody}`
    });
    db.updateLead(lead);

    db.updateEnrollment(enrollment.id, {
        currentStep: nextStepNumber,
        lastSentAt: nowIso,
        nextActionAt
    });

    return { sent: true, completed: false, stepNumber: nextStepNumber };
}

function enrollLeadInCampaign(lead, campaignId, campaignOrder, nextActionAt = null) {
    const enrollmentId = db.insertEnrollment({
        leadId: lead.id,
        campaignId,
        campaignOrder,
        status: 'Active',
        currentStep: 0,
        nextActionAt
    });
    if (!lead.history) lead.history = [];
    lead.history.push({
        sender: 'agent-action',
        time: 'Just Now',
        text: `Enrolled in Campaign ${campaignOrder}.`
    });
    db.updateLead(lead);
    return db.getActiveEnrollmentForLead(lead.id) || { id: enrollmentId, leadId: lead.id, campaignId, campaignOrder, status: 'Active', currentStep: 0, nextActionAt };
}

async function enrollAndSendScrapedLeads({ campaignId, limit = 1000, bizName, bizWebsite, settings = readCrmSettings() }) {
    const campaign = db.getCampaignById(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const targetLeads = db.getLeads({ stage: 'Scraped', limit });
    const campaignOrder = getCampaignOrder(campaignId, settings);
    let sentCount = 0;
    let failedCount = 0;

    for (const lead of targetLeads) {
        try {
            const enrollment = enrollLeadInCampaign(lead, campaignId, campaignOrder, new Date().toISOString());
            await sendCampaignStepToLead({ lead, campaign, enrollment, bizName, bizWebsite, settings });
            sentCount++;
        } catch (err) {
            failedCount++;
            console.error(`[Campaign Send] Failed for ${lead.email}:`, err.message);
        }
    }

    return { targetLeadsCount: targetLeads.length, sentCount, failedCount };
}

async function processDueCampaignEnrollments({ limit = 50, bizName = 'our team', bizWebsite = '' } = {}) {
    const settings = readCrmSettings();
    if (!settings.autoAdvanceCampaigns) return { processed: 0, sent: 0, transitioned: 0, skipped: 0 };

    const dueEnrollments = db.getDueEnrollments(new Date().toISOString(), limit);
    let processed = 0;
    let sent = 0;
    let transitioned = 0;
    let skipped = 0;

    for (const enrollment of dueEnrollments) {
        processed++;
        const lead = db.getLeadById(enrollment.leadId);
        const campaign = db.getCampaignById(enrollment.campaignId);
        if (!lead || !campaign) {
            db.updateEnrollment(enrollment.id, { status: 'Paused', nextActionAt: null });
            skipped++;
            continue;
        }

        if (['Two-Way Conversation', 'Needs Human Action', 'Quarantined', 'DNC', 'Opted Out'].includes(lead.stage)) {
            db.updateEnrollment(enrollment.id, { status: 'Paused', nextActionAt: null });
            skipped++;
            continue;
        }

        if ((enrollment.currentStep || 0) >= campaign.steps.length) {
            db.updateEnrollment(enrollment.id, {
                status: 'Completed',
                completedAt: new Date().toISOString(),
                nextActionAt: null
            });
            const nextCampaignId = getNextCampaignId(campaign.id, settings);
            if (nextCampaignId) {
                const nextOrder = getCampaignOrder(nextCampaignId, settings);
                enrollLeadInCampaign(lead, nextCampaignId, nextOrder, new Date().toISOString());
                transitioned++;
            }
            continue;
        }

        try {
            const result = await sendCampaignStepToLead({ lead, campaign, enrollment, bizName, bizWebsite, settings });
            if (result.sent) sent++;
        } catch (err) {
            skipped++;
            console.error(`[Campaign Worker] Failed for enrollment ${enrollment.id}:`, err.message);
        }
    }

    return { processed, sent, transitioned, skipped };
}

async function runCrmPipelineAutomation(trigger = 'manual') {
    if (pipelineWorkerRunning) {
        return { skipped: true, reason: 'Pipeline worker already running' };
    }

    pipelineWorkerRunning = true;
    const summary = { trigger, scraped: 0, enrolled: 0, sent: 0, transitioned: 0, skipped: 0, warnings: [] };

    try {
        const settings = readCrmSettings();
        const today = new Date().toISOString().slice(0, 10);

        if (settings.dailyScrapeEnabled && settings.dailyScrapeQuery && settings.lastDailyScrapeDate !== today) {
            try {
                const count = Math.min(Math.max(parseInt(settings.dailyLeadTarget, 10) || 25, 1), 100);
                const scrapeResult = await runLeadScrape(settings.dailyScrapeQuery, count, (phase, message) => {
                    console.log(`[Daily Scrape] ${phase}: ${message}`);
                });
                summary.scraped = scrapeResult.leads.length;
                if (scrapeResult.warnings && scrapeResult.warnings.length) {
                    summary.warnings.push(`daily-scrape: ${scrapeResult.warnings.join(' | ')}`);
                }
                writeCrmSettings({ ...settings, lastDailyScrapeDate: today });
            } catch (err) {
                summary.warnings.push(`daily-scrape: ${err.message}`);
            }
        }

        const latestSettings = readCrmSettings();
        if (latestSettings.autoEnrollScrapedLeads && latestSettings.firstCampaignId) {
            const result = await enrollAndSendScrapedLeads({
                campaignId: latestSettings.firstCampaignId,
                limit: latestSettings.dailyLeadTarget || 100,
                settings: latestSettings
            });
            summary.enrolled = result.targetLeadsCount;
            summary.sent += result.sentCount;
            summary.skipped += result.failedCount;
        }

        const dueResult = await processDueCampaignEnrollments();
        summary.sent += dueResult.sent || 0;
        summary.transitioned += dueResult.transitioned || 0;
        summary.skipped += dueResult.skipped || 0;

        return summary;
    } finally {
        pipelineWorkerRunning = false;
    }
}

// Unsubscribe Endpoint
app.get('/api/unsubscribe', (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).send('Email is required');
    
    try {
        db.addEmailToDnc(email, 'Unsubscribed via email link');
        res.send('<h1>You have been successfully unsubscribed.</h1><p>You will no longer receive any automated outreach from our team.</p>');
    } catch (err) {
        res.status(500).send('An error occurred. Please try again.');
    }
});

function getMailgunSignatureFields(body = {}) {
    const signatureBlock = body.signature && typeof body.signature === 'object' ? body.signature : {};
    return {
        timestamp: String(signatureBlock.timestamp || body.timestamp || '').trim(),
        token: String(signatureBlock.token || body.token || '').trim(),
        signature: String(signatureBlock.signature || body.signature || '').trim()
    };
}

function cleanupWebhookReplayTokens(nowMs = Date.now()) {
    for (const [token, expiresAt] of webhookReplayTokens.entries()) {
        if (expiresAt <= nowMs) webhookReplayTokens.delete(token);
    }
}

function verifyMailgunWebhook(req, res, next) {
    if (!REQUIRE_MAILGUN_WEBHOOK_SIGNATURE) return next();

    if (!MAILGUN_WEBHOOK_SIGNING_KEY) {
        console.error('[Inbound Webhook] MAILGUN_WEBHOOK_SIGNING_KEY is not configured.');
        return res.status(503).json({ error: 'Webhook verification is not configured.' });
    }

    const { timestamp, token, signature } = getMailgunSignatureFields(req.body || {});
    if (!timestamp || !token || !signature) {
        return res.status(401).json({ error: 'Missing Mailgun webhook signature.' });
    }

    const timestampMs = Number(timestamp) * 1000;
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 15 * 60 * 1000) {
        return res.status(401).json({ error: 'Expired Mailgun webhook signature.' });
    }

    cleanupWebhookReplayTokens();
    if (webhookReplayTokens.has(token)) {
        return res.status(401).json({ error: 'Replay webhook token rejected.' });
    }

    const expected = crypto
        .createHmac('sha256', MAILGUN_WEBHOOK_SIGNING_KEY)
        .update(`${timestamp}${token}`)
        .digest('hex');

    if (!timingSafeEqualString(signature, expected)) {
        return res.status(401).json({ error: 'Invalid Mailgun webhook signature.' });
    }

    webhookReplayTokens.set(token, Date.now() + 15 * 60 * 1000);
    return next();
}

// Mailgun Inbound Webhook
app.post('/api/webhooks/inbound-email', mailgunUpload.any(), verifyMailgunWebhook, async (req, res) => {
    try {
        const extractEmail = (value) => {
            if (!value) return null;
            const raw = Array.isArray(value) ? value[0] : String(value);
            const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
            return match ? match[0].toLowerCase().trim() : raw.toLowerCase().trim();
        };

        const sender = extractEmail(req.body.sender || req.body.from || req.body.From);
        const recipient = extractEmail(req.body.recipient || req.body.to || req.body.To);
        const subject = req.body.subject || req.body.Subject || '';
        const bodyText = req.body['stripped-text'] || req.body['body-plain'] || req.body.text || req.body.Text || '';
        
        console.log(`[Inbound Webhook] Received email from: ${sender} to: ${recipient}. Subject: "${subject}"`);
        
        if (!sender) {
            console.warn(`[Inbound Webhook] Missing sender. Payload keys: ${Object.keys(req.body || {}).join(', ')}`);
            return res.status(400).json({ error: 'Missing sender email' });
        }
        
        const lead = db.getLeadByEmail(sender);
        if (!lead) {
            console.warn(`[Inbound Webhook] Received reply from unknown sender: ${sender}`);
            return res.json({ success: true, message: 'Sender not found in CRM' });
        }
        
        if (!lead.history) lead.history = [];
        lead.history.push({
            sender: "lead",
            time: new Date().toLocaleTimeString(),
            text: bodyText.trim()
        });
        
        lead.stage = "Two-Way Conversation";
        
        const settings = readCrmSettings();
        if (settings.autoPauseOnReply) {
            lead.currentCampaignId = null;
            lead.currentCampaignStep = null;
            lead.lastStepTime = null;
            db.pauseLeadEnrollments(lead.id, 'Paused');
            lead.history.push({
                sender: "agent-action",
                time: "Just Now",
                text: "Lead replied. Campaign outreach auto-paused."
            });
        }
        
        // Auto-detect unsubscribe keywords
        const lowerBody = bodyText.toLowerCase();
        const unsubKeywords = ['unsubscribe', 'stop', 'remove me', 'please remove', 'don\'t email', 'opt out', 'opt-out'];
        const isUnsub = unsubKeywords.some(keyword => lowerBody.includes(keyword));
        
        if (isUnsub) {
            lead.stage = "Quarantined";
            db.addEmailToDnc(lead.email, `Auto-detected unsubscribe in email: "${bodyText.substring(0, 100)}..."`);
            lead.history.push({
                sender: "agent-action",
                time: "Just Now",
                text: "Lead opted out. Email added to DNC list."
            });
            db.updateLead(lead);
            console.log(`[Inbound Webhook] Lead ${lead.name} (${lead.email}) requested unsubscribe. Opted out.`);
            return res.json({ success: true, message: 'Unsubscribed' });
        }
        
        const salesAssetContext = [
            settings.bookingLink ? `Booking/calendar link: ${settings.bookingLink}` : 'Booking/calendar link: not configured',
            settings.demoVideoUrl ? `Default demo video link: ${settings.demoVideoUrl}` : 'Default demo video link: not configured',
            settings.youtubePageUrl ? `YouTube page/channel: ${settings.youtubePageUrl}` : 'YouTube page/channel: not configured',
            settings.salesPageUrl ? `Sales page: ${settings.salesPageUrl}` : 'Sales page: not configured'
        ].join('\n');

        // Generate AI sales follow-up
        const prompt = `You are the outbound AI Sales Agent for '${req.body.bizName || 'our company'}'.
We sell: ${req.body.bizDesc || 'CRM software and transaction automation for realtors'}
Configured sales links:
${salesAssetContext}
Customer Details: Name: ${lead.name}, Company: ${lead.company}.
Conversation history:
${lead.history.map(h => `${h.sender === 'agent' ? 'Sales Agent' : 'Customer'}: ${h.text}`).join('\n')}

Review the customer's last message. Write a friendly, professional response confirming booking or sharing a link to schedule a demo. 
Use the configured booking/calendar link when the customer asks for a demo, call, calendar, or meeting. Use the demo video or YouTube link when they ask to see how it works. Use the sales page for broader "send more info" requests. If a needed link is not configured, ask them to reply with a couple times that work instead of inventing a URL.
You must output a JSON response containing:
{
  "replyText": "...",
  "requiresHandoff": true/false,
  "reason": "..."
}
Set "requiresHandoff" to true if:
- They ask a complex technical or pricing question that you cannot confidently answer.
- They express irritation or ask to speak to a human.
- They successfully confirm scheduling a demo or call.
- They ask for a custom proposal.
Otherwise, set "requiresHandoff" to false. Ensure the response is valid JSON only.`;

        let replyJson;
        try {
            const rawResponse = await queryGemini(prompt);
            const cleaned = rawResponse.replace(/```json|```/g, "").trim();
            replyJson = JSON.parse(cleaned);
        } catch (err) {
            console.error('[Inbound Webhook] Gemini query failed, routing to human review:', err.message);
            replyJson = {
                replyText: '',
                requiresHandoff: true,
                reason: `Gemini failed to draft a reply: ${err.message}`
            };
        }
        replyJson.replyText = applySalesAssetPlaceholders(replyJson.replyText, settings, req.body.bizWebsite || '');
        let handoffRequired = replyJson.requiresHandoff === true;
        
        if (handoffRequired) {
            lead.stage = "Needs Human Action";
            lead.history.push({
                sender: "agent-action",
                time: "Just Now",
                text: `Handoff requested. Reason: ${replyJson.reason || 'Unknown'}`
            });
            
            console.log(`[CRM Handoff] Lead ${lead.name} (${lead.email}) requires handoff. Reason: ${replyJson.reason}`);
        } else {
            try {
                await sendMailgunEmailWithRetry({
                    to: lead.email,
                    subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
                    text: replyJson.replyText
                });
                
                lead.history.push({
                    sender: "agent",
                    time: new Date().toLocaleTimeString(),
                    text: replyJson.replyText
                });
            } catch (sendErr) {
                lead.stage = "Needs Human Action";
                lead.history.push({
                    sender: "agent-action",
                    time: "Just Now",
                    text: `Auto-reply failed after Mailgun retry. Human review needed. Error: ${sendErr.message}`
                });
                lead.history.push({
                    sender: "agent-draft",
                    time: new Date().toLocaleTimeString(),
                    text: replyJson.replyText
                });
                handoffRequired = true;
                console.error('[Inbound Webhook] Failed to send email reply after retry:', sendErr.message);
            }
        }
        
        db.updateLead(lead);
        res.json({ success: true, handoff: handoffRequired });
    } catch (error) {
        console.error('[Inbound Webhook Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 6. Lead Scraper Endpoint (Search-grounded contact discovery)
app.get('/api/scrape-leads/jobs/:id', (req, res) => {
    const job = leadScrapeJobs.get(req.params.id);
    if (!job) {
        return res.status(404).json({ error: 'Lead scrape job not found. It may have expired or the server restarted.' });
    }

    res.json({ job: serializeLeadScrapeJob(job) });
});

app.post('/api/scrape-leads', (req, res) => {
    const niche = String(req.body.niche || '').trim();
    const count = Math.min(Math.max(parseInt(req.body.count, 10) || 25, 1), 100);

    if (!niche) {
        return res.status(400).json({ error: 'Target city and niche is required.' });
    }

    const job = startLeadScrapeJob(niche, count);
    res.status(202).json({ job: serializeLeadScrapeJob(job) });
});

app.get('/api/lead-intelligence/status', (req, res) => {
    const openRouterSettings = getOpenRouterIntegrationSettings();
    const settings = readLeadIntelligenceSettings();
    res.json({
        enabled: settings.enabled,
        configuredDefault: LEAD_INTELLIGENCE_ENABLED,
        running: leadIntelligenceWorkerRunning,
        intervalMs: LEAD_INTELLIGENCE_INTERVAL_MS,
        maxOfficesPerCycle: LEAD_INTELLIGENCE_MAX_OFFICES_PER_CYCLE,
        maxProfileResearchPerCycle: LEAD_INTELLIGENCE_MAX_PROFILE_RESEARCH_PER_CYCLE,
        stopAfterContacts: LEAD_INTELLIGENCE_STOP_AFTER_CONTACTS,
        suppressBrandAfterFailure: LEAD_INTELLIGENCE_SUPPRESS_BRAND_AFTER_FAILURE,
        researchTechStack: LEAD_INTELLIGENCE_RESEARCH_TECH_STACK,
        browserMode: true,
        researchProvider: getLeadIntelligenceResearchProvider(),
        openRouter: {
            configured: openRouterSettings.enabled,
            source: openRouterSettings.source,
            defaultModel: openRouterSettings.defaultModel,
            researchModel: openRouterSettings.researchModel,
            modelOrder: openRouterSettings.modelOrder,
            webSearchEnabled: openRouterSettings.webSearchEnabled,
            dailyRequestLimit: openRouterSettings.dailyRequestLimit,
            dailyRequestsUsed: openRouterUsageState.requests
        },
        status: db.getLeadIntelligenceStatus()
    });
});

app.post('/api/lead-intelligence/settings', (req, res) => {
    const enabled = req.body?.enabled === true;
    writeLeadIntelligenceSettings({ enabled });
    const openRouterSettings = getOpenRouterIntegrationSettings();
    res.json({
        success: true,
        enabled,
        running: leadIntelligenceWorkerRunning,
        intervalMs: LEAD_INTELLIGENCE_INTERVAL_MS,
        maxOfficesPerCycle: LEAD_INTELLIGENCE_MAX_OFFICES_PER_CYCLE,
        maxProfileResearchPerCycle: LEAD_INTELLIGENCE_MAX_PROFILE_RESEARCH_PER_CYCLE,
        stopAfterContacts: LEAD_INTELLIGENCE_STOP_AFTER_CONTACTS,
        suppressBrandAfterFailure: LEAD_INTELLIGENCE_SUPPRESS_BRAND_AFTER_FAILURE,
        researchTechStack: LEAD_INTELLIGENCE_RESEARCH_TECH_STACK,
        browserMode: true,
        researchProvider: getLeadIntelligenceResearchProvider(),
        openRouter: {
            configured: openRouterSettings.enabled,
            source: openRouterSettings.source,
            defaultModel: openRouterSettings.defaultModel,
            researchModel: openRouterSettings.researchModel,
            modelOrder: openRouterSettings.modelOrder,
            webSearchEnabled: openRouterSettings.webSearchEnabled,
            dailyRequestLimit: openRouterSettings.dailyRequestLimit,
            dailyRequestsUsed: openRouterUsageState.requests
        },
        status: db.getLeadIntelligenceStatus()
    });
});

app.post('/api/lead-intelligence/seed', (req, res) => {
    const seeded = seedLeadIntelligenceDefaults();
    res.json({ success: true, seeded, status: db.getLeadIntelligenceStatus() });
});

app.post('/api/lead-intelligence/run-once', async (req, res) => {
    if (!isLeadIntelligenceEnabled()) {
        return res.status(400).json({ error: 'Lead Intelligence is turned off. Enable it before running.' });
    }
    const runAsync = req.query.async === 'true' || req.body?.async === true;
    if (runAsync) {
        if (leadIntelligenceWorkerRunning) {
            return res.json({
                success: true,
                accepted: false,
                result: { skipped: true, reason: 'lead intelligence worker already running' },
                status: db.getLeadIntelligenceStatus()
            });
        }

        runLeadIntelligenceCycle('manual-api').then(result => {
            console.log(`[Lead Intelligence] Manual async cycle result: ${JSON.stringify(result)}`);
        }).catch(error => {
            console.error('[Lead Intelligence] Manual async cycle error:', error.message);
        });

        return res.status(202).json({
            success: true,
            accepted: true,
            result: { started: true },
            status: db.getLeadIntelligenceStatus()
        });
    }

    const result = await runLeadIntelligenceCycle('manual-api');
    res.json({ success: !result.error, result, status: db.getLeadIntelligenceStatus() });
});

// Approve and Launch Campaign Endpoint
app.post('/api/campaigns/:id/approve', async (req, res) => {
    try {
        const campaignId = parseInt(req.params.id);
        const { steps, bizName, bizWebsite } = req.body;
        
        const campaign = db.getCampaignById(campaignId);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        
        if (Array.isArray(steps)) campaign.steps = steps;
        
        const targetLeadsCount = db.getLeadsCount({ stage: 'Scraped' });
        if (targetLeadsCount === 0) {
            return res.status(400).json({ error: 'No scraped leads are currently available to launch this campaign.' });
        }

        db.updateCampaign({
            id: campaignId,
            name: campaign.name,
            type: campaign.type,
            instructions: campaign.instructions,
            videoAsset: campaign.videoAsset,
            status: 'Active',
            steps: campaign.steps
        });

        const { sentCount, failedCount } = await enrollAndSendScrapedLeads({
            campaignId,
            limit: 1000,
            bizName,
            bizWebsite
        });
        
        res.json({ success: true, targetLeadsCount, sentCount, failedCount });
    } catch (err) {
        console.error('[Campaign Approve Error]', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/crm-pipeline/run', async (req, res) => {
    try {
        const result = await runCrmPipelineAutomation(req.body?.trigger || 'manual-api');
        res.json({ success: true, result });
    } catch (err) {
        console.error('[CRM Pipeline Run Error]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Reject/Delete Campaign Endpoint
app.delete('/api/campaigns/:id', (req, res) => {
    try {
        const campaignId = parseInt(req.params.id);
        db.deleteCampaign(campaignId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Generate Campaign Drip Endpoint
app.post('/api/generate-campaign', async (req, res) => {
    const { campaignName, campaignType, customInstructions, videoAsset, bizName, bizDesc, bizWebsite, strategicContext } = req.body;
    console.log(`[Campaign Agent] Generating 3-step drip campaign for: "${campaignName}"...`);
    const settings = readCrmSettings();
    const autoApproveCampaigns = shouldAutoApproveCampaigns(settings);
    const selectedVideoAsset = String(videoAsset || '').trim() || selectDefaultCampaignCta(settings, bizWebsite);
    const salesAssetContext = [
        settings.bookingLink ? `Booking/calendar link: ${settings.bookingLink}` : 'Booking/calendar link: not configured',
        settings.demoVideoUrl ? `Default demo video link: ${settings.demoVideoUrl}` : 'Default demo video link: not configured',
        settings.youtubePageUrl ? `YouTube page/channel: ${settings.youtubePageUrl}` : 'YouTube page/channel: not configured',
        settings.salesPageUrl ? `Sales page: ${settings.salesPageUrl}` : 'Sales page: not configured'
    ].join('\n');
    
    const prompt = `You are an AI Outbound Copywriter and email marketer.
We are building a 3-step outbound sales email campaign named "${campaignName}" for our company: "${bizName || 'CRM Pro'}".
Company Value Proposition & Description: ${bizDesc || 'CRM automation for realtors'}
Additional strategic context from onboarding:
${strategicContext || 'No optional strategy notes or deep research context provided.'}

Configured sales assets:
${salesAssetContext}

Campaign Type: ${campaignType || 'cold-outreach'}
Target Pain Points & Value: ${customInstructions || 'Realtors waste too much time on paperwork. CRM Pro automates it.'}
${selectedVideoAsset ? `Primary campaign CTA / demo resource link: ${selectedVideoAsset}` : ""}

Generate a highly engaging, high-converting 3-step outbound email drip sequence.
For each step (Step 1: Cold outreach/Intro, Step 2: Value and offer, Step 3: Call-to-action follow-up), provide:
1. Subject line (engaging, high open rate, curious or benefit-driven).
2. Email Body copy (persuasive, addressing pain points, and containing placeholders like [CTA Link], [Demo Link], [Sales Page], or [Booking Link] where appropriate).

Use [CTA Link] for the primary campaign demo/resource. Use [Booking Link] only when asking the lead to schedule a call or demo. Do not invent URLs.

Return a JSON array of steps:
[
  {
    "step": 1,
    "delay": "Immediate",
    "subject": "Subject Line Here",
    "body": "Email body content..."
  },
  {
    "step": 2,
    "delay": "2 Days Later",
    "subject": "Subject Line Here",
    "body": "Email body content..."
  },
  {
    "step": 3,
    "delay": "5 Days Later",
    "subject": "Subject Line Here",
    "body": "Email body content..."
  }
]
Ensure the response is valid JSON. Output only the raw JSON array (do not include markdown block ticks like \`\`\`json, just output the raw JSON string).`;

    try {
        const rawResponse = await queryGemini(prompt);
        const cleaned = rawResponse.replace(/```json|```/g, "").trim();
        const steps = JSON.parse(cleaned);
        
        const status = autoApproveCampaigns ? 'Active' : 'Awaiting Launch';
        
        const campaignId = db.insertCampaign({
            name: campaignName,
            type: campaignType,
            instructions: customInstructions,
            videoAsset: selectedVideoAsset,
            status,
            steps
        });
        
        const campaign = {
            id: campaignId,
            name: campaignName,
            type: campaignType,
            instructions: customInstructions,
            videoAsset: selectedVideoAsset,
            status,
            steps,
            dateCreated: new Date().toLocaleDateString(),
            targetLeadsCount: db.getLeadsCount({ stage: 'Scraped' })
        };
        
        let launchResult = null;
        if (autoApproveCampaigns) {
            launchResult = await enrollAndSendScrapedLeads({ campaignId, limit: 1000, bizName, bizWebsite, settings });
        }
        
        res.json({ success: true, campaign, launchResult });
    } catch (error) {
        console.error(`[Generate Campaign Error]`, error.message);
        
        const fallbackSteps = [
            {
                step: 1,
                delay: "Immediate",
                subject: "Quick question about your transaction admin time",
                body: `Hi [Lead Name],\n\nI noticed your brokerage is doing great work. Quick question: How much time are you spending managing compliance files and signatures every week?\n\nMost agents waste 10+ hours on administrative work. We help realtors automate this, getting back 10 hours a week to focus on listings. \n\nAre you open to checking out a quick video showing how it works? [CTA Link]\n\nBest,\n[Your Name]`
            },
            {
                step: 2,
                delay: "2 Days Later",
                subject: "Re: Quick question about your transaction admin time",
                body: `Hi [Lead Name],\n\nFollowing up on my last email. Here is the link to a video showing how you can automate your transaction coordination: [CTA Link]\n\nHope this helps save you some admin headaches this week.\n\nBest,\n[Your Name]`
            },
            {
                step: 3,
                delay: "5 Days Later",
                subject: "One last thing...",
                body: `Hi [Lead Name],\n\nJust wanted to share one last detail: our CRM users report a 25% increase in listing volume because they aren't bogged down by transaction files. \n\nIf you want to free up your schedule, let's connect. [CTA Link]\n\nBest,\n[Your Name]`
            }
        ];
        
        const status = autoApproveCampaigns ? 'Active' : 'Awaiting Launch';
        const campaignId = db.insertCampaign({
            name: campaignName,
            type: campaignType,
            instructions: customInstructions,
            videoAsset: selectedVideoAsset,
            status,
            steps: fallbackSteps
        });

        let launchResult = null;
        if (autoApproveCampaigns) {
            launchResult = await enrollAndSendScrapedLeads({ campaignId, limit: 1000, bizName, bizWebsite, settings });
        }
        
        res.json({
            success: true,
            launchResult,
            campaign: {
                id: campaignId,
                name: campaignName,
                type: campaignType,
                instructions: customInstructions,
                videoAsset: selectedVideoAsset,
                status,
                steps: fallbackSteps,
                dateCreated: new Date().toLocaleDateString(),
                targetLeadsCount: db.getLeadsCount({ stage: 'Scraped' })
            }
        });
    }
});

// AI Image Prompt Generator Endpoint
app.post('/api/generate-image-prompt', async (req, res) => {
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: "Post text is required" });
    }

    const prompt = `Read the following social media post:
"${text}"

Write a realistic image-generation prompt for a social media creative.
The visual should look like an authentic editorial or documentary photo, not a generic AI graphic.

Requirements:
- Specific real-world setting, subject, action, and emotion.
- Natural lighting, believable camera/lens details, imperfect human environment.
- No text overlays, no logos, no glossy 3D renders, no plastic skin, no extra fingers, no surreal props, no corporate stock-photo posing.
- If people are present, describe candid posture and natural expressions.
- Keep it to 1-2 vivid sentences.

Output ONLY the image prompt.`;

    try {
        console.log(`[Gemini Proxy] Querying Gemini for image prompt generation...`);
        const responseText = await queryGemini(prompt);
        res.json({ visualPrompt: responseText.trim() });
    } catch (error) {
        console.error(`[Image Prompt Gen Error]`, error.message);
        res.json({ visualPrompt: "Realistic documentary photo of a tired real estate agent at a kitchen table late in the evening, laptop open beside messy contract folders and a half-finished coffee, warm practical lamp light, 35mm lens, candid expression, no text, no logos, natural imperfections." });
    }
});

// AI Image Downloader & Fallback Endpoint
app.post('/api/generate-image', async (req, res) => {
    const { promptText } = req.body;
    if (!promptText) {
        return res.status(400).json({ error: "promptText is required" });
    }

    const fileBase = `gen_${Date.now()}_${Math.floor(Math.random() * 999999)}`;

    // 1. Try Nano Banana 2 Lite through the Interactions API.
    if (GEMINI_API_KEY) {
        console.log(`[AI Image Agent] Attempting to generate image using ${GEMINI_IMAGE_MODEL}...`);
        try {
            const interaction = await createGeminiInteraction({
                model: GEMINI_IMAGE_MODEL,
                input: [{ type: 'text', text: promptText }],
                label: 'Gemini Image'
            });
            const generatedImage = extractInteractionMedia(interaction, 'image');

            if (generatedImage && generatedImage.data) {
                const ext = extensionFromMime(generatedImage.mime_type || generatedImage.mimeType, 'png');
                const filename = `${fileBase}.${ext}`;
                const localPath = path.join(downloadsDir, filename);
                fs.writeFileSync(localPath, Buffer.from(generatedImage.data, 'base64'));
                console.log(`[AI Image Agent] Successfully saved ${GEMINI_IMAGE_MODEL} image: ${filename}`);
                return res.json({
                    success: true,
                    mediaUrl: `/downloads/${filename}`,
                    model: GEMINI_IMAGE_MODEL
                });
            }

            console.warn(`[AI Image Agent] ${GEMINI_IMAGE_MODEL} returned no image data.`);
        } catch (err) {
            console.warn(`[AI Image Agent] ${GEMINI_IMAGE_MODEL} request failed:`, err.message);
        }
    }

    const filename = `${fileBase}.jpg`;
    const localPath = path.join(downloadsDir, filename);

    // 2. Fallback to Imagen 4 for older API keys/accounts that do not yet have Nano Banana Lite.
    if (GEMINI_API_KEY) {
        console.log(`[AI Image Agent] Falling back to Gemini Imagen 4...`);
        const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${GEMINI_API_KEY}`;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

            const response = await fetch(imagenUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instances: [{ prompt: promptText }],
                    parameters: { sampleCount: 1 }
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data.predictions && data.predictions.length > 0) {
                    const base64Image = data.predictions[0].bytesBase64Encoded;
                    const buffer = Buffer.from(base64Image, 'base64');
                    fs.writeFileSync(localPath, buffer);
                    console.log(`[AI Image Agent] Successfully saved generated Imagen 4 image: ${filename}`);
                    return res.json({
                        success: true,
                        mediaUrl: `/downloads/${filename}`,
                        model: 'imagen-4.0-generate-001'
                    });
                }
            } else {
                console.warn(`[AI Image Agent] Imagen 4 API returned status: ${response.status} ${response.statusText}`);
            }
        } catch (err) {
            console.warn(`[AI Image Agent] Imagen 4 API request failed:`, err.message);
        }
    }

    // 3. Fallback to local stock photos if Gemini image generation fails.
    console.log(`[AI Image Agent] Falling back to local stock real estate images.`);
    const fallbacks = [
        'fallback_house.jpg',
        'fallback_agent.jpg',
        'fallback_office.jpg',
        'fallback_keys.jpg'
    ];
    const chosenFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    const fallbackSrc = path.join(downloadsDir, chosenFallback);
    
    try {
        if (fs.existsSync(fallbackSrc)) {
            fs.copyFileSync(fallbackSrc, localPath);
            console.log(`[AI Image Agent] Copied fallback ${chosenFallback} to ${filename}`);
            return res.json({
                success: true,
                mediaUrl: `/downloads/${filename}`,
                model: 'local-fallback'
            });
        }
    } catch (copyErr) {
        console.error(`[AI Image Agent] Fallback copy failed:`, copyErr.message);
    }

    return res.status(502).json({
        error: "Image generation failed and no local fallback image was available."
    });
});

app.post('/api/generate-video', async (req, res) => {
    const { promptText, aspectRatio } = req.body;
    if (!promptText) {
        return res.status(400).json({ error: "promptText is required" });
    }

    const safeAspectRatio = ['9:16', '16:9'].includes(aspectRatio) ? aspectRatio : '9:16';

    try {
        console.log(`[AI Video Agent] Attempting to generate ${safeAspectRatio} video using ${GEMINI_VIDEO_MODEL}...`);
        const interaction = await createGeminiInteraction({
            model: GEMINI_VIDEO_MODEL,
            input: promptText,
            responseFormat: {
                type: 'video',
                aspect_ratio: safeAspectRatio
            },
            generationConfig: {
                video_config: {
                    task: 'text_to_video'
                }
            },
            label: 'Gemini Video',
            timeoutMs: 300000
        });
        const generatedVideo = extractInteractionMedia(interaction, 'video');

        if (!generatedVideo || !generatedVideo.data) {
            throw new Error(`${GEMINI_VIDEO_MODEL} returned no video data.`);
        }

        const ext = extensionFromMime(generatedVideo.mime_type || generatedVideo.mimeType, 'mp4');
        const filename = `video_${Date.now()}_${Math.floor(Math.random() * 999999)}.${ext}`;
        const localPath = path.join(downloadsDir, filename);
        fs.writeFileSync(localPath, Buffer.from(generatedVideo.data, 'base64'));
        console.log(`[AI Video Agent] Successfully saved ${GEMINI_VIDEO_MODEL} video: ${filename}`);

        res.json({
            success: true,
            mediaUrl: `/downloads/${filename}`,
            model: GEMINI_VIDEO_MODEL,
            interactionId: interaction.id || null
        });
    } catch (error) {
        console.error(`[AI Video Agent Error]`, error.message);
        res.status(500).json({ error: `Video generation failed: ${error.message}` });
    }
});


// fs storage path configuration

const CREDENTIALS_FILE = path.join(DATA_DIR, 'credentials.json');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');
const LEGACY_CREDENTIALS_FILE = path.join(__dirname, 'credentials.json');
const LEGACY_TOKENS_FILE = path.join(__dirname, 'tokens.json');

function migrateLegacyRuntimeJson(legacyPath, durablePath) {
    try {
        if (fs.existsSync(durablePath) || !fs.existsSync(legacyPath)) return;
        ensureDataDir();
        fs.copyFileSync(legacyPath, durablePath);
        console.log(`[Storage] Migrated ${path.basename(legacyPath)} to data/${path.basename(durablePath)}.`);
    } catch (error) {
        console.warn(`[Storage] Failed to migrate ${path.basename(legacyPath)}:`, error.message);
    }
}

function getCredentials() {
    migrateLegacyRuntimeJson(LEGACY_CREDENTIALS_FILE, CREDENTIALS_FILE);
    if (!fs.existsSync(CREDENTIALS_FILE)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveCredentials(creds) {
    writeJsonFile(CREDENTIALS_FILE, creds);
}

function getTokens() {
    migrateLegacyRuntimeJson(LEGACY_TOKENS_FILE, TOKENS_FILE);
    if (!fs.existsSync(TOKENS_FILE)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveTokens(tokens) {
    writeJsonFile(TOKENS_FILE, tokens);
}

function serializeOpenRouterSettingsForClient() {
    const settings = getOpenRouterIntegrationSettings();
    return {
        configured: settings.configured,
        enabled: settings.enabled,
        source: settings.source,
        defaultModel: settings.defaultModel,
        researchModel: settings.researchModel,
        modelOrder: settings.modelOrder,
        webSearchEnabled: settings.webSearchEnabled,
        dailyRequestLimit: settings.dailyRequestLimit,
        dailyRequestsUsed: openRouterUsageState.requests
    };
}

app.get('/api/openrouter-settings', (req, res) => {
    res.json(serializeOpenRouterSettingsForClient());
});

app.post('/api/openrouter-settings', (req, res) => {
    const creds = getCredentials();
    const {
        enabled,
        apiKey,
        clearApiKey,
        webSearchEnabled,
        dailyRequestLimit,
        modelOrder
    } = req.body || {};

    if (clearApiKey === true) {
        delete creds.openRouterApiKey;
    } else if (typeof apiKey === 'string' && apiKey.trim()) {
        creds.openRouterApiKey = apiKey.trim();
    }

    creds.openRouterEnabled = enabled === true;
    creds.openRouterWebSearchEnabled = webSearchEnabled === true;
    creds.openRouterDailyRequestLimit = Math.min(Math.max(parseInt(dailyRequestLimit, 10) || OPENROUTER_DAILY_REQUEST_LIMIT, 1), 5000);
    creds.openRouterModelOrder = normalizeOpenRouterModelOrder(modelOrder);

    saveCredentials(creds);
    res.json({ success: true, openRouter: serializeOpenRouterSettingsForClient() });
});

// 1. Fetch Webhook Settings
app.get('/api/make-webhook', (req, res) => {
    const creds = getCredentials();
    res.json({ makeWebhookUrl: creds.makeWebhookUrl || "" });
});

// 2. Save Webhook Settings
app.post('/api/save-make-webhook', (req, res) => {
    const { makeWebhookUrl } = req.body;
    const creds = getCredentials();
    creds.makeWebhookUrl = makeWebhookUrl ? makeWebhookUrl.trim() : "";
    saveCredentials(creds);
    res.json({ success: true, message: "Make.com webhook URL saved successfully." });
});

// 3. Integration Status Check
app.get('/api/integration-statuses', (req, res) => {
    const creds = getCredentials();
    const isWebhookActive = !!creds.makeWebhookUrl;
    res.json({
        linkedin: isWebhookActive,
        twitter: isWebhookActive,
        google: isWebhookActive,
        meta: isWebhookActive
    });
});

// 4. Test Webhook Connection Route
app.post('/api/test-webhook', async (req, res) => {
    const creds = getCredentials();
    if (!creds.makeWebhookUrl) {
        return res.status(400).json({ success: false, error: "Make.com Webhook URL is not configured. Please save it first." });
    }

    try {
        const payload = {
            type: "test-connection",
            message: "Test webhook connection from Autopilot Agency Dashboard",
            timestamp: new Date().toISOString()
        };

        const response = await axios.post(creds.makeWebhookUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 8000
        });

        res.json({ 
            success: true, 
            message: "Test payload sent successfully! Make.com responded with status: " + response.status 
        });
    } catch (e) {
        console.error("Test webhook failed:", e.message);
        res.json({ 
            success: false, 
            error: `Failed to dispatch: ${e.message}. Double check that your Make.com webhook URL is correct and active.` 
        });
    }
});

// 5. Publish Social Media Posts (Forwards payload to Webhook)
app.post('/api/publish-post', async (req, res) => {
    let { platforms, content, mediaUrl } = req.body;
    const creds = getCredentials();
    
    const results = {};

    if (!creds.makeWebhookUrl) {
        return res.status(400).json({
            error: "Publishing webhook is not configured. Save a Make.com webhook or platform integration before publishing."
        });
    }

    // Resolve local relative paths to fully-qualified public URLs using request headers
    if (mediaUrl && (mediaUrl.startsWith('/') || mediaUrl.startsWith('downloads/'))) {
        let catboxUrl = null;
        try {
            const filename = path.basename(mediaUrl.split('?')[0]);
            const localFilePath = path.join(downloadsDir, filename);
            if (fs.existsSync(localFilePath)) {
                console.log(`[Publishing] Detected local file ${filename}, uploading to Catbox...`);
                const fileBuffer = fs.readFileSync(localFilePath);
                const blob = new Blob([fileBuffer]);
                const formData = new FormData();
                formData.append('reqtype', 'fileupload');
                formData.append('fileToUpload', blob, filename);

                const uploadRes = await axios.post('https://catbox.moe/user/api.php', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 15000
                });

                if (uploadRes.status === 200 && typeof uploadRes.data === 'string' && uploadRes.data.startsWith('https://')) {
                    catboxUrl = uploadRes.data.trim();
                    console.log(`[Publishing] Successfully uploaded local file to Catbox: ${catboxUrl}`);
                }
            } else {
                console.warn(`[Publishing] Local file not found at path: ${localFilePath}`);
            }
        } catch (uploadErr) {
            console.error(`[Publishing] Catbox upload failed: ${uploadErr.message}`);
        }

        if (catboxUrl) {
            mediaUrl = catboxUrl;
        } else {
            const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
            const host = req.headers['x-forwarded-host'] || req.headers.host;
            const cleanPath = mediaUrl.startsWith('/') ? mediaUrl : `/${mediaUrl}`;
            mediaUrl = `${protocol}://${host}${cleanPath}`;
            console.log(`[Publishing] Catbox upload failed/skipped. Falling back to resolved local URL: ${mediaUrl}`);
        }
    }

    try {
        const payload = {
            type: "social-post",
            platforms,
            content,
            mediaUrl: mediaUrl || "",
            timestamp: new Date().toISOString()
        };

        const response = await axios.post(creds.makeWebhookUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        for (const platform of platforms) {
            results[platform] = { success: true, responseStatus: response.status };
        }
    } catch (e) {
        console.error("Make Webhook publish failed:", e.message);
        for (const platform of platforms) {
            results[platform] = { success: false, error: `Failed to forward to Make Webhook: ${e.message}` };
        }
    }

    res.json(results);
});

setInterval(() => {
    const settings = readCrmSettings();
    if (!settings.dailyScrapeEnabled && !settings.autoEnrollScrapedLeads && !settings.autoAdvanceCampaigns) {
        return;
    }

    runCrmPipelineAutomation('interval').then(result => {
        if (!result.skipped) {
            console.log(`[CRM Pipeline] ${JSON.stringify(result)}`);
        }
    }).catch(err => {
        console.error('[CRM Pipeline Interval Error]', err.message);
    });
}, 5 * 60 * 1000);

if (isLeadIntelligenceEnabled()) {
    try {
        const seeded = seedLeadIntelligenceDefaults();
        if (seeded) console.log(`[Lead Intelligence] Seeded/updated ${seeded} market city row(s).`);
    } catch (error) {
        console.error('[Lead Intelligence] Failed to seed market cities:', error.message);
    }

    console.log(`[Lead Intelligence] Hourly worker enabled. First run in ${Math.round(LEAD_INTELLIGENCE_START_DELAY_MS / 1000)} seconds.`);
    setTimeout(() => {
        if (!isLeadIntelligenceEnabled()) return;
        runLeadIntelligenceCycle('startup-delay').then(result => {
            console.log(`[Lead Intelligence] Startup cycle result: ${JSON.stringify(result)}`);
        }).catch(error => {
            console.error('[Lead Intelligence] Startup cycle error:', error.message);
        });
    }, LEAD_INTELLIGENCE_START_DELAY_MS);

}

setInterval(() => {
    if (!isLeadIntelligenceEnabled()) return;
    runLeadIntelligenceCycle('interval').then(result => {
        console.log(`[Lead Intelligence] Interval cycle result: ${JSON.stringify(result)}`);
    }).catch(error => {
        console.error('[Lead Intelligence] Interval cycle error:', error.message);
    });
}, LEAD_INTELLIGENCE_INTERVAL_MS);

app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 Autopilot Agency backend server active!`);
    console.log(`🔗 Local dashboard hosted at: http://localhost:${PORT}`);
    console.log(`==================================================`);
});
