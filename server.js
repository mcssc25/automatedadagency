const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

const db = require('./db');

// Initialize database
db.initDb();

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DATA_DIR = path.join(__dirname, 'data');
const CRM_STATE_FILE = path.join(DATA_DIR, 'crm-state.json');

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
            autoPauseOnReply: true,
            simulateUnsubscribes: true,
            dncList: []
        },
        updatedAt: null
    };
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


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(__dirname)); // Serve the frontend from Express

app.get('/api/app-config', (req, res) => {
    res.json({
        geminiConfigured: !!GEMINI_API_KEY
    });
});

app.get('/api/crm-state', (req, res) => {
    try {
        const settings = readJsonFile(path.join(DATA_DIR, 'crm-settings.json'), {
            enabled: false,
            dailyLeadTarget: 100,
            firstCampaignId: null,
            secondCampaignId: null,
            autoPauseOnReply: true,
            simulateUnsubscribes: false,
            bypassEmailVerification: false
        });
        
        const allCampaigns = db.getCampaigns();
        const campaignsList = allCampaigns.filter(c => c.status === 'Active');
        const verificationQueue = allCampaigns.filter(c => c.status === 'Awaiting Launch');
        
        // Return first 50 leads to avoid UI lag.
        // Frontend will fetch paginated list via /api/leads
        const leads = db.getLeads({ limit: 50 });
        const dncRows = db.getDncList();
        
        res.json({
            leads,
            campaignsList,
            verificationQueue,
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
                autoPauseOnReply: crmAutopilot.autoPauseOnReply ?? true,
                simulateUnsubscribes: crmAutopilot.simulateUnsubscribes ?? false,
                bypassEmailVerification: crmAutopilot.bypassEmailVerification ?? false
            };
            writeJsonFile(path.join(DATA_DIR, 'crm-settings.json'), settings);
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
        const offset = (page - 1) * limit;
        
        const leads = db.getLeads({ stage, search, limit, offset });
        const total = db.getLeadsCount({ stage, search });
        const pages = Math.ceil(total / limit);
        
        res.json({ leads, page, pages, total });
    } catch (err) {
        console.error('[CRM Leads List API Error]', err.message);
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
        if (updated.stage === 'DNC' || updated.stage === 'Opted Out') {
            db.addEmailToDnc(updated.email, `Lead marked ${updated.stage} from CRM`);
        }
        db.updateLead(updated);
        res.json({ success: true });
    } catch (err) {
        console.error('[CRM Lead Update Error]', err.message);
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
async function queryGemini(promptText) {
    if (!GEMINI_API_KEY) {
        throw new Error("Gemini API key is not configured in .env file.");
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await axios.post(url, {
        contents: [{
            parts: [{
                text: promptText
            }]
        }]
    }, {
        headers: { 'Content-Type': 'application/json' }
    });

    if (response.data && response.data.candidates && response.data.candidates[0].content) {
        return response.data.candidates[0].content.parts[0].text;
    } else {
        throw new Error("Invalid response format received from Gemini API");
    }
}

// Google Search Grounding wrapper for Gemini
async function queryGeminiWithSearch(promptText) {
    if (!GEMINI_API_KEY) {
        throw new Error("Gemini API key is not configured in .env file.");
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await axios.post(url, {
        contents: [{
            parts: [{
                text: promptText
            }]
        }],
        tools: [{
            googleSearch: {}
        }]
    }, {
        headers: { 'Content-Type': 'application/json' }
    });

    if (response.data && response.data.candidates && response.data.candidates[0].content) {
        return response.data.candidates[0].content.parts[0].text;
    } else {
        throw new Error("Invalid response format received from Gemini API");
    }
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
    return [...new Set(matches.map(email => email.toLowerCase()))];
}

function normalizeMapsCsvRow(row, discoveryQuery) {
    const pick = (...keys) => {
        for (const key of keys) {
            if (row[key] !== undefined && String(row[key]).trim()) return String(row[key]).trim();
        }
        return '';
    };

    const emails = parseEmailListFromCsvValue(pick('emails', 'email'));

    return normalizeLeadCandidate({
        name: pick('title', 'name', 'business name', 'business_name'),
        company: pick('title', 'name', 'business name', 'business_name'),
        emails,
        phone: pick('phone', 'telephone'),
        website: pick('website', 'web_site', 'web site'),
        address: pick('address', 'complete_address', 'complete address'),
        sourceUrl: pick('link', 'google maps link', 'source_url')
    }, discoveryQuery, pick('link'));
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

    const candidates = parseCsvRows(csvRes.data)
        .flatMap(row => normalizeMapsCsvRow(row, niche));

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

    const rawResponse = await queryGeminiWithSearch(prompt);
    const cleaned = rawResponse.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleaned);
    return (data.leads || []).flatMap(lead => normalizeLeadCandidate(lead, niche));
}

function insertLeadCandidates(candidates, discoveryQuery) {
    const insertedLeads = [];
    const skipped = { dnc: 0, duplicate: 0, invalid: 0 };

    for (const lead of candidates) {
        if (!lead.name || !isLikelyEmail(lead.email)) {
            skipped.invalid++;
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
            insertedLeads.push({
                id: leadId,
                ...leadRecord
            });
        }
    }

    return { insertedLeads, skipped };
}

// 1. Web Scraper & Profile Summarizer Endpoint
app.post('/api/scrape', async (req, res) => {
    let { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }

    // Standardize URL protocol
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }

    try {
        console.log(`[Scraper] Fetching HTML from: ${url}`);
        const htmlResponse = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            timeout: 10000 // 10s timeout
        });

        const $ = cheerio.load(htmlResponse.data);
        
        // Remove script, style, and navigation noise
        $('script, style, nav, footer, header, iframe, noscript').remove();

        // Extract readable text from paragraphs, list items, and headings
        let pageText = '';
        $('h1, h2, h3, p, li').each((i, el) => {
            const txt = $(el).text().trim();
            if (txt.length > 10) {
                pageText += txt + '\n';
            }
        });

        // Truncate text content to stay within safety window
        pageText = pageText.substring(0, 10000).trim();

        if (pageText.length < 50) {
            return res.status(400).json({ error: "Could not scrape enough readable text content from the website." });
        }

        console.log(`[Scraper] Scraped ${pageText.length} characters. Querying Gemini to extract profile...`);

        // Ask Gemini to synthesize name, description, core offers, audience, and competitors
        const prompt = `You are an AI research assistant. We scraped the text content of a company website. 
Analyze the text and extract five fields:
1. Business Name (The official name of the company or brand).
2. Business Description (A high-quality 2-3 sentence overview of what the company does and its value proposition).
3. Core Offers (A brief bulleted list of 2-4 primary products, services, or solutions they sell).
4. Target Audience (A comma-separated list of 3-4 target audience segments or ideal customer profiles).
5. Competitors (A comma-separated list of 2-3 competitor domain names in the same market sector).

Here is the scraped website text:
-----------------
${pageText}
-----------------

Format your response exactly as a JSON object matching this structure (do not include markdown block ticks like \`\`\`json, just output the raw JSON string):
{
  "businessName": "The Business Name here",
  "description": "The Business Description here",
  "offers": "Bullet 1\\nBullet 2\\nBullet 3",
  "audience": "Segment 1, Segment 2, Segment 3",
  "competitors": "competitor1.com, competitor2.com"
}`;

        const rawJsonResult = await queryGemini(prompt);
        
        // Clean markdown backticks if any were returned by Gemini
        const cleanedJson = rawJsonResult.replace(/```json|```/g, "").trim();
        
        const result = JSON.parse(cleanedJson);
        res.json(result);

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
Analyze the business profile below and identify 2-3 major competitor domain names in the same industry.
Provide only a comma-separated list of competitor website domains.

Business Profile:
Description: ${description}
Core Offers: ${offers || 'Not defined'}

Format your response as a single line listing only the domains (e.g. "competitor1.com, competitor2.com"). Do not include other text.`;

    try {
        console.log(`[Competitors Agent] Querying Gemini for Competitor domains...`);
        const competitorsResult = await queryGemini(prompt);
        res.json({ competitors: competitorsResult.trim() });
    } catch (error) {
        console.error(`[Competitors Error]`, error.message);
        res.status(500).json({ error: `Competitor lookup failed: ${error.message}` });
    }
});

function runLast30DaysSearch(scriptPath, query, platformHint) {
    return new Promise((resolve) => {
        const safeQuery = String(query).replace(/"/g, '');
        const cmd = `py -3.12 "${scriptPath}" "${safeQuery}" --emit=compact --quick`;
        console.log(`[Trends Scraper] Running ${platformHint} command: ${cmd}`);

        exec(cmd, { timeout: 45000 }, (error, stdout) => {
            if (error) {
                console.error(`[Trends CLI Error:${platformHint}]`, error.message);
                return resolve([]);
            }

            try {
                resolve(parseCLIOutputToTrends(stdout, null, platformHint));
            } catch (parseError) {
                console.error(`[Trends Parse Error:${platformHint}]`, parseError.message);
                resolve([]);
            }
        });
    });
}

// 4. Competitor Trends Scraper Endpoint
app.post('/api/trends', async (req, res) => {
    const { competitors, bizName, bizDesc } = req.body;
    
    try {
        console.log(`[Trends Agent] Generating targeted search query for research...`);
        const queryPrompt = `Given the following business profile:
Name: ${bizName || 'Client Business'}
Description: ${bizDesc || 'Client business description not provided'}
Competitors: ${competitors || 'No competitors provided'}

Return only a 3-4 word search query (no quotes, no punctuation) optimized for short-form social content research. Prioritize creator-style hooks and customer pain points that would perform on Instagram Reels, Facebook Reels, and YouTube Shorts. Examples: "real estate transaction coordination", "mortgage automated underwriting".`;

        let searchQuery = "small business marketing";
        try {
            const rawQuery = await queryGemini(queryPrompt);
            searchQuery = rawQuery.trim().replace(/["']/g, "");
            console.log(`[Trends Agent] Optimized Search Query: "${searchQuery}"`);
        } catch (geminiErr) {
            console.warn(`[Trends Agent] Gemini query optimization failed, using default query.`, geminiErr.message);
        }

        // Execute last30days CLI tool via Python 3.12 with platform-specific searches.
        const scriptPath = path.resolve('C:\\Users\\daved\\.gemini\\config\\plugins\\last30days-plugin\\skills\\last30days\\scripts\\last30days.py');
        const researchQueries = [
            { platform: "instagram", query: `${searchQuery} instagram reels viral` },
            { platform: "youtube", query: `${searchQuery} youtube shorts viral` },
            { platform: "facebook", query: `${searchQuery} facebook reels viral` },
            { platform: "tiktok", query: `${searchQuery} tiktok tips viral` }
        ];

        const queryResults = await Promise.all(
            researchQueries.map(item => runLast30DaysSearch(scriptPath, item.query, item.platform))
        );

        const competitorList = (competitors || "market").split(",").map(c => c.trim()).filter(Boolean);
        const seen = new Set();
        const trends = queryResults.flat().map((trend, index) => {
            const key = `${trend.platform}:${trend.topic}:${trend.body}`.toLowerCase();
            if (seen.has(key)) return null;
            seen.add(key);
            return {
                ...trend,
                id: index + 1,
                competitor: trend.competitor || competitorList[index % Math.max(competitorList.length, 1)] || "market"
            };
        }).filter(Boolean).slice(0, 12);

        if (trends.length > 0) {
            const platformMix = trends.reduce((acc, t) => {
                acc[t.platform] = (acc[t.platform] || 0) + 1;
                return acc;
            }, {});
            console.log(`[Trends Scraper] Parsed ${trends.length} trends. Mix:`, platformMix);
            return res.json(trends);
        }

        console.warn(`[Trends Scraper] No platform trends parsed. Falling back to mocks.`);
        return res.json(getMockTrends(competitors));

    } catch (error) {
        console.error(`[Trends Error]`, error.message);
        res.json(getMockTrends(competitors));
    }
});

// Create downloads directory on startup for static media files
const downloadsDir = path.join(__dirname, 'downloads');
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
        
        const headerMatch = headerLine.match(/^(\d+)\.\s+(.*?)(?:\s+\(score\s+\d+.*sources:\s*(.*?)\))?$/);
        if (!headerMatch) continue;

        const topicId = parseInt(headerMatch[1]);
        let topicTitle = headerMatch[2].trim();
        const sourcesStr = (headerMatch[3] || "").toLowerCase();

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

        let engagement = "High Engagement";
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
            engagement
        });
    }

    return trends;
}

// Fallback Mock Trends generator
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
        console.warn('[Mailgun] API key or Domain not configured. Mocking email send.');
        console.log(`[MOCK EMAIL SENT] To: ${recipientEmail}\nSubject: ${subject}\nBody: ${text}`);
        return { mock: true };
    }
    
    const url = `https://api.mailgun.net/v3/${domain}/messages`;
    const auth = Buffer.from(`api:${apiKey}`).toString('base64');
    
    const params = new URLSearchParams();
    params.append('from', from);
    params.append('to', recipientEmail);
    params.append('subject', subject);
    params.append('text', text);
    
    const response = await axios.post(url, params, {
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    
    return response.data;
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

// Mailgun Inbound Webhook
app.post('/api/webhooks/inbound-email', async (req, res) => {
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
        
        lead.stage = "Hot Lead";
        
        const settings = readJsonFile(path.join(DATA_DIR, 'crm-settings.json'), { autoPauseOnReply: true });
        if (settings.autoPauseOnReply) {
            lead.currentCampaignId = null;
            lead.currentCampaignStep = null;
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
            lead.stage = "Opted Out";
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
        
        // Generate AI sales follow-up
        const prompt = `You are the outbound AI Sales Agent for '${req.body.bizName || 'our company'}'.
We sell: ${req.body.bizDesc || 'CRM software and transaction automation for realtors'}
Customer Details: Name: ${lead.name}, Company: ${lead.company}.
Conversation history:
${lead.history.map(h => `${h.sender === 'agent' ? 'Sales Agent' : 'Customer'}: ${h.text}`).join('\n')}

Review the customer's last message. Write a friendly, professional response confirming booking or sharing a link to schedule a demo. 
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
            console.error('[Inbound Webhook] Gemini query failed, using fallback:', err.message);
            replyJson = {
                replyText: `Hi ${lead.name.split(" ")[0]},\n\nThanks for your response. I would love to set up a quick 10-minute call to show you how we can help automate your workflow. You can select a time that works best for you here: [Booking Link]. Let me know if you have any questions!\n\nBest,`,
                requiresHandoff: false,
                reason: "Fallback response used"
            };
        }
        
        if (replyJson.requiresHandoff) {
            lead.stage = "Requires Handoff";
            lead.history.push({
                sender: "agent-action",
                time: "Just Now",
                text: `Handoff requested. Reason: ${replyJson.reason || 'Unknown'}`
            });
            
            console.log(`[CRM Handoff] Lead ${lead.name} (${lead.email}) requires handoff. Reason: ${replyJson.reason}`);
        } else {
            try {
                await sendMailgunEmail({
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
                console.error('[Inbound Webhook] Failed to send email reply:', sendErr.message);
            }
        }
        
        db.updateLead(lead);
        res.json({ success: true, handoff: replyJson.requiresHandoff });
    } catch (error) {
        console.error('[Inbound Webhook Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 6. Lead Scraper Endpoint (Search-grounded contact discovery)
app.post('/api/scrape-leads', async (req, res) => {
    const niche = String(req.body.niche || '').trim();
    const count = Math.min(Math.max(parseInt(req.body.count, 10) || 25, 1), 100);

    if (!niche) {
        return res.status(400).json({ error: 'Target city and niche is required.' });
    }

    console.log(`[Scraper] Looking for up to ${count} public contacts for: "${niche}"...`);

    let candidates = [];
    let source = 'maps-sidecar';
    const errors = [];

    try {
        candidates = await scrapeLeadCandidatesWithMapsSidecar(niche, count);
    } catch (error) {
        errors.push(`maps-sidecar: ${error.message}`);
        console.warn(`[Maps Scraper Error] ${error.message}`);
    }

    if (candidates.length === 0) {
        try {
            source = 'gemini-search';
            candidates = await scrapeLeadCandidatesWithGemini(niche, count);
        } catch (error) {
            errors.push(`gemini-search: ${error.message}`);
            console.error(`[Gemini Lead Search Error] ${error.message}`);
        }
    }

    if (candidates.length === 0) {
        return res.status(502).json({
            error: 'Lead scraping failed before any leads were inserted.',
            details: errors.join(' | ')
        });
    }

    const { insertedLeads, skipped } = insertLeadCandidates(candidates.slice(0, count), niche);

    res.json({
        leads: insertedLeads,
        skipped,
        source,
        candidateCount: candidates.length,
        warnings: errors
    });
});

// Approve and Launch Campaign Endpoint
app.post('/api/campaigns/:id/approve', async (req, res) => {
    try {
        const campaignId = parseInt(req.params.id);
        const { steps, bizName, bizWebsite } = req.body;
        
        const campaign = db.getCampaignById(campaignId);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
        
        // Update campaign steps if edited in queue
        if (steps) {
            campaign.steps = steps;
            db.insertCampaign({
                name: campaign.name,
                type: campaign.type,
                instructions: campaign.instructions,
                videoAsset: campaign.videoAsset,
                status: 'Active',
                steps: steps
            });
            db.deleteCampaign(campaignId); // remove the pending one
        } else {
            db.updateCampaignStatus(campaignId, 'Active');
        }
        
        // Get target leads (stage is 'Scraped')
        const targetLeads = db.getLeads({ stage: 'Scraped', limit: 1000 });
        const step1 = campaign.steps[0];
        
        for (const lead of targetLeads) {
            // Customize body
            let customizedBody = step1.body
                .replace(/\[Lead Name\]/g, lead.name.split(" ")[0])
                .replace(/\[Agent Name\]/g, lead.name.split(" ")[0])
                .replace(/\[Your Name\]/g, bizName || 'our team')
                .replace(/\[CTA Link\]/g, campaign.videoAsset || bizWebsite || '');
            
            // Send email
            try {
                await sendMailgunEmail({
                    to: lead.email,
                    subject: step1.subject,
                    text: customizedBody
                });
                
                lead.stage = 'Emailed';
                lead.currentCampaignId = campaignId;
                lead.currentCampaignStep = 1;
                if (!lead.history) lead.history = [];
                lead.history.push({
                    sender: 'agent',
                    time: new Date().toLocaleTimeString(),
                    text: `[OUTBOUND EMAIL]\nSubject: ${step1.subject}\n\n${customizedBody}`
                });
                
                db.updateLead(lead);
            } catch (err) {
                console.error(`[Campaign Approve] Failed to send to ${lead.email}:`, err.message);
            }
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error('[Campaign Approve Error]', err.message);
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
    const { campaignName, campaignType, customInstructions, videoAsset, bizName, bizDesc, bizWebsite } = req.body;
    console.log(`[Campaign Agent] Generating 3-step drip campaign for: "${campaignName}"...`);
    
    const prompt = `You are an AI Outbound Copywriter and email marketer.
We are building a 3-step outbound sales email campaign named "${campaignName}" for our company: "${bizName || 'CRM Pro'}".
Company Value Proposition & Description: ${bizDesc || 'CRM automation for realtors'}

Campaign Type: ${campaignType || 'cold-outreach'}
Target Pain Points & Value: ${customInstructions || 'Realtors waste too much time on paperwork. CRM Pro automates it.'}
${videoAsset ? `Featured Video / Resource Link: ${videoAsset}` : ""}

Generate a highly engaging, high-converting 3-step outbound email drip sequence.
For each step (Step 1: Cold outreach/Intro, Step 2: Value and offer, Step 3: Call-to-action follow-up), provide:
1. Subject line (engaging, high open rate, curious or benefit-driven).
2. Email Body copy (persuasive, addressing pain points, and containing a placeholder link like [CTA Link]).

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
        
        const settings = readJsonFile(path.join(DATA_DIR, 'crm-settings.json'), { bypassEmailVerification: false });
        const status = settings.bypassEmailVerification ? 'Active' : 'Awaiting Launch';
        
        const campaignId = db.insertCampaign({
            name: campaignName,
            type: campaignType,
            instructions: customInstructions,
            videoAsset,
            status,
            steps
        });
        
        const campaign = {
            id: campaignId,
            name: campaignName,
            type: campaignType,
            instructions: customInstructions,
            videoAsset,
            status,
            steps,
            dateCreated: new Date().toLocaleDateString()
        };
        
        // If bypass is active, launch immediately
        if (settings.bypassEmailVerification) {
            const targetLeads = db.getLeads({ stage: 'Scraped', limit: 1000 });
            const step1 = steps[0];
            
            for (const lead of targetLeads) {
                let customizedBody = step1.body
                    .replace(/\[Lead Name\]/g, lead.name.split(" ")[0])
                    .replace(/\[Agent Name\]/g, lead.name.split(" ")[0])
                    .replace(/\[Your Name\]/g, bizName || 'our team')
                    .replace(/\[CTA Link\]/g, videoAsset || bizWebsite || '');
                
                try {
                    await sendMailgunEmail({
                        to: lead.email,
                        subject: step1.subject,
                        text: customizedBody
                    });
                    
                    lead.stage = 'Emailed';
                    lead.currentCampaignId = campaignId;
                    lead.currentCampaignStep = 1;
                    if (!lead.history) lead.history = [];
                    lead.history.push({
                        sender: 'agent',
                        time: new Date().toLocaleTimeString(),
                        text: `[OUTBOUND EMAIL]\nSubject: ${step1.subject}\n\n${customizedBody}`
                    });
                    
                    db.updateLead(lead);
                } catch (err) {
                    console.error(`[Campaign Auto-Launch] Failed for ${lead.email}:`, err.message);
                }
            }
        }
        
        res.json({ success: true, campaign });
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
        
        const campaignId = db.insertCampaign({
            name: campaignName,
            type: campaignType,
            instructions: customInstructions,
            videoAsset,
            status: 'Awaiting Launch',
            steps: fallbackSteps
        });
        
        res.json({
            success: true,
            campaign: {
                id: campaignId,
                name: campaignName,
                type: campaignType,
                instructions: customInstructions,
                videoAsset,
                status: 'Awaiting Launch',
                steps: fallbackSteps,
                dateCreated: new Date().toLocaleDateString()
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

    const filename = `gen_${Date.now()}_${Math.floor(Math.random() * 999999)}.jpg`;
    const localPath = path.join(downloadsDir, filename);

    // 1. Try to generate using Google's Imagen 4 model with the user's GEMINI_API_KEY
    if (GEMINI_API_KEY) {
        console.log(`[AI Image Agent] Attempting to generate image using Gemini Imagen 4...`);
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
                        mediaUrl: `/downloads/${filename}`
                    });
                }
            } else {
                console.warn(`[AI Image Agent] Imagen 4 API returned status: ${response.status} ${response.statusText}`);
            }
        } catch (err) {
            console.warn(`[AI Image Agent] Imagen 4 API request failed:`, err.message);
        }
    }

    // 2. Fallback to local stock photos if Gemini Imagen 4 fails
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
                mediaUrl: `/downloads/${filename}`
            });
        }
    } catch (copyErr) {
        console.error(`[AI Image Agent] Fallback copy failed:`, copyErr.message);
    }

    // Ultimate fallback: return a direct high-quality Unsplash URL directly to the browser
    const directUrls = [
        "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80"
    ];
    const ultimateUrl = directUrls[Math.floor(Math.random() * directUrls.length)];
    return res.json({
        success: true,
        mediaUrl: ultimateUrl
    });
});


// fs storage path configuration

const CREDENTIALS_FILE = path.join(__dirname, 'credentials.json');
const TOKENS_FILE = path.join(__dirname, 'tokens.json');

function getCredentials() {
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
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), 'utf8');
}

function getTokens() {
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
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
}

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
        for (const platform of platforms) {
            results[platform] = { success: true, message: "Published successfully (Simulation Fallback - Webhook not set)." };
        }
        return res.json(results);
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

app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 Autopilot Agency backend server active!`);
    console.log(`🔗 Local dashboard hosted at: http://localhost:${PORT}`);
    console.log(`==================================================`);
});
