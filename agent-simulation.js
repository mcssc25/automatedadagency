/**
 * AI Agent Simulation Engine
 * Simulates real-time activities of marketing, sales, content, and support agents.
 * Connects with the UI app state and pushes mock logs, leads, and chats.
 */

class AgentSimulationEngine {
    constructor() {
        this.active = false;
        this.logs = [];
        this.logCallbacks = [];
        this.eventCallbacks = {};
        this.demoMode = false;
        
        // Configuration for the simulation pacing
        this.intervals = {
            console: 3000,       // Append new log line
            kpi: 8000,           // Slightly adjust stats (impressions, clicks)
            newLead: 45000,      // Generate new lead in CRM
            newSupport: 60000    // Generate new visitor live chat
        };
        
        this.timerIds = [];

        // Prebaked templates in case Gemini API is offline/not set
        this.prebakedLogs = [
            { type: 'agent-ad', msg: 'Analyzing Keyword Auction for "real estate transaction software". Bids remain stable.' },
            { type: 'agent-ad', msg: 'Meta Ads Retargeting list synced. Custom Audience size: 1,420 brokers.' },
            { type: 'agent-ad', msg: 'Performance audit: Campaign "Paperwork Automation v1" CTR increased to 5.2% after copywriting adjustment.' },
            { type: 'agent-ad', msg: 'Adjusting daily budget allocation: Pushing $15.00 from low-performing ad sets to Google Search.' },
            { type: 'agent-content', msg: 'Social Trends Monitor: Keywords "real estate burnout" and "admin overhead" are trending.' },
            { type: 'agent-content', msg: 'Content draft created: "5 Ways Automation Can Save Your Weekend (For Realtors)". Queued for approval.' },
            { type: 'agent-content', msg: 'Publishing Twitter thread on the cost of manual compliance tracking. Estimated reach: 850.' },
            { type: 'agent-content', msg: 'Scheduled post uploaded to LinkedIn queue: "Why residential brokerages lose 15% of agents to admin stress".' },
            { type: 'agent-support', msg: 'Visitor #9021 completed Onboarding Quiz. Sentiment: Interested. Flagged as warm lead.' },
            { type: 'agent-support', msg: 'Live Chat initialized by IP 184.22.91.5 (Chicago). Assigned to Support Agent.' },
            { type: 'agent-support', msg: 'Support Query Resolved: Explained DocuSign integration capabilities to visitor.' },
            { type: 'agent-sales', msg: 'Outbound sequence triggered: Drip Email #2 sent to Lead: Sarah Jenkins (Keller Williams).' },
            { type: 'agent-sales', msg: 'Analyzing email response from Lead: Marcus Vance. Intent detected: High (Requested pricing).' },
            { type: 'agent-sales', msg: 'CRM Action: Lead "David Kim" moved from Contacted to Engaged.' }
        ];

        // Seed templates for leads
        this.leadSeedData = [
            { name: "Sarah Jenkins", company: "Keller Williams", email: "sarah.j@kwseattle.com", phone: "206-555-0192", stage: "Contacted" },
            { name: "Marcus Vance", company: "Vance Realty Group", email: "marcus@vancerealty.com", phone: "312-555-0144", stage: "Engaged" },
            { name: "David Kim", company: "Kim & Associates LLC", email: "david@kimresidential.com", phone: "213-555-0185", stage: "Hot Lead" },
            { name: "Elena Rostova", company: "Compass Real Estate", email: "elena.r@compass.com", phone: "415-555-0211", stage: "Demo Scheduled" },
            { name: "Thomas Miller", company: "RE/MAX Hallmark", email: "t.miller@remax-hallmark.com", phone: "702-555-0139", stage: "Contacted" }
        ];

        // Seed templates for visitor support chats
        this.supportSeedData = [
            {
                user: "Visitor (Dallas, TX)",
                lastMsg: "Do you integrate with zipForm?",
                history: [
                    { sender: "user", text: "Hello, I am a residential broker. Does your platform integrate with zipForm?", time: "11:02 AM" },
                    { sender: "agent", text: "Hi there! Yes, Autopilot integrates seamlessly with zipForm, DocuSign, and dotloop. Any compliance documents uploaded there can be fetched automatically by our transaction agent.", time: "11:03 AM" },
                    { sender: "user", text: "That is great. What about compliance checking? Do you use AI to read the contracts?", time: "11:04 AM" },
                    { sender: "agent", text: "Exactly! Our AI scans the agreements to ensure all required fields, signatures, and dates are filled in, flagging omissions in real-time so your transaction coordinator doesn't have to manually check every page.", time: "11:05 AM" },
                    { sender: "user", text: "Do you integrate with zipForm?", time: "11:06 AM" }
                ],
                currentQuestion: "Do you integrate with zipForm?"
            },
            {
                user: "Visitor (Miami, FL)",
                lastMsg: "What is the monthly pricing?",
                history: [
                    { sender: "user", text: "Hey! I am checking out your website. What is the monthly pricing?", time: "11:15 AM" },
                    { sender: "agent", text: "Hello! Our base subscription starts at $149/month which includes 10 active transaction streams and 1 AI Assistant Agent. For brokerages, we offer customized scaling packages.", time: "11:16 AM" }
                ],
                currentQuestion: "Do you have a free trial option?"
            }
        ];
    }

    start(bizName, bizDesc, bizAudience, enabledAgents, dailyLeadTarget) {
        if (this.active) return;
        this.active = true;
        this.bizName = bizName || "Client Business";
        this.bizDesc = bizDesc || "Client business description not provided";
        this.bizAudience = bizAudience || "Target audience not provided";
        this.enabledAgents = enabledAgents || { ad: true, content: true, support: true, sales: true };
        this.dailyLeadTarget = dailyLeadTarget || 100;
        
        // Map agent types to their enabled keys
        this.agentTypeMap = {
            'agent-ad': 'ad',
            'agent-content': 'content', 
            'agent-support': 'support',
            'agent-sales': 'sales'
        };
        
        this.log('system', `Initializing AI Agents for '${this.bizName}'...`);
        this.log('system', `Target Audience profile parsed: ${this.bizAudience}`);
        
        // Report which agents are active
        const activeAgents = Object.entries(this.enabledAgents).filter(([k, v]) => v).map(([k]) => k);
        const inactiveAgents = Object.entries(this.enabledAgents).filter(([k, v]) => !v).map(([k]) => k);
        this.log('system', `Active agents: ${activeAgents.join(', ') || 'none'}.${inactiveAgents.length > 0 ? ' Paused: ' + inactiveAgents.join(', ') + '.' : ''}`);

        // 1. Core Console Stream — only logs for enabled agents
        if (!this.demoMode) {
            this.log('system', 'Demo simulation disabled. Real contacts and activity will appear after research, import, publishing, or integration events.');
            return;
        }

        const consoleInterval = setInterval(() => {
            // Filter logs to only enabled agents
            const enabledLogs = this.prebakedLogs.filter(l => {
                const key = this.agentTypeMap[l.type];
                return key && this.enabledAgents[key];
            });
            if (enabledLogs.length === 0) return;
            
            const index = Math.floor(Math.random() * enabledLogs.length);
            const rawLog = enabledLogs[index];
            this.log(rawLog.type, `[${this.getAgentPrefix(rawLog.type)}] ${rawLog.msg}`);
            this.triggerEvent('agentTaskUpdate', { type: rawLog.type });
        }, this.intervals.console);
        this.timerIds.push(consoleInterval);

        // 2. Statistics Updates (runs regardless — these are platform KPIs)
        const kpiInterval = setInterval(() => {
            this.triggerEvent('kpiTick', {
                impressions: Math.floor(Math.random() * 15) + 3,
                clicks: Math.random() > 0.4 ? 1 : 0,
                spend: (Math.random() * 0.85 + 0.15).toFixed(2)
            });
        }, this.intervals.kpi);
        this.timerIds.push(kpiInterval);

        // 3. New CRM Lead Generator — only if Sales agent is enabled
        if (this.enabledAgents.sales) {
            // Scale lead generation frequency based on daily target setting
            // e.g. 100 leads/day = 1 lead every 6s in simulator
            const leadIntervalTime = Math.max(3000, Math.min(45000, 60000 / (this.dailyLeadTarget / 10)));
            const leadInterval = setInterval(() => {
                this.generateMockLead();
            }, leadIntervalTime);
            this.timerIds.push(leadInterval);
        }

        // 4. Live Support Ticket Generator — only if Support agent is enabled
        if (this.enabledAgents.support) {
            const supportInterval = setInterval(() => {
                this.generateMockSupport();
            }, this.intervals.newSupport);
            this.timerIds.push(supportInterval);
        }

        // Seed some initial data immediately (only for enabled agents)
        if (this.enabledAgents.sales) {
            setTimeout(() => this.seedInitialLeads(), 1000);
        }
        if (this.enabledAgents.support) {
            setTimeout(() => this.seedInitialSupport(), 2000);
        }
    }

    stop() {
        this.active = false;
        this.timerIds.forEach(id => clearInterval(id));
        this.timerIds = [];
        this.log('system', 'Autopilot offline. AI Agents stopped.');
    }

    log(type, msg) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = { type, msg: `[${timestamp}] ${msg}` };
        this.logs.push(logEntry);
        this.logCallbacks.forEach(cb => cb(logEntry));
    }

    onLog(callback) {
        this.logCallbacks.push(callback);
    }

    onEvent(event, callback) {
        if (!this.eventCallbacks[event]) {
            this.eventCallbacks[event] = [];
        }
        this.eventCallbacks[event].push(callback);
    }

    triggerEvent(event, data) {
        if (this.eventCallbacks[event]) {
            this.eventCallbacks[event].forEach(cb => cb(data));
        }
    }

    getAgentPrefix(type) {
        switch(type) {
            case 'agent-ad': return 'Ad Strategy Agent';
            case 'agent-content': return 'Content Agent';
            case 'agent-support': return 'Support Agent';
            case 'agent-sales': return 'Sales Agent';
            default: return 'SYSTEM';
        }
    }

    seedInitialLeads() {
        this.leadSeedData.forEach(lead => {
            this.triggerEvent('newLead', lead);
            // Simulate chat history for some leads
            this.generateLeadChatHistory(lead);
        });
    }

    seedInitialSupport() {
        this.supportSeedData.forEach(session => {
            this.triggerEvent('newSupportSession', session);
        });
    }

    generateMockLead() {
        const names = ["Robert Chen", "Sophia Martinez", "William Fitzpatrick", "Jessica Taylor", "Emily Rodriguez"];
        const companies = ["Redfin", "Coldwell Banker", "ERA Real Estate", "Sotheby's Realty", "Century 21"];
        const name = names[Math.floor(Math.random() * names.length)];
        const company = companies[Math.floor(Math.random() * companies.length)];
        const email = `${name.toLowerCase().replace(" ", ".")}@${company.toLowerCase().replace(" ", "").replace("'", "")}.com`;
        
        const lead = {
            name,
            company,
            email,
            phone: `555-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,
            stage: "Contacted"
        };
        
        this.log('agent-sales', `New Lead Acquired from campaign landing page: ${lead.name} (${lead.company})`);
        this.triggerEvent('newLead', lead);
        this.generateLeadChatHistory(lead);
    }

    generateLeadChatHistory(lead) {
        // Build mock drip campaign conversations
        const history = [
            { sender: 'agent', text: `Hi ${lead.name},\n\nI saw you registered for Cleared2Close. As a realtor at ${lead.company}, how many hours a week do you currently spend dealing with transaction paperwork and compliance files?\n\nBest,\nSales Agent`, time: '1 Day Ago' }
        ];

        if (lead.stage !== 'Contacted') {
            history.push({ sender: 'user', text: `Honestly, too much. Probably 8-10 hours a week on dotloop and zipForm chasing down signatures. It is a pain.`, time: '1 Day Ago' });
            history.push({ sender: 'agent', text: `I completely understand, ${lead.name}. That is exactly what Cleared2Close solves. We automate signature chasing and verify file checklists. Would you be open to a quick 10-minute demo this week?`, time: '18 Hours Ago' });
        }
        
        if (lead.stage === 'Hot Lead' || lead.stage === 'Demo Scheduled') {
            history.push({ sender: 'user', text: `Yeah, I could do Thursday afternoon. Do you have a calendar link?`, time: '12 Hours Ago' });
            history.push({ sender: 'agent-action', text: `AI Sales Agent sent calendar invite for Thursday at 2:00 PM. Lead status updated to Demo Scheduled.`, time: '12 Hours Ago' });
            history.push({ sender: 'agent', text: `Perfect! Calendar invite sent. I will show you how our transaction agent flags missing disclosures automatically. See you then!`, time: '11 Hours Ago' });
        }

        lead.history = history;
    }

    generateMockSupport() {
        const locations = ["Houston, TX", "Denver, CO", "Phoenix, AZ", "Atlanta, GA", "Boston, MA"];
        const location = locations[Math.floor(Math.random() * locations.length)];
        const questions = [
            "Does this work on mobile devices? I am always on the go.",
            "Can I add my brokerage branding to the dashboard?",
            "What happens if a document compliance check fails? Do I get notified?",
            "Is there a limit on how many contracts I can upload per month?"
        ];
        const question = questions[Math.floor(Math.random() * questions.length)];
        
        const session = {
            user: `Visitor (${location})`,
            lastMsg: question,
            history: [
                { sender: 'user', text: "Hello, looking at the features list. " + question, time: 'Just Now' }
            ],
            currentQuestion: question
        };
        
        this.log('agent-support', `New Web Chat Session started by visitor from ${location}.`);
        this.triggerEvent('newSupportSession', session);
    }
}

// Global instance
const Simulation = new AgentSimulationEngine();
