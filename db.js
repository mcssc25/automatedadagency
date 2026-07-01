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
            stage TEXT NOT NULL DEFAULT 'Scraped',
            history TEXT NOT NULL DEFAULT '[]',
            currentCampaignId INTEGER,
            currentCampaignStep INTEGER,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

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

    migrateExistingData();

    db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email_nocase
        ON leads(LOWER(email));

        CREATE INDEX IF NOT EXISTS idx_leads_name_nocase
        ON leads(LOWER(name));

        CREATE UNIQUE INDEX IF NOT EXISTS idx_dnc_email_nocase
        ON dnc_list(LOWER(email));
    `);
    
    console.log('[Database] SQLite (node:sqlite) initialized successfully.');
}

// Leads DAO
function getLeads({ stage, search, limit = 50, offset = 0 } = {}) {
    let sql = 'SELECT * FROM leads WHERE 1=1';
    const params = [];
    
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

function getLeadsCount({ stage, search } = {}) {
    let sql = 'SELECT COUNT(*) as count FROM leads WHERE 1=1';
    const params = [];
    
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

function insertLead({ name, company, email, phone, website, stage = 'Scraped', history = [] }) {
    const emailClean = normalizeEmail(email);
    if (!emailClean) return null;

    const historyStr = JSON.stringify(history);
    
    // Check if already DNC
    const dncStmt = db.prepare('SELECT 1 FROM dnc_list WHERE LOWER(email) = ?');
    const isDnc = dncStmt.get(emailClean);
    const finalStage = isDnc ? 'DNC' : stage;
    
    try {
        const stmt = db.prepare(
            `INSERT OR IGNORE INTO leads (name, company, email, phone, website, stage, history) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        );
        const result = stmt.run(
            normalizeText(name),
            normalizeText(company),
            emailClean,
            normalizeText(phone),
            normalizeText(website),
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

    const isDnc = isEmailDnc(emailClean) || lead.stage === 'DNC' || lead.stage === 'Opted Out';
    const finalStage = isDnc ? (lead.stage === 'Opted Out' ? 'Opted Out' : 'DNC') : lead.stage;
    const historyStr = JSON.stringify(lead.history || []);
    const stmt = db.prepare(
        `UPDATE leads SET name = ?, company = ?, email = ?, phone = ?, website = ?, stage = ?, 
         history = ?, currentCampaignId = ?, currentCampaignStep = ? WHERE id = ?`
    );
    const result = stmt.run(
        normalizeText(lead.name), 
        normalizeText(lead.company), 
        emailClean, 
        normalizeText(lead.phone), 
        normalizeText(lead.website), 
        finalStage, 
        historyStr,
        isDnc ? null : (lead.currentCampaignId || null),
        isDnc ? null : (lead.currentCampaignStep || null),
        lead.id
    );
    return result.changes;
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
    const updateStmt = db.prepare("UPDATE leads SET stage = 'DNC', currentCampaignId = NULL, currentCampaignStep = NULL WHERE LOWER(email) = ?");
    updateStmt.run(emailClean);
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

function deleteCampaign(id) {
    const stmt = db.prepare('DELETE FROM campaigns WHERE id = ?');
    const result = stmt.run(id);
    return result.changes;
}

module.exports = {
    initDb,
    getLeads,
    getLeadsCount,
    getLeadById,
    getLeadByEmail,
    insertLead,
    updateLead,
    isEmailDnc,
    addEmailToDnc,
    getDncList,
    removeEmailFromDnc,
    getCampaigns,
    getCampaignById,
    insertCampaign,
    updateCampaignStatus,
    deleteCampaign
};
