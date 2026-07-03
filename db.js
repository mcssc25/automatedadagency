const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'crm.db');
const db = new DatabaseSync(DB_PATH);

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function normalizeText(value) {
    return String(value || '').trim();
}

function parseHistory(history) {
    if (Array.isArray(history)) return history;
    try {
        return JSON.parse(history || '[]');
    } catch {
        return [];
    }
}

function prepareLeadRow(row) {
    if (!row) return null;
    return {
        ...row,
        history: parseHistory(row.history)
    };
}

function migrateExistingData() {
    db.exec(`
        UPDATE leads
        SET email = LOWER(TRIM(email))
        WHERE email IS NOT NULL;

        UPDATE dnc_list
        SET email = LOWER(TRIM(email))
        WHERE email IS NOT NULL;
    `);

    db.exec(`
        DELETE FROM dnc_list
        WHERE rowid NOT IN (
            SELECT MIN(rowid)
            FROM dnc_list
            GROUP BY LOWER(email)
        );
    `);

    const duplicateLeads = db.prepare(`
        SELECT LOWER(email) AS email_key, MIN(id) AS keep_id
        FROM leads
        GROUP BY LOWER(email)
        HAVING COUNT(*) > 1
    `).all();

    const getDupes = db.prepare('SELECT * FROM leads WHERE LOWER(email) = ? ORDER BY id ASC');
    const updateKeep = db.prepare(`
        UPDATE leads
        SET history = ?, stage = ?, currentCampaignId = ?, currentCampaignStep = ?
        WHERE id = ?
    `);
    const deleteDupes = db.prepare('DELETE FROM leads WHERE LOWER(email) = ? AND id <> ?');

    for (const duplicate of duplicateLeads) {
        const rows = getDupes.all(duplicate.email_key);
        const mergedHistory = [];
        let finalStage = rows[0].stage || 'Scraped';
        let currentCampaignId = rows[0].currentCampaignId || null;
        let currentCampaignStep = rows[0].currentCampaignStep || null;

        for (const row of rows) {
            mergedHistory.push(...parseHistory(row.history));
            if (row.stage === 'DNC' || row.stage === 'Opted Out') finalStage = row.stage;
            if (row.currentCampaignId) currentCampaignId = row.currentCampaignId;
            if (row.currentCampaignStep) currentCampaignStep = row.currentCampaignStep;
        }

        updateKeep.run(JSON.stringify(mergedHistory), finalStage, currentCampaignId, currentCampaignStep, duplicate.keep_id);
        deleteDupes.run(duplicate.email_key, duplicate.keep_id);
    }
}

function ensureColumn(table, column, definition) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some(col => col.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

// Initialize Database Schema
function initDb() {
    // 1. Leads Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            company TEXT,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            website TEXT,
            address TEXT,
            sourceUrl TEXT,
            discoveryQuery TEXT,
            stage TEXT NOT NULL DEFAULT 'Scraped',
            history TEXT NOT NULL DEFAULT '[]',
            currentCampaignId INTEGER,
            currentCampaignStep INTEGER,
            lastStepTime INTEGER,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    ensureColumn('leads', 'address', 'TEXT');
    ensureColumn('leads', 'sourceUrl', 'TEXT');
    ensureColumn('leads', 'discoveryQuery', 'TEXT');
    ensureColumn('leads', 'lastStepTime', 'INTEGER');

    // 2. DNC List Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS dnc_list (
            email TEXT PRIMARY KEY UNIQUE NOT NULL,
            addedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            reason TEXT
        )
    `);

    // 3. Campaigns Table
    db.exec(`
        CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT,
            instructions TEXT,
            videoAsset TEXT,
            status TEXT NOT NULL DEFAULT 'Active',
            steps TEXT NOT NULL DEFAULT '[]',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 4. Campaign Enrollment Ledger
    db.exec(`
        CREATE TABLE IF NOT EXISTS campaign_enrollments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            leadId INTEGER NOT NULL,
            campaignId INTEGER NOT NULL,
            campaignOrder INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'Active',
            currentStep INTEGER NOT NULL DEFAULT 0,
            nextActionAt TEXT,
            lastSentAt TEXT,
            completedAt TEXT,
            createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (leadId) REFERENCES leads(id),
            FOREIGN KEY (campaignId) REFERENCES campaigns(id)
        )
    `);

    // 5. Hidden lead intelligence database
    db.exec(`
        CREATE TABLE IF NOT EXISTS market_cities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city TEXT NOT NULL,
            state TEXT NOT NULL,
            metro TEXT,
            incomeBand TEXT,
            priority INTEGER NOT NULL DEFAULT 50,
            status TEXT NOT NULL DEFAULT 'Pending',
            lastDiscoveryAt TEXT,
            createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(city, state)
        );

        CREATE TABLE IF NOT EXISTS brokerage_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            category TEXT,
            website TEXT,
            nationalWebsite TEXT,
            crmOffering TEXT,
            esignOffering TEXT,
            leadTools TEXT,
            videoEmail TEXT,
            techStackJson TEXT NOT NULL DEFAULT '{}',
            notes TEXT,
            researchStatus TEXT NOT NULL DEFAULT 'Pending',
            researchedAt TEXT,
            createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS brokerage_offices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brokerageProfileId INTEGER,
            brokerageName TEXT NOT NULL,
            city TEXT NOT NULL,
            state TEXT NOT NULL,
            searchQuery TEXT,
            website TEXT,
            rosterUrl TEXT,
            sourceUrl TEXT,
            status TEXT NOT NULL DEFAULT 'Pending',
            lastHarvestAt TEXT,
            nextHarvestAt TEXT,
            lastError TEXT,
            rosterPageCount INTEGER NOT NULL DEFAULT 0,
            contactCount INTEGER NOT NULL DEFAULT 0,
            createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(brokerageName, city, state),
            FOREIGN KEY (brokerageProfileId) REFERENCES brokerage_profiles(id)
        );

        CREATE TABLE IF NOT EXISTS roster_contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brokerageOfficeId INTEGER,
            brokerageName TEXT NOT NULL,
            city TEXT,
            state TEXT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            website TEXT,
            sourceUrl TEXT,
            socialsJson TEXT NOT NULL DEFAULT '{}',
            productionBand TEXT,
            teamSizeHint TEXT,
            status TEXT NOT NULL DEFAULT 'Raw',
            createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (brokerageOfficeId) REFERENCES brokerage_offices(id)
        );

        CREATE TABLE IF NOT EXISTS intelligence_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Running',
            brokerageOfficeId INTEGER,
            cityId INTEGER,
            startedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            finishedAt TEXT,
            message TEXT,
            statsJson TEXT NOT NULL DEFAULT '{}',
            error TEXT,
            FOREIGN KEY (brokerageOfficeId) REFERENCES brokerage_offices(id),
            FOREIGN KEY (cityId) REFERENCES market_cities(id)
        );
    `);

    migrateExistingData();

    db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email_nocase
        ON leads(LOWER(email));

        CREATE INDEX IF NOT EXISTS idx_leads_name_nocase
        ON leads(LOWER(name));

        CREATE UNIQUE INDEX IF NOT EXISTS idx_dnc_email_nocase
        ON dnc_list(LOWER(email));

        CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_lead_status
        ON campaign_enrollments(leadId, status);

        CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_next_action
        ON campaign_enrollments(status, nextActionAt);

        CREATE INDEX IF NOT EXISTS idx_market_cities_status_priority
        ON market_cities(status, priority DESC, lastDiscoveryAt);

        CREATE INDEX IF NOT EXISTS idx_brokerage_profiles_status
        ON brokerage_profiles(researchStatus, updatedAt);

        CREATE INDEX IF NOT EXISTS idx_brokerage_offices_status_next
        ON brokerage_offices(status, nextHarvestAt, updatedAt);

        CREATE INDEX IF NOT EXISTS idx_roster_contacts_brokerage
        ON roster_contacts(brokerageName, city, state);

        CREATE INDEX IF NOT EXISTS idx_intelligence_runs_started
        ON intelligence_runs(startedAt DESC);
    `);
    
    console.log('[Database] SQLite (node:sqlite) initialized successfully.');
}

// Leads DAO
const RESPONDED_LEAD_STAGES = [
    'Two-Way Conversation',
    'Hot Lead',
    'Demo Scheduled',
    'Needs Human Action',
    'Opted Out'
];

function appendRespondedLeadFilter(sql, params) {
    sql += ` AND (
        stage IN (${RESPONDED_LEAD_STAGES.map(() => '?').join(', ')})
        OR history LIKE '%"sender":"lead"%'
        OR history LIKE '%"sender": "lead"%'
    )`;
    params.push(...RESPONDED_LEAD_STAGES);
    return sql;
}

function getLeads({ stage, search, limit = 50, offset = 0, respondedOnly = false } = {}) {
    let sql = 'SELECT * FROM leads WHERE 1=1';
    const params = [];

    if (respondedOnly) {
        sql = appendRespondedLeadFilter(sql, params);
    }
    
    if (stage && stage !== 'All') {
        sql += ' AND stage = ?';
        params.push(stage);
    }
    
    if (search) {
        sql += ' AND (name LIKE ? OR company LIKE ? OR email LIKE ?)';
        const searchWild = `%${search}%`;
        params.push(searchWild, searchWild, searchWild);
    }
    
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map(prepareLeadRow);
}

function getLeadsCount({ stage, search, respondedOnly = false } = {}) {
    let sql = 'SELECT COUNT(*) as count FROM leads WHERE 1=1';
    const params = [];

    if (respondedOnly) {
        sql = appendRespondedLeadFilter(sql, params);
    }
    
    if (stage && stage !== 'All') {
        sql += ' AND stage = ?';
        params.push(stage);
    }
    
    if (search) {
        sql += ' AND (name LIKE ? OR company LIKE ? OR email LIKE ?)';
        const searchWild = `%${search}%`;
        params.push(searchWild, searchWild, searchWild);
    }
    
    const stmt = db.prepare(sql);
    const result = stmt.get(...params);
    return result ? result.count : 0;
}

function getLeadStageCounts() {
    const stmt = db.prepare('SELECT stage, COUNT(*) as count FROM leads GROUP BY stage');
    const rows = stmt.all();
    return rows.reduce((counts, row) => {
        counts[row.stage || 'Unknown'] = row.count;
        return counts;
    }, {});
}

function getLeadById(id) {
    const stmt = db.prepare('SELECT * FROM leads WHERE id = ?');
    const row = stmt.get(id);
    return prepareLeadRow(row);
}

function getLeadByEmail(email) {
    const stmt = db.prepare('SELECT * FROM leads WHERE LOWER(email) = ?');
    const row = stmt.get(normalizeEmail(email));
    return prepareLeadRow(row);
}

function insertLead({ name, company, email, phone, website, address, sourceUrl, discoveryQuery, stage = 'Scraped', history = [] }) {
    const emailClean = normalizeEmail(email);
    if (!emailClean) return null;

    const historyStr = JSON.stringify(history);
    
    // Check if already DNC
    const dncStmt = db.prepare('SELECT 1 FROM dnc_list WHERE LOWER(email) = ?');
    const isDnc = dncStmt.get(emailClean);
    const finalStage = isDnc ? 'DNC' : stage;
    
    try {
        const stmt = db.prepare(
            `INSERT OR IGNORE INTO leads (name, company, email, phone, website, address, sourceUrl, discoveryQuery, stage, history) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const result = stmt.run(
            normalizeText(name),
            normalizeText(company),
            emailClean,
            normalizeText(phone),
            normalizeText(website),
            normalizeText(address),
            normalizeText(sourceUrl),
            normalizeText(discoveryQuery),
            finalStage,
            historyStr
        );
        return result.changes > 0 ? result.lastInsertRowid : null;
    } catch (err) {
        console.error('[Database] Failed to insert lead:', err.message);
        return null;
    }
}

function updateLead(lead) {
    const emailClean = normalizeEmail(lead.email);
    if (!emailClean) throw new Error('Lead email is required');

    const isDnc = isEmailDnc(emailClean) || ['DNC', 'Opted Out', 'Quarantined'].includes(lead.stage);
    const finalStage = isDnc ? 'Quarantined' : lead.stage;
    const historyStr = JSON.stringify(lead.history || []);
    const stmt = db.prepare(
        `UPDATE leads SET name = ?, company = ?, email = ?, phone = ?, website = ?, address = ?, sourceUrl = ?, discoveryQuery = ?, stage = ?, 
         history = ?, currentCampaignId = ?, currentCampaignStep = ?, lastStepTime = ? WHERE id = ?`
    );
    const result = stmt.run(
        normalizeText(lead.name), 
        normalizeText(lead.company), 
        emailClean, 
        normalizeText(lead.phone), 
        normalizeText(lead.website), 
        normalizeText(lead.address),
        normalizeText(lead.sourceUrl),
        normalizeText(lead.discoveryQuery),
        finalStage, 
        historyStr,
        isDnc ? null : (lead.currentCampaignId || null),
        isDnc ? null : (lead.currentCampaignStep || null),
        isDnc ? null : (lead.lastStepTime || null),
        lead.id
    );
    return result.changes;
}

function deleteLead(id) {
    const deleteEnrollments = db.prepare('DELETE FROM campaign_enrollments WHERE leadId = ?');
    const deleteLeadRow = db.prepare('DELETE FROM leads WHERE id = ?');
    try {
        db.exec('BEGIN');
        deleteEnrollments.run(id);
        const changes = deleteLeadRow.run(id).changes;
        db.exec('COMMIT');
        return changes;
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }
}

// DNC DAO
function isEmailDnc(email) {
    const stmt = db.prepare('SELECT 1 FROM dnc_list WHERE LOWER(email) = ?');
    const row = stmt.get(normalizeEmail(email));
    return !!row;
}

function addEmailToDnc(email, reason = 'Manual request') {
    const emailClean = normalizeEmail(email);
    if (!emailClean) throw new Error('Email is required');
    // 1. Insert to DNC list
    const dncStmt = db.prepare('INSERT INTO dnc_list (email, reason) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET reason = COALESCE(excluded.reason, dnc_list.reason)');
    dncStmt.run(emailClean, reason);
    
    // 2. Update all matching active leads to DNC stage
    const updateStmt = db.prepare("UPDATE leads SET stage = 'Quarantined', currentCampaignId = NULL, currentCampaignStep = NULL, lastStepTime = NULL WHERE LOWER(email) = ?");
    updateStmt.run(emailClean);
    pauseLeadEnrollmentsByEmail(emailClean, 'Quarantined');
}

function getDncList() {
    const stmt = db.prepare('SELECT * FROM dnc_list ORDER BY addedAt DESC');
    return stmt.all();
}

function removeEmailFromDnc(email) {
    const stmt = db.prepare('DELETE FROM dnc_list WHERE LOWER(email) = ?');
    stmt.run(normalizeEmail(email));
}

// Campaigns DAO
function getCampaigns() {
    const stmt = db.prepare('SELECT * FROM campaigns ORDER BY id DESC');
    const rows = stmt.all();
    return rows.map(row => ({
        ...row,
        steps: parseHistory(row.steps)
    }));
}

function getCampaignById(id) {
    const stmt = db.prepare('SELECT * FROM campaigns WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return null;
    return {
        ...row,
        steps: parseHistory(row.steps)
    };
}

function insertCampaign({ name, type, instructions, videoAsset, status = 'Active', steps = [] }) {
    const stepsStr = JSON.stringify(steps);
    const stmt = db.prepare(
        `INSERT INTO campaigns (name, type, instructions, videoAsset, status, steps) 
         VALUES (?, ?, ?, ?, ?, ?)`
    );
    const result = stmt.run(name, type, instructions, videoAsset, status, stepsStr);
    return result.lastInsertRowid;
}

function updateCampaignStatus(id, status) {
    const stmt = db.prepare('UPDATE campaigns SET status = ? WHERE id = ?');
    const result = stmt.run(status, id);
    return result.changes;
}

function updateCampaign({ id, name, type, instructions, videoAsset, status = 'Active', steps = [] }) {
    const stepsStr = JSON.stringify(steps);
    const stmt = db.prepare(
        `UPDATE campaigns
         SET name = ?, type = ?, instructions = ?, videoAsset = ?, status = ?, steps = ?
         WHERE id = ?`
    );
    const result = stmt.run(name, type, instructions, videoAsset, status, stepsStr, id);
    return result.changes;
}

function deleteCampaign(id) {
    const stmt = db.prepare('DELETE FROM campaigns WHERE id = ?');
    const result = stmt.run(id);
    return result.changes;
}

function getActiveEnrollmentForLead(leadId) {
    const stmt = db.prepare(`
        SELECT e.*, c.name AS campaignName
        FROM campaign_enrollments e
        LEFT JOIN campaigns c ON c.id = e.campaignId
        WHERE e.leadId = ? AND e.status IN ('Active', 'Paused')
        ORDER BY e.id DESC
        LIMIT 1
    `);
    return stmt.get(leadId) || null;
}

function getEnrollmentsForLead(leadId) {
    const stmt = db.prepare(`
        SELECT e.*, c.name AS campaignName
        FROM campaign_enrollments e
        LEFT JOIN campaigns c ON c.id = e.campaignId
        WHERE e.leadId = ?
        ORDER BY e.id DESC
    `);
    return stmt.all(leadId);
}

function getDueEnrollments(nowIso = new Date().toISOString(), limit = 100) {
    const stmt = db.prepare(`
        SELECT e.*, c.name AS campaignName
        FROM campaign_enrollments e
        JOIN campaigns c ON c.id = e.campaignId
        WHERE e.status = 'Active'
          AND (e.nextActionAt IS NULL OR e.nextActionAt <= ?)
        ORDER BY COALESCE(e.nextActionAt, e.createdAt) ASC
        LIMIT ?
    `);
    return stmt.all(nowIso, limit);
}

function insertEnrollment({ leadId, campaignId, campaignOrder = 1, status = 'Active', currentStep = 0, nextActionAt = null }) {
    const existing = db.prepare(`
        SELECT id FROM campaign_enrollments
        WHERE leadId = ? AND campaignId = ? AND status IN ('Active', 'Paused')
        LIMIT 1
    `).get(leadId, campaignId);
    if (existing) return existing.id;

    const stmt = db.prepare(`
        INSERT INTO campaign_enrollments (leadId, campaignId, campaignOrder, status, currentStep, nextActionAt)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(leadId, campaignId, campaignOrder, status, currentStep, nextActionAt);
    return result.lastInsertRowid;
}

function updateEnrollment(id, changes = {}) {
    const allowed = ['status', 'currentStep', 'nextActionAt', 'lastSentAt', 'completedAt', 'campaignOrder'];
    const keys = allowed.filter(key => Object.prototype.hasOwnProperty.call(changes, key));
    if (keys.length === 0) return 0;

    const assignments = keys.map(key => `${key} = ?`).join(', ');
    const values = keys.map(key => changes[key]);
    values.push(new Date().toISOString(), id);
    const stmt = db.prepare(`UPDATE campaign_enrollments SET ${assignments}, updatedAt = ? WHERE id = ?`);
    return stmt.run(...values).changes;
}

function pauseLeadEnrollments(leadId, status = 'Paused') {
    const stmt = db.prepare(`
        UPDATE campaign_enrollments
        SET status = ?, updatedAt = ?
        WHERE leadId = ? AND status = 'Active'
    `);
    return stmt.run(status, new Date().toISOString(), leadId).changes;
}

function pauseLeadEnrollmentsByEmail(email, status = 'Paused') {
    const lead = getLeadByEmail(email);
    if (!lead) return 0;
    return pauseLeadEnrollments(lead.id, status);
}

function safeJsonParse(value, fallback = {}) {
    try {
        return JSON.parse(value || JSON.stringify(fallback));
    } catch {
        return fallback;
    }
}

function prepareBrokerageProfile(row) {
    if (!row) return null;
    return {
        ...row,
        techStack: safeJsonParse(row.techStackJson, {})
    };
}

function prepareRosterContact(row) {
    if (!row) return null;
    return {
        ...row,
        socials: safeJsonParse(row.socialsJson, {})
    };
}

function seedMarketCities(cities = []) {
    const stmt = db.prepare(`
        INSERT INTO market_cities (city, state, metro, incomeBand, priority)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(city, state) DO UPDATE SET
            metro = COALESCE(excluded.metro, market_cities.metro),
            incomeBand = COALESCE(excluded.incomeBand, market_cities.incomeBand),
            priority = MAX(market_cities.priority, excluded.priority),
            updatedAt = CURRENT_TIMESTAMP
    `);

    let count = 0;
    for (const city of cities) {
        if (!city || !city.city || !city.state) continue;
        const result = stmt.run(
            normalizeText(city.city),
            normalizeText(city.state),
            normalizeText(city.metro),
            normalizeText(city.incomeBand),
            parseInt(city.priority, 10) || 50
        );
        count += result.changes || 0;
    }
    return count;
}

function getNextMarketCityForDiscovery() {
    const stmt = db.prepare(`
        SELECT *
        FROM market_cities
        WHERE status IN ('Pending', 'Ready', 'Discovered')
        ORDER BY
            CASE WHEN lastDiscoveryAt IS NULL THEN 0 ELSE 1 END,
            priority DESC,
            COALESCE(lastDiscoveryAt, createdAt) ASC
        LIMIT 1
    `);
    return stmt.get();
}

function updateMarketCity(id, changes = {}) {
    const allowed = ['status', 'lastDiscoveryAt', 'priority'];
    const keys = allowed.filter(key => Object.prototype.hasOwnProperty.call(changes, key));
    if (!id || keys.length === 0) return 0;

    const assignments = keys.map(key => `${key} = ?`).join(', ');
    const values = keys.map(key => changes[key]);
    values.push(id);
    return db.prepare(`UPDATE market_cities SET ${assignments}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...values).changes;
}

function upsertBrokerageProfile(profile = {}) {
    const name = normalizeText(profile.name);
    if (!name) return null;

    const stmt = db.prepare(`
        INSERT INTO brokerage_profiles (
            name, category, website, nationalWebsite, crmOffering, esignOffering,
            leadTools, videoEmail, techStackJson, notes, researchStatus, researchedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
            category = COALESCE(excluded.category, brokerage_profiles.category),
            website = COALESCE(excluded.website, brokerage_profiles.website),
            nationalWebsite = COALESCE(excluded.nationalWebsite, brokerage_profiles.nationalWebsite),
            crmOffering = COALESCE(excluded.crmOffering, brokerage_profiles.crmOffering),
            esignOffering = COALESCE(excluded.esignOffering, brokerage_profiles.esignOffering),
            leadTools = COALESCE(excluded.leadTools, brokerage_profiles.leadTools),
            videoEmail = COALESCE(excluded.videoEmail, brokerage_profiles.videoEmail),
            techStackJson = CASE WHEN excluded.techStackJson <> '{}' THEN excluded.techStackJson ELSE brokerage_profiles.techStackJson END,
            notes = COALESCE(excluded.notes, brokerage_profiles.notes),
            researchStatus = COALESCE(excluded.researchStatus, brokerage_profiles.researchStatus),
            researchedAt = COALESCE(excluded.researchedAt, brokerage_profiles.researchedAt),
            updatedAt = CURRENT_TIMESTAMP
    `);

    stmt.run(
        name,
        normalizeText(profile.category),
        normalizeText(profile.website),
        normalizeText(profile.nationalWebsite),
        normalizeText(profile.crmOffering),
        normalizeText(profile.esignOffering),
        normalizeText(profile.leadTools),
        normalizeText(profile.videoEmail),
        JSON.stringify(profile.techStack || profile.techStackJson || {}),
        normalizeText(profile.notes),
        normalizeText(profile.researchStatus || 'Pending'),
        profile.researchedAt || null
    );

    return getBrokerageProfileByName(name);
}

function getBrokerageProfileByName(name) {
    const row = db.prepare('SELECT * FROM brokerage_profiles WHERE LOWER(name) = LOWER(?)').get(normalizeText(name));
    return prepareBrokerageProfile(row);
}

function getBrokerageResearch({ search = '', limit = 30 } = {}) {
    const params = [];
    let where = '';

    if (search) {
        where = `
            WHERE p.name LIKE ?
               OR p.category LIKE ?
               OR p.crmOffering LIKE ?
               OR p.esignOffering LIKE ?
               OR p.leadTools LIKE ?
               OR p.notes LIKE ?
        `;
        const wild = `%${search}%`;
        params.push(wild, wild, wild, wild, wild, wild);
    }

    params.push(Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100));

    const rows = db.prepare(`
        SELECT
            p.*,
            COUNT(DISTINCT o.id) AS officesCount,
            SUM(CASE WHEN o.status = 'Harvested' THEN 1 ELSE 0 END) AS harvestedOffices,
            SUM(CASE WHEN o.status IN ('Pending', 'Discovered', 'Retry') THEN 1 ELSE 0 END) AS queuedOffices,
            SUM(CASE WHEN o.status = 'Blocked' THEN 1 ELSE 0 END) AS blockedOffices,
            MAX(o.updatedAt) AS lastOfficeUpdate,
            COALESCE(rc.contactsCount, 0) AS contactsCount
        FROM brokerage_profiles p
        LEFT JOIN brokerage_offices o
            ON o.brokerageProfileId = p.id
            OR LOWER(o.brokerageName) = LOWER(p.name)
        LEFT JOIN (
            SELECT LOWER(brokerageName) AS brokerageKey, COUNT(*) AS contactsCount
            FROM roster_contacts
            GROUP BY LOWER(brokerageName)
        ) rc ON rc.brokerageKey = LOWER(p.name)
        ${where}
        GROUP BY p.id
        ORDER BY
            COALESCE(rc.contactsCount, 0) DESC,
            harvestedOffices DESC,
            officesCount DESC,
            COALESCE(p.researchedAt, p.updatedAt) DESC
        LIMIT ?
    `).all(...params);

    const officesByBrokerage = db.prepare(`
        SELECT brokerageName, city, state, status, contactCount, rosterPageCount, rosterUrl, website, lastHarvestAt, lastError
        FROM brokerage_offices
        WHERE LOWER(brokerageName) = LOWER(?)
        ORDER BY
            CASE status WHEN 'Harvested' THEN 0 WHEN 'Pending' THEN 1 WHEN 'Discovered' THEN 2 WHEN 'Blocked' THEN 3 ELSE 4 END,
            updatedAt DESC
        LIMIT 5
    `);

    return rows.map(row => ({
        ...prepareBrokerageProfile(row),
        officesCount: row.officesCount || 0,
        harvestedOffices: row.harvestedOffices || 0,
        queuedOffices: row.queuedOffices || 0,
        blockedOffices: row.blockedOffices || 0,
        contactsCount: row.contactsCount || 0,
        lastOfficeUpdate: row.lastOfficeUpdate || null,
        offices: officesByBrokerage.all(row.name)
    }));
}

function getNextBrokerageProfileForResearch() {
    const row = db.prepare(`
        SELECT *
        FROM brokerage_profiles
        WHERE researchStatus IN ('Pending', 'Needs Research')
        ORDER BY updatedAt ASC
        LIMIT 1
    `).get();
    return prepareBrokerageProfile(row);
}

function upsertBrokerageOffice(office = {}) {
    const brokerageName = normalizeText(office.brokerageName || office.name);
    const city = normalizeText(office.city);
    const state = normalizeText(office.state);
    if (!brokerageName || !city || !state) return null;

    const profile = upsertBrokerageProfile({
        name: brokerageName,
        category: office.category,
        website: office.nationalWebsite || office.website
    });

    const stmt = db.prepare(`
        INSERT INTO brokerage_offices (
            brokerageProfileId, brokerageName, city, state, searchQuery, website, rosterUrl, sourceUrl, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(brokerageName, city, state) DO UPDATE SET
            brokerageProfileId = COALESCE(excluded.brokerageProfileId, brokerage_offices.brokerageProfileId),
            searchQuery = COALESCE(NULLIF(excluded.searchQuery, ''), brokerage_offices.searchQuery),
            website = COALESCE(NULLIF(excluded.website, ''), brokerage_offices.website),
            rosterUrl = COALESCE(NULLIF(excluded.rosterUrl, ''), brokerage_offices.rosterUrl),
            sourceUrl = COALESCE(NULLIF(excluded.sourceUrl, ''), brokerage_offices.sourceUrl),
            status = CASE
                WHEN excluded.status = 'Pending' THEN brokerage_offices.status
                WHEN brokerage_offices.status = 'Harvested' THEN brokerage_offices.status
                ELSE COALESCE(NULLIF(excluded.status, ''), brokerage_offices.status)
            END,
            updatedAt = CASE
                WHEN excluded.status = 'Pending'
                  AND NULLIF(excluded.website, '') IS NULL
                  AND NULLIF(excluded.rosterUrl, '') IS NULL
                  AND NULLIF(excluded.sourceUrl, '') IS NULL
                THEN brokerage_offices.updatedAt
                ELSE CURRENT_TIMESTAMP
            END
    `);

    stmt.run(
        profile && profile.id,
        brokerageName,
        city,
        state,
        normalizeText(office.searchQuery || `${brokerageName} ${city} ${state}`),
        normalizeText(office.website),
        normalizeText(office.rosterUrl),
        normalizeText(office.sourceUrl),
        normalizeText(office.status || 'Pending')
    );

    return db.prepare('SELECT * FROM brokerage_offices WHERE brokerageName = ? AND city = ? AND state = ?').get(brokerageName, city, state);
}

function getNextBrokerageOfficeForHarvest() {
    return db.prepare(`
        SELECT *
        FROM brokerage_offices
        WHERE status IN ('Pending', 'Discovered', 'Retry')
          AND (nextHarvestAt IS NULL OR nextHarvestAt <= CURRENT_TIMESTAMP)
        ORDER BY
            CASE status WHEN 'Discovered' THEN 0 WHEN 'Pending' THEN 1 ELSE 2 END,
            updatedAt ASC
        LIMIT 1
    `).get();
}

function updateBrokerageOffice(id, changes = {}) {
    const allowed = ['website', 'rosterUrl', 'sourceUrl', 'status', 'lastHarvestAt', 'nextHarvestAt', 'lastError', 'rosterPageCount', 'contactCount'];
    const keys = allowed.filter(key => Object.prototype.hasOwnProperty.call(changes, key));
    if (!id || keys.length === 0) return 0;

    const assignments = keys.map(key => `${key} = ?`).join(', ');
    const values = keys.map(key => changes[key]);
    values.push(id);
    return db.prepare(`UPDATE brokerage_offices SET ${assignments}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).run(...values).changes;
}

function suppressQueuedBrokerageBrand(brokerageName, reason = '', exceptOfficeId = null) {
    const name = normalizeText(brokerageName);
    if (!name) return 0;

    const clauses = [
        'LOWER(brokerageName) = LOWER(?)',
        "status IN ('Pending', 'Discovered', 'Retry')"
    ];
    const values = [normalizeText(reason), name];

    if (exceptOfficeId) {
        clauses.push('id <> ?');
        values.push(exceptOfficeId);
    }

    return db.prepare(`
        UPDATE brokerage_offices
        SET status = 'Skipped Brand',
            lastError = ?,
            updatedAt = CURRENT_TIMESTAMP
        WHERE ${clauses.join(' AND ')}
    `).run(...values).changes;
}

function upsertRosterContact(contact = {}) {
    const email = normalizeEmail(contact.email);
    const name = normalizeText(contact.name);
    const brokerageName = normalizeText(contact.brokerageName);
    if (!email || !name || !brokerageName) return null;

    const stmt = db.prepare(`
        INSERT INTO roster_contacts (
            brokerageOfficeId, brokerageName, city, state, name, email, phone,
            website, sourceUrl, socialsJson, productionBand, teamSizeHint, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
            brokerageOfficeId = COALESCE(excluded.brokerageOfficeId, roster_contacts.brokerageOfficeId),
            brokerageName = COALESCE(excluded.brokerageName, roster_contacts.brokerageName),
            city = COALESCE(excluded.city, roster_contacts.city),
            state = COALESCE(excluded.state, roster_contacts.state),
            name = COALESCE(excluded.name, roster_contacts.name),
            phone = COALESCE(excluded.phone, roster_contacts.phone),
            website = COALESCE(excluded.website, roster_contacts.website),
            sourceUrl = COALESCE(excluded.sourceUrl, roster_contacts.sourceUrl),
            socialsJson = CASE WHEN excluded.socialsJson <> '{}' THEN excluded.socialsJson ELSE roster_contacts.socialsJson END,
            updatedAt = CURRENT_TIMESTAMP
    `);

    stmt.run(
        contact.brokerageOfficeId || null,
        brokerageName,
        normalizeText(contact.city),
        normalizeText(contact.state),
        name,
        email,
        normalizeText(contact.phone),
        normalizeText(contact.website),
        normalizeText(contact.sourceUrl),
        JSON.stringify(contact.socials || {}),
        normalizeText(contact.productionBand),
        normalizeText(contact.teamSizeHint),
        normalizeText(contact.status || 'Raw')
    );

    const row = db.prepare('SELECT * FROM roster_contacts WHERE LOWER(email) = ?').get(email);
    return prepareRosterContact(row);
}

function getRosterContacts({ search = '', brokerage = '', limit = 50, offset = 0 } = {}) {
    const params = [];
    let sql = `
        SELECT *
        FROM roster_contacts
        WHERE 1=1
    `;

    if (brokerage) {
        sql += ' AND LOWER(brokerageName) = LOWER(?)';
        params.push(normalizeText(brokerage));
    }

    if (search) {
        sql += `
            AND (
                name LIKE ?
                OR email LIKE ?
                OR phone LIKE ?
                OR brokerageName LIKE ?
                OR city LIKE ?
                OR state LIKE ?
            )
        `;
        const wild = `%${search}%`;
        params.push(wild, wild, wild, wild, wild, wild);
    }

    sql += ' ORDER BY updatedAt DESC, id DESC LIMIT ? OFFSET ?';
    params.push(Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200), Math.max(parseInt(offset, 10) || 0, 0));

    return db.prepare(sql).all(...params).map(prepareRosterContact);
}

function getRosterContactsCount({ search = '', brokerage = '' } = {}) {
    const params = [];
    let sql = 'SELECT COUNT(*) AS count FROM roster_contacts WHERE 1=1';

    if (brokerage) {
        sql += ' AND LOWER(brokerageName) = LOWER(?)';
        params.push(normalizeText(brokerage));
    }

    if (search) {
        sql += `
            AND (
                name LIKE ?
                OR email LIKE ?
                OR phone LIKE ?
                OR brokerageName LIKE ?
                OR city LIKE ?
                OR state LIKE ?
            )
        `;
        const wild = `%${search}%`;
        params.push(wild, wild, wild, wild, wild, wild);
    }

    const result = db.prepare(sql).get(...params);
    return result ? result.count : 0;
}

function insertIntelligenceRun(run = {}) {
    const stmt = db.prepare(`
        INSERT INTO intelligence_runs (type, status, brokerageOfficeId, cityId, message, statsJson, error)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
        normalizeText(run.type || 'harvest'),
        normalizeText(run.status || 'Running'),
        run.brokerageOfficeId || null,
        run.cityId || null,
        normalizeText(run.message),
        JSON.stringify(run.stats || {}),
        normalizeText(run.error)
    );
    return result.lastInsertRowid;
}

function updateIntelligenceRun(id, changes = {}) {
    const allowed = ['status', 'brokerageOfficeId', 'cityId', 'finishedAt', 'message', 'statsJson', 'error'];
    const normalized = { ...changes };
    if (Object.prototype.hasOwnProperty.call(normalized, 'stats')) {
        normalized.statsJson = JSON.stringify(normalized.stats || {});
        delete normalized.stats;
    }
    const keys = allowed.filter(key => Object.prototype.hasOwnProperty.call(normalized, key));
    if (!id || keys.length === 0) return 0;

    const assignments = keys.map(key => `${key} = ?`).join(', ');
    const values = keys.map(key => normalized[key]);
    values.push(id);
    return db.prepare(`UPDATE intelligence_runs SET ${assignments} WHERE id = ?`).run(...values).changes;
}

function getLeadIntelligenceStatus() {
    const cityCounts = db.prepare('SELECT status, COUNT(*) AS count FROM market_cities GROUP BY status').all();
    const officeCounts = db.prepare('SELECT status, COUNT(*) AS count FROM brokerage_offices GROUP BY status').all();
    const profileCounts = db.prepare('SELECT researchStatus AS status, COUNT(*) AS count FROM brokerage_profiles GROUP BY researchStatus').all();
    const contactCount = db.prepare('SELECT COUNT(*) AS count FROM roster_contacts').get().count;
    const recentRuns = db.prepare('SELECT * FROM intelligence_runs ORDER BY id DESC LIMIT 10').all()
        .map(row => ({ ...row, stats: safeJsonParse(row.statsJson, {}) }));

    return {
        cities: cityCounts,
        offices: officeCounts,
        profiles: profileCounts,
        contacts: contactCount,
        recentRuns
    };
}

function markInterruptedIntelligenceRuns(reason = 'Server restarted before the run completed.') {
    const stmt = db.prepare(`
        UPDATE intelligence_runs
        SET status = 'Interrupted',
            finishedAt = CURRENT_TIMESTAMP,
            error = ?,
            message = COALESCE(NULLIF(message, ''), ?)
        WHERE status = 'Running'
    `);
    return stmt.run(normalizeText(reason), normalizeText(reason)).changes;
}

module.exports = {
    initDb,
    getLeads,
    getLeadsCount,
    getLeadStageCounts,
    getLeadById,
    getLeadByEmail,
    insertLead,
    updateLead,
    deleteLead,
    isEmailDnc,
    addEmailToDnc,
    getDncList,
    removeEmailFromDnc,
    getCampaigns,
    getCampaignById,
    insertCampaign,
    updateCampaign,
    updateCampaignStatus,
    deleteCampaign,
    getActiveEnrollmentForLead,
    getEnrollmentsForLead,
    getDueEnrollments,
    insertEnrollment,
    updateEnrollment,
    pauseLeadEnrollments,
    seedMarketCities,
    getNextMarketCityForDiscovery,
    updateMarketCity,
    upsertBrokerageProfile,
    getBrokerageProfileByName,
    getBrokerageResearch,
    getNextBrokerageProfileForResearch,
    upsertBrokerageOffice,
    getNextBrokerageOfficeForHarvest,
    updateBrokerageOffice,
    suppressQueuedBrokerageBrand,
    upsertRosterContact,
    getRosterContacts,
    getRosterContactsCount,
    insertIntelligenceRun,
    updateIntelligenceRun,
    getLeadIntelligenceStatus,
    markInterruptedIntelligenceRuns
};
