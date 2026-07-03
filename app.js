/**
 * Ad Agency Autopilot Core Application
 * Manages UI routing, local state, integrations, SVG chart plotting,
 * and handles real-time Gemini API queries for ad and social copy.
 */

class AutopilotApp {
    constructor() {
        // App State
        this.state = {
            bizName: "",
            bizWebsite: "",
            bizDesc: "",
            bizAudience: "",
            bizSwot: "",
            businessReport: "",
            companySocialLinks: {},
            agencyGoal: "",
            coreMessage: "",
            extraDetails: "",
            adBudget: 0,
            dealValue: 1000,
            conversionRate: 10,
            competitorUrls: [],
            competitorProfiles: {},
            enabledAgents: { ad: false, content: false, support: false, sales: false, leadIntelligence: false },
            leadIntelligence: {
                enabled: false,
                running: false,
                intervalMs: 3600000,
                status: null
            },
            contentAutopilot: {
                enabled: false,
                publishMode: 'draft', // 'draft' or 'publish'
                autoAttachMedia: true,
                frequencies: {
                    facebook: { enabled: false, value: 1, interval: 'day' },
                    instagram: { enabled: false, value: 2, interval: 'day' },
                    linkedin: { enabled: false, value: 1, interval: 'week' },
                    twitter: { enabled: false, value: 1, interval: 'day' },
                    reddit: { enabled: false, value: 1, interval: 'week' },
                    youtube: { enabled: false, value: 1, interval: 'week' }
                }
            },
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
            marketingGoal: "lead-gen",
            
            // Statistics
            stats: {
                impressions: 0,
                clicks: 0,
                leads: 0,
                spend: 0,
                revenue: 0
            },
            
            // Active Lists
            campaigns: [],
            socialPosts: [],
            competitorTrends: [],
            competitorTrendKeywords: [],
            trendSearchQueries: [],
            trendRefreshWarning: "",
            leads: [],
            leadsPage: 1,
            leadsPagesCount: 1,
            leadStageCounts: {},
            leadsStageFilter: 'All',
            leadsSearchQuery: '',
            supportSessions: [],
            
            // Current open views
            selectedLeadIndex: null,
            selectedLeadId: null,
            selectedSupportIndex: null,
            
            // API setup
            useFallback: CONFIG.USE_FALLBACK_SIMULATION,
            serverConfig: {
                geminiConfigured: false,
                openRouterConfigured: false,
                openRouterModels: {
                    order: []
                }
            },
            openRouterSettings: {
                configured: false,
                enabled: false,
                webSearchEnabled: false,
                dailyRequestLimit: 200,
                modelOrder: []
            }
        };

        this.editingPostId = null;
        this.scanProgressTimer = null;
        this.longTextModalSourceId = null;

        // DOM elements
        this.dom = {};
        this.crmPersistTimer = null;
        this.crmRefreshTimer = null;
        this.crmRefreshInFlight = false;
        
        // Bootstrapping the app
        window.addEventListener("DOMContentLoaded", () => this.init());
    }

    async init() {
        this.cacheDOM();
        this.setupRoutes();
        this.bindEvents();
        await this.loadState();
        
        // Initialize state lists without demo seed data.
        this.initDefaultCampaigns();
        this.initDefaultSocialPosts();
        
        // Setup initial UI states
        this.renderStats();
        this.renderCampaignsTable();
        this.renderSocialPostsGrid();
        this.renderScheduledQueue();
        this.renderPublishedAnalytics();
        this.renderLeadsList();
        this.updateVerificationBadge();
        this.drawPerformanceChart();
        this.renderLeadIntelligenceStatus();
        
        // Load integrations credentials and statuses
        this.loadWebhookSettings();
        this.checkIntegrationStatuses();
        this.startCrmRefreshPolling();
        
        this.appendStartupStatusLine();
    }

    cacheDOM() {
        // Navigation
        this.dom.navItems = document.querySelectorAll(".nav-item");
        this.dom.views = document.querySelectorAll(".view-section");
        this.dom.viewTitle = document.getElementById("view-title");
        this.dom.viewSubtitle = document.getElementById("view-subtitle");
        
        // Global Stats elements
        this.dom.headerLeads = document.getElementById("header-leads");
        this.dom.headerSpend = document.getElementById("header-spend");
        this.dom.headerApiStatus = document.getElementById("header-api-status");
        this.dom.kpiImpressions = document.getElementById("kpi-impressions");
        this.dom.kpiClicks = document.getElementById("kpi-clicks");
        this.dom.kpiLeads = document.getElementById("kpi-leads");
        this.dom.kpiRevenue = document.getElementById("kpi-revenue");
        
        // Console Log
        this.dom.consoleLog = document.getElementById("console-log-stream");
        this.dom.clearConsoleBtn = document.getElementById("clear-console-btn");
        
        // Forms & Settings
        this.dom.devCredentialsForm = document.getElementById("developer-credentials-form");
        this.dom.onboardingForm = document.getElementById("onboarding-form");
        this.dom.btnScanWebsite = document.getElementById("btn-scan-website");
        this.dom.btnFindAudience = document.getElementById("btn-find-audience");
        this.dom.btnFindCompetitors = document.getElementById("btn-find-competitors");
        this.dom.btnAddCompetitor = document.getElementById("btn-add-competitor");
        this.dom.competitorAddInput = document.getElementById("competitor-add-input");
        this.dom.competitorList = document.getElementById("competitor-list");
        this.dom.scanStatus = document.getElementById("scan-status");
        this.dom.scanProgressPanel = document.getElementById("scan-progress-panel");
        this.dom.scanProgressTitle = document.getElementById("scan-progress-title");
        this.dom.scanProgressPercent = document.getElementById("scan-progress-percent");
        this.dom.scanProgressBar = document.getElementById("scan-progress-bar");
        this.dom.scanProgressSteps = document.querySelectorAll("[data-scan-step]");
        this.dom.bizSwotInput = document.getElementById("biz-swot");
        this.dom.agencyGoalInput = document.getElementById("agency-goal");
        this.dom.coreMessageInput = document.getElementById("core-message");
        this.dom.extraDetailsInput = document.getElementById("extra-details");
        this.dom.dealValueInput = document.getElementById("deal-value");
        this.dom.conversionRateInput = document.getElementById("conversion-rate");
        this.dom.competitorUrlsInput = document.getElementById("competitor-urls");
        this.dom.marketingGoalInput = document.getElementById("marketing-goal");
        
        this.dom.settingsApiKey = document.getElementById("settings-api-key");
        this.dom.settingsOpenRouterKey = document.getElementById("settings-openrouter-key");
        this.dom.settingsOpenRouterStatus = document.getElementById("settings-openrouter-status");
        this.dom.settingsOpenRouterEnabled = document.getElementById("settings-openrouter-enabled");
        this.dom.settingsOpenRouterWebSearch = document.getElementById("settings-openrouter-web-search");
        this.dom.settingsOpenRouterDailyLimit = document.getElementById("settings-openrouter-daily-limit");
        this.dom.settingsOpenRouterModels = document.getElementById("settings-openrouter-models");
        this.dom.btnClearOpenRouterKey = document.getElementById("btn-clear-openrouter-key");
        this.dom.settingsUseFallback = document.getElementById("settings-use-fallback");
        this.dom.btnSaveSettings = document.getElementById("btn-save-settings");
        this.dom.toggleKeyVisibility = document.getElementById("toggle-key-visibility");
        this.dom.previewBizName = document.getElementById("preview-biz-name");
        this.dom.previewDomain = document.getElementById("preview-domain");
        this.dom.campaignsListBody = document.getElementById("campaigns-list-body");
        
        // Ad Campaign Variant Generator
        this.dom.generateAdBtn = document.getElementById("generate-ad-btn");
        this.dom.adGenTopic = document.getElementById("ad-gen-topic");
        this.dom.adGeneratorResults = document.getElementById("ad-generator-results");
        
        // Content Studio & Tabs
        this.dom.contentTopicInput = document.getElementById("content-topic-input");
        this.dom.btnGenerateContent = document.getElementById("btn-generate-content");
        this.dom.btnRecommendContent = document.getElementById("btn-recommend-content");
        this.dom.socialPostsContainer = document.getElementById("social-posts-container");
        this.dom.studioTabs = document.querySelectorAll(".studio-tab");
        this.dom.studioViews = document.querySelectorAll(".studio-panel-view");
        this.dom.trendsContainer = document.getElementById("trends-container");
        this.dom.queueContainer = document.getElementById("queue-container");
        this.dom.analyticsContainer = document.getElementById("analytics-container");
        this.dom.btnRefreshTrends = document.getElementById("btn-refresh-trends");
        
        // Modal for Scheduling
        this.dom.scheduleModal = document.getElementById("schedule-modal");
        this.dom.btnConfirmSchedule = document.getElementById("btn-confirm-schedule");
        this.dom.btnCancelSchedule = document.getElementById("btn-cancel-schedule");
        this.dom.btnCloseModal = document.getElementById("btn-close-modal");
        this.dom.scheduleDatetimeInput = document.getElementById("schedule-datetime");
        this.dom.longTextModal = document.getElementById("long-text-modal");
        this.dom.longTextModalTitle = document.getElementById("long-text-modal-title");
        this.dom.longTextModalInput = document.getElementById("long-text-modal-input");
        this.dom.btnCloseLongTextModal = document.getElementById("btn-close-long-text-modal");
        this.dom.btnCancelLongTextModal = document.getElementById("btn-cancel-long-text-modal");
        this.dom.btnSaveLongTextModal = document.getElementById("btn-save-long-text-modal");
        
        // CRM Sub-navigation & Panels
        this.dom.crmTabs = document.querySelectorAll(".crm-tab");
        this.dom.crmViews = document.querySelectorAll(".crm-panel-view");
        
        // CRM Lead Scraper
        this.dom.crmScrapeNiche = document.getElementById("crm-scrape-niche");
        this.dom.crmScrapeCount = document.getElementById("crm-scrape-count");
        this.dom.btnCrmScrape = document.getElementById("btn-crm-scrape");
        
        // CRM Verification Queue
        this.dom.crmVerificationContainer = document.getElementById("crm-verification-container");
        this.dom.crmVerificationBadge = document.getElementById("crm-verification-badge");
        
        // CRM Campaigns Creator
        this.dom.crmCampaignForm = document.getElementById("crm-campaign-form");
        this.dom.campaignName = document.getElementById("campaign-name");
        this.dom.campaignType = document.getElementById("campaign-type");
        this.dom.videoAssetGroup = document.getElementById("video-asset-group");
        this.dom.campaignVideoAsset = document.getElementById("campaign-video-asset");
        this.dom.campaignInstructions = document.getElementById("campaign-instructions");
        this.dom.btnCreateCampaign = document.getElementById("btn-create-campaign");
        this.dom.crmCampaignsContainer = document.getElementById("crm-campaigns-container");
        this.dom.crmCampaignWorkflowSummary = document.getElementById("crm-campaign-workflow-summary");

        // Outbound Settings
        this.dom.settingsDailyLimit = document.getElementById("settings-daily-limit");
        this.dom.settingsBypassVerification = document.getElementById("settings-bypass-verification");
        this.dom.settingsBookingLink = document.getElementById("settings-booking-link");
        this.dom.settingsSalesPageUrl = document.getElementById("settings-sales-page-url");
        this.dom.settingsDemoVideoUrl = document.getElementById("settings-demo-video-url");
        this.dom.settingsYoutubePageUrl = document.getElementById("settings-youtube-page-url");

        // Autopilot Settings & DNC
        this.dom.contentAutopilotMasterEnabled = document.getElementById("content-autopilot-master-enabled");
        this.dom.contentPublishMode = document.getElementById("content-autopilot-publish-mode");
        this.dom.contentAutopilotMedia = document.getElementById("content-autopilot-media");
        this.dom.crmLeadLimit = document.getElementById("crm-lead-limit");
        this.dom.crmDailyScrapeQuery = document.getElementById("crm-daily-scrape-query");
        this.dom.crmDailyScrapeEnabled = document.getElementById("crm-daily-scrape-enabled");
        this.dom.crmAutoEnrollScraped = document.getElementById("crm-auto-enroll-scraped");
        this.dom.crmAutoApproveCampaigns = document.getElementById("crm-auto-approve-campaigns");
        this.dom.crmAutoAdvanceCampaigns = document.getElementById("crm-auto-advance-campaigns");
        this.dom.btnRunCrmPipeline = document.getElementById("btn-run-crm-pipeline");
        this.dom.crmFirstCampaign = document.getElementById("crm-first-campaign");
        this.dom.crmSecondCampaign = document.getElementById("crm-second-campaign");
        this.dom.crmThirdCampaign = document.getElementById("crm-third-campaign");
        this.dom.crmAutoPause = document.getElementById("crm-auto-pause");
        this.dom.crmSimulateUnsubs = document.getElementById("crm-simulate-unsubs");
        this.dom.crmDncAddInput = document.getElementById("crm-dnc-add-input");
        this.dom.btnCrmDncAdd = document.getElementById("btn-add-dnc");
        this.dom.crmDncListBody = document.getElementById("crm-dnc-list-body");
        this.dom.crmDncCount = document.getElementById("crm-dnc-count");
        this.dom.btnRunLeadIntelligence = document.getElementById("btn-run-lead-intelligence");
        this.dom.leadIntelligenceMeta = document.getElementById("lead-intelligence-meta");

        // Asset Downloader DOM
        this.dom.downloaderUrlInput = document.getElementById("downloader-url-input");
        this.dom.btnInspectVideo = document.getElementById("btn-inspect-video");
        this.dom.downloaderMetadataCard = document.getElementById("downloader-metadata-card");
        this.dom.downloaderThumb = document.getElementById("downloader-thumb");
        this.dom.downloaderTitle = document.getElementById("downloader-title");
        this.dom.downloaderAuthor = document.getElementById("downloader-author");
        this.dom.downloaderDuration = document.getElementById("downloader-duration");
        this.dom.btnDownloadVideo = document.getElementById("btn-download-video");
        this.dom.btnExtractAudio = document.getElementById("btn-extract-audio");
        this.dom.btnExtractTranscript = document.getElementById("btn-extract-transcript");
        this.dom.downloaderProcessing = document.getElementById("downloader-processing");
        this.dom.downloaderProcessingText = document.getElementById("downloader-processing-text");
        this.dom.downloaderPlayerBox = document.getElementById("downloader-player-box");
        this.dom.downloaderPlayerContainer = document.getElementById("downloader-player-container");
        this.dom.downloaderTranscriptBox = document.getElementById("downloader-transcript-box");
        this.dom.downloaderTranscriptText = document.getElementById("downloader-transcript-text");
        this.dom.btnAdaptTranscript = document.getElementById("btn-adapt-transcript");

        // CRM & Support Panels
        this.dom.leadsListContainer = document.getElementById("leads-list-container");
        this.dom.crmChatMessages = document.getElementById("crm-chat-messages");
        this.dom.crmLeadCount = document.getElementById("crm-lead-count");
        this.dom.selectedLeadHeader = document.getElementById("selected-lead-header");
        
        this.dom.supportSessionsContainer = document.getElementById("support-sessions-container");
        this.dom.supportChatMessages = document.getElementById("support-chat-messages");
        this.dom.supportChatCount = document.getElementById("support-chat-count");
        this.dom.selectedSupportHeader = document.getElementById("selected-support-header");
        
        // Agent UI status indicators
        this.dom.agentTasks = {
            'agent-ad': document.getElementById("agent-ad-task"),
            'agent-content': document.getElementById("agent-content-task"),
            'agent-support': document.getElementById("agent-support-task"),
            'agent-sales': document.getElementById("agent-sales-task"),
            'agent-intelligence': document.getElementById("agent-intelligence-task")
        };
        this.dom.agentStatusDots = {
            'agent-ad': document.getElementById("status-ad-agent"),
            'agent-content': document.getElementById("status-content-agent"),
            'agent-support': document.getElementById("status-support-agent"),
            'agent-sales': document.getElementById("status-sales-agent"),
            'agent-intelligence': document.getElementById("status-intelligence-agent")
        };
    }

    setupRoutes() {
        const handleRoute = () => {
            const hash = window.location.hash || "#dashboard";
            const viewName = hash.replace("#", "");
            
            // Toggle active class on sidebar navigation
            this.dom.navItems.forEach(item => {
                if (item.getAttribute("data-view") === viewName) {
                    item.classList.add("active");
                } else {
                    item.classList.remove("active");
                }
            });
            
            // Toggle active class on views
            this.dom.views.forEach(view => {
                if (view.id === `${viewName}-view`) {
                    view.classList.add("active");
                } else {
                    view.classList.remove("active");
                }
            });
            
            this.updateHeaderTitles(viewName);
            
            // Force redraw performance chart if resizing or navigating to dashboard
            if (viewName === "dashboard") {
                this.drawPerformanceChart();
            }
        };

        window.addEventListener("hashchange", handleRoute);
        // Run once at boot
        if (!window.location.hash) {
            window.location.hash = "#dashboard";
        } else {
            handleRoute();
        }
    }

    updateHeaderTitles(view) {
        let title = "Dashboard Overview";
        let subtitle = "Real-time status of your autonomous marketing operations.";
        
        switch(view) {
            case "setup":
                title = "Autopilot Setup Wizard";
                subtitle = "Configure target parameters for your AI marketing workforce.";
                break;
            case "ads":
                title = "Ad Campaigns Manager";
                subtitle = "AI-generated ads, budget optimizations, and live performance metrics.";
                break;
            case "content":
                title = "AI Content Studio";
                subtitle = "Social media posts drafted, scheduled, and published by the Content Agent.";
                break;
            case "crm":
                title = "Autonomous Sales CRM";
                subtitle = "Track conversions, leads acquired, and outbound negotiation logs.";
                break;
            case "support":
                title = "24/7 Support Hub";
                subtitle = "Observe customer inquiries handled autonomously by the Support Agent.";
                break;
            case "settings":
                title = "Integrations & API Settings";
                subtitle = "Manage connected accounts and configure artificial intelligence keys.";
                break;
        }
        
        this.dom.viewTitle.innerText = title;
        this.dom.viewSubtitle.innerText = subtitle;
    }

    bindEvents() {
        // Clear console
        this.dom.clearConsoleBtn.addEventListener("click", () => {
            this.dom.consoleLog.innerHTML = `<div class="console-line system-line">[SYSTEM] Console log cleared. Autopilot active.</div>`;
        });

        // Save integrations / API / Outbound config
        this.dom.btnSaveSettings.addEventListener("click", async () => {
            this.state.useFallback = this.dom.settingsUseFallback.checked;
            this.state.outboundDailyLimit = parseInt(this.dom.settingsDailyLimit.value) || 50;
            this.setAutoApproveCampaigns(this.dom.settingsBypassVerification.checked);
            this.state.crmAutopilot.bookingLink = this.dom.settingsBookingLink.value.trim();
            this.state.crmAutopilot.salesPageUrl = this.dom.settingsSalesPageUrl.value.trim();
            this.state.crmAutopilot.demoVideoUrl = this.dom.settingsDemoVideoUrl.value.trim();
            this.state.crmAutopilot.youtubePageUrl = this.dom.settingsYoutubePageUrl.value.trim();
            
            try {
                await this.saveOpenRouterSettings();
                this.saveState();
                this.updateApiStatusUI();
                this.renderCampaignWorkflowSummary();
                this.appendConsoleLine('system', `API, outbound, and sales asset settings updated. Server Gemini key live: ${this.state.serverConfig.geminiConfigured ? 'YES' : 'NO'}. OpenRouter lead research: ${this.state.openRouterSettings.enabled ? 'ON' : 'OFF'}. Daily Limit: ${this.state.outboundDailyLimit}. Auto-approve campaigns: ${this.state.crmAutopilot.autoApproveCampaigns}`);
                alert("Settings saved successfully.");
            } catch (error) {
                console.error("Failed to save settings:", error);
                alert("Failed to save settings: " + error.message);
            }
        });

        // The Gemini key is configured server-side. Keep this as a status field so
        // browser password managers do not mistake app settings for a login form.
        this.dom.toggleKeyVisibility.addEventListener("click", () => {
            this.appendConsoleLine('system', 'Gemini API key is loaded from the server .env file and is not editable in the browser.');
        });

        this.dom.btnClearOpenRouterKey.addEventListener("click", async () => {
            if (!confirm("Clear the saved OpenRouter API key?")) return;
            this.dom.settingsOpenRouterKey.value = "";
            this.dom.settingsOpenRouterEnabled.checked = false;
            try {
                await this.saveOpenRouterSettings({ clearApiKey: true });
                this.appendConsoleLine('system', 'OpenRouter API key cleared. Lead intelligence will use Gemini unless an env key is configured.');
                alert("OpenRouter key cleared.");
            } catch (error) {
                alert("Failed to clear OpenRouter key: " + error.message);
            }
        });

        // Web scraping button
        this.dom.btnScanWebsite.addEventListener("click", () => this.handleWebsiteScan());
        document.getElementById("biz-desc").addEventListener("input", (event) => this.autoGrowSetupTextarea(event.target));
        this.dom.bizSwotInput.addEventListener("input", (event) => this.autoGrowSetupTextarea(event.target));
        [this.dom.agencyGoalInput, this.dom.coreMessageInput, this.dom.extraDetailsInput].forEach(input => {
            input.addEventListener("input", () => {
                this.state.agencyGoal = this.dom.agencyGoalInput.value.trim();
                this.state.coreMessage = this.dom.coreMessageInput.value.trim();
                this.state.extraDetails = this.dom.extraDetailsInput.value.trim();
                this.saveState();
            });
        });

        // Target audience finder button
        this.dom.btnFindAudience.addEventListener("click", () => this.handleAudienceFind());

        // Competitors finder button
        this.dom.btnFindCompetitors.addEventListener("click", () => this.handleCompetitorsFind());

        // Competitor add button & enter key
        this.dom.btnAddCompetitor.addEventListener("click", () => this.addCompetitorFromInput());
        this.dom.competitorAddInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); this.addCompetitorFromInput(); }
        });

        // Agent toggle change handlers
        this.getAgentKeys().forEach(agentKey => {
            const setupCheckbox = document.getElementById(`toggle-${agentKey}-agent`);
            const dashboardCheckbox = document.getElementById(`dashboard-toggle-${agentKey}-agent`);
            if (setupCheckbox) setupCheckbox.addEventListener('change', () => this.handleAgentToggle(agentKey, setupCheckbox.checked));
            if (dashboardCheckbox) dashboardCheckbox.addEventListener('change', () => this.handleAgentToggle(agentKey, dashboardCheckbox.checked));
        });
        if (this.dom.btnRunLeadIntelligence) {
            this.dom.btnRunLeadIntelligence.addEventListener('click', () => this.runLeadIntelligenceNow());
        }

        // Onboarding Form Submit
        this.dom.onboardingForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            this.state.bizName = document.getElementById("biz-name").value;
            let websiteVal = document.getElementById("biz-website").value.trim();
            if (websiteVal && !/^https?:\/\//i.test(websiteVal)) {
                websiteVal = 'https://' + websiteVal;
                document.getElementById("biz-website").value = websiteVal;
            }
            this.state.bizWebsite = websiteVal;
            this.state.bizDesc = document.getElementById("biz-desc").value;
            this.state.bizAudience = document.getElementById("biz-audience").value;
            this.state.bizSwot = this.dom.bizSwotInput.value;
            this.state.agencyGoal = this.dom.agencyGoalInput.value.trim();
            this.state.coreMessage = this.dom.coreMessageInput.value.trim();
            this.state.extraDetails = this.dom.extraDetailsInput.value.trim();
            this.state.adBudget = parseFloat(document.getElementById("ad-budget").value);
            this.state.dealValue = parseFloat(this.dom.dealValueInput.value);
            this.state.conversionRate = parseFloat(this.dom.conversionRateInput.value);
            this.state.competitorUrls = this.getCompetitorArray();
            this.syncCompetitorHiddenInput();
            this.state.marketingGoal = this.dom.marketingGoalInput.value;

            // Read agent toggle states
            this.state.enabledAgents = {
                ad: document.getElementById('toggle-ad-agent').checked,
                content: document.getElementById('toggle-content-agent').checked,
                support: document.getElementById('toggle-support-agent').checked,
                sales: document.getElementById('toggle-sales-agent').checked,
                leadIntelligence: document.getElementById('toggle-leadIntelligence-agent').checked
            };
            this.saveState();
            await this.saveLeadIntelligenceEnabled(this.state.enabledAgents.leadIntelligence);
            
            // Sync Onboarding Details to Previews
            this.dom.previewBizName.innerText = this.state.bizName;
            try {
                const url = new URL(this.state.bizWebsite);
                this.dom.previewDomain.innerText = url.hostname;
            } catch (err) {
                this.dom.previewDomain.innerText = this.state.bizWebsite;
            }

            // Restart local automation timers with updated business settings.
            this.stopAutomationTimers();
            this.startAutomationTimers();
            
            this.appendConsoleLine('system', `Autopilot Agency re-initialized for business: ${this.state.bizName}`);
            
            // Navigate to Dashboard
            window.location.hash = "#dashboard";
        });

        // Ad copy generator button
        this.dom.generateAdBtn.addEventListener("click", () => this.handleAdGeneration());

        // Social Content generator button
        this.dom.btnGenerateContent.addEventListener("click", () => this.handleContentGeneration());
        this.dom.btnRecommendContent.addEventListener("click", () => this.handleRecommendedPostOfDay());

        // Content Studio sub-tab switching
        this.dom.studioTabs.forEach(tab => {
            tab.addEventListener("click", () => {
                this.dom.studioTabs.forEach(t => t.classList.remove("active"));
                this.dom.studioViews.forEach(v => v.classList.remove("active"));
                
                tab.classList.add("active");
                const targetId = tab.getAttribute("data-target");
                document.getElementById(targetId).classList.add("active");
                
                // If switching to Trends or Queue or Analytics, render them!
                if (targetId === "studio-trends") {
                    this.loadCompetitorTrends();
                } else if (targetId === "studio-queue") {
                    this.renderScheduledQueue();
                } else if (targetId === "studio-analytics") {
                    this.renderPublishedAnalytics();
                } else if (targetId === "studio-drafts") {
                    this.renderSocialPostsGrid();
                }
            });
        });

        // Refresh trends button
        this.dom.btnRefreshTrends.addEventListener("click", () => this.loadCompetitorTrends(true));

        // Modal close / cancel handlers
        this.dom.btnCloseModal.addEventListener("click", () => this.hideScheduleModal());
        this.dom.btnCancelSchedule.addEventListener("click", () => this.hideScheduleModal());
        this.dom.btnCloseLongTextModal.addEventListener("click", () => this.closeLongTextModal());
        this.dom.btnCancelLongTextModal.addEventListener("click", () => this.closeLongTextModal());
        this.dom.btnSaveLongTextModal.addEventListener("click", () => this.saveLongTextModal());
        this.dom.longTextModal.addEventListener("click", (event) => {
            if (event.target === this.dom.longTextModal) this.closeLongTextModal();
        });
        
        // Confirm schedule click
        this.dom.btnConfirmSchedule.addEventListener("click", () => this.confirmSchedulePost());

        // CRM Sub-tab switching
        this.dom.crmTabs.forEach(tab => {
            tab.addEventListener("click", () => {
                this.dom.crmTabs.forEach(t => t.classList.remove("active"));
                this.dom.crmViews.forEach(v => {
                    v.classList.remove("active");
                    v.style.display = "none";
                });
                
                tab.classList.add("active");
                const targetId = tab.getAttribute("data-target");
                const targetView = document.getElementById(targetId);
                targetView.classList.add("active");
                
                if (targetId === "crm-verification") {
                    targetView.style.display = "grid";
                    this.renderVerificationQueue();
                } else if (targetId === "crm-autopilot-settings") {
                    targetView.style.display = "block";
                    this.populateCampaignSelectDropdowns();
                    this.renderDncList();
                } else {
                    targetView.style.display = "block";
                    if (targetId === "crm-pipeline") {
                        this.renderLeadsList();
                    } else if (targetId === "crm-campaigns") {
                        this.renderCampaignsList();
                    }
                }
            });
        });

        // Autopilot Settings auto-saving input listeners
        this.dom.contentAutopilotMasterEnabled.addEventListener("change", () => {
            this.state.contentAutopilot.enabled = this.dom.contentAutopilotMasterEnabled.checked;
            this.saveState();
            this.appendConsoleLine('agent-content', `Content Autopilot status updated: ${this.state.contentAutopilot.enabled ? 'ENABLED' : 'DISABLED'}`);
        });

        this.dom.contentPublishMode.addEventListener("change", () => {
            this.state.contentAutopilot.publishMode = this.dom.contentPublishMode.value;
            this.saveState();
        });

        this.dom.contentAutopilotMedia.addEventListener("change", () => {
            this.state.contentAutopilot.autoAttachMedia = this.dom.contentAutopilotMedia.checked;
            this.saveState();
        });
        
        ['facebook', 'instagram', 'linkedin', 'twitter', 'reddit', 'youtube'].forEach(platform => {
            document.getElementById(`frequency-${platform}-enabled`).addEventListener("change", (e) => {
                this.state.contentAutopilot.frequencies[platform].enabled = e.target.checked;
                this.saveState();
            });
            document.getElementById(`frequency-${platform}-val`).addEventListener("input", (e) => {
                this.state.contentAutopilot.frequencies[platform].value = parseInt(e.target.value) || 0;
                this.saveState();
            });
            document.getElementById(`frequency-${platform}-interval`).addEventListener("change", (e) => {
                this.state.contentAutopilot.frequencies[platform].interval = e.target.value;
                this.saveState();
            });
        });

        this.dom.crmLeadLimit.addEventListener("input", () => {
            this.state.crmAutopilot.dailyLeadTarget = parseInt(this.dom.crmLeadLimit.value) || 100;
            this.saveState();
            this.renderCampaignWorkflowSummary();
        });
        this.dom.crmDailyScrapeQuery.addEventListener("input", () => {
            this.state.crmAutopilot.dailyScrapeQuery = this.dom.crmDailyScrapeQuery.value.trim();
            this.saveState();
            this.renderCampaignWorkflowSummary();
        });
        this.dom.crmDailyScrapeEnabled.addEventListener("change", () => {
            this.state.crmAutopilot.dailyScrapeEnabled = this.dom.crmDailyScrapeEnabled.checked;
            this.saveState();
            this.renderCampaignWorkflowSummary();
        });
        this.dom.crmAutoEnrollScraped.addEventListener("change", () => {
            this.state.crmAutopilot.autoEnrollScrapedLeads = this.dom.crmAutoEnrollScraped.checked;
            this.saveState();
            this.renderCampaignWorkflowSummary();
        });
        this.dom.crmAutoApproveCampaigns.addEventListener("change", () => {
            this.setAutoApproveCampaigns(this.dom.crmAutoApproveCampaigns.checked);
            this.saveState();
            this.renderCampaignWorkflowSummary();
        });
        this.dom.crmAutoAdvanceCampaigns.addEventListener("change", () => {
            this.state.crmAutopilot.autoAdvanceCampaigns = this.dom.crmAutoAdvanceCampaigns.checked;
            this.saveState();
            this.renderCampaignWorkflowSummary();
        });
        this.dom.crmFirstCampaign.addEventListener("change", () => {
            this.state.crmAutopilot.firstCampaignId = this.dom.crmFirstCampaign.value ? parseInt(this.dom.crmFirstCampaign.value) : null;
            this.saveState();
            this.renderCampaignWorkflowSummary();
        });
        this.dom.crmSecondCampaign.addEventListener("change", () => {
            this.state.crmAutopilot.secondCampaignId = this.dom.crmSecondCampaign.value ? parseInt(this.dom.crmSecondCampaign.value) : null;
            this.saveState();
            this.renderCampaignWorkflowSummary();
        });
        this.dom.crmThirdCampaign.addEventListener("change", () => {
            this.state.crmAutopilot.thirdCampaignId = this.dom.crmThirdCampaign.value ? parseInt(this.dom.crmThirdCampaign.value) : null;
            this.saveState();
            this.renderCampaignWorkflowSummary();
        });
        this.dom.crmAutoPause.addEventListener("change", () => {
            this.state.crmAutopilot.autoPauseOnReply = this.dom.crmAutoPause.checked;
            this.saveState();
            this.renderCampaignWorkflowSummary();
        });
        this.dom.crmSimulateUnsubs.addEventListener("change", () => {
            this.state.crmAutopilot.simulateUnsubscribes = false;
            this.saveState();
        });
        this.dom.btnRunCrmPipeline.addEventListener("click", () => this.runCrmPipelineNow());

        // Add DNC button
        this.dom.btnCrmDncAdd.addEventListener("click", () => this.addDncFromInput());
        this.dom.crmDncAddInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); this.addDncFromInput(); }
        });

        // CRM Leads search & filters
        const searchInput = document.getElementById("crm-leads-search");
        const stageFilter = document.getElementById("crm-leads-stage-filter");
        const prevBtn = document.getElementById("btn-leads-prev");
        const nextBtn = document.getElementById("btn-leads-next");
        
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                this.state.leadsSearchQuery = e.target.value;
                this.state.leadsPage = 1;
                this.fetchLeadsFromServer();
            });
        }
        if (stageFilter) {
            stageFilter.addEventListener("change", (e) => {
                this.state.leadsStageFilter = e.target.value;
                this.state.leadsPage = 1;
                this.fetchLeadsFromServer();
            });
        }
        if (prevBtn) {
            prevBtn.addEventListener("click", () => {
                if (this.state.leadsPage > 1) {
                    this.state.leadsPage--;
                    this.fetchLeadsFromServer();
                }
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener("click", () => {
                if (this.state.leadsPage < this.state.leadsPagesCount) {
                    this.state.leadsPage++;
                    this.fetchLeadsFromServer();
                }
            });
        }

        // CRM Scrape Leads button
        this.dom.btnCrmScrape.addEventListener("click", () => this.handleCrmScrape());

        // CRM Campaign form submit
        this.dom.crmCampaignForm.addEventListener("submit", (e) => {
            e.preventDefault();
            this.handleCrmCampaignCreate();
        });

        // Developer credentials form submit
        if (this.dom.devCredentialsForm) {
            this.dom.devCredentialsForm.addEventListener("submit", (e) => {
                e.preventDefault();
                this.saveDeveloperCredentials();
            });
        }

        // Asset Downloader Click Listeners
        this.dom.btnInspectVideo.addEventListener("click", () => this.handleVideoInspect());
        this.dom.downloaderUrlInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); this.handleVideoInspect(); }
        });
        this.dom.btnDownloadVideo.addEventListener("click", () => this.handleVideoDownload('video'));
        this.dom.btnExtractAudio.addEventListener("click", () => this.handleVideoDownload('audio'));
        this.dom.btnExtractTranscript.addEventListener("click", () => this.handleTranscriptExtract());
        this.dom.btnAdaptTranscript.addEventListener("click", () => this.adaptTranscriptToPost());
    }

    async loadState() {
        const saved = localStorage.getItem("autopilot_agency_state");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.state = { ...this.state, ...parsed };
            } catch (e) {
                console.error("Error loading localStorage state:", e);
            }
        }
        
        // Safeguard state arrays against undefined/null from older saved states
        if (!Array.isArray(this.state.leads)) this.state.leads = [];
        if (!Array.isArray(this.state.campaignsList)) this.state.campaignsList = [];
        if (!Array.isArray(this.state.verificationQueue)) this.state.verificationQueue = [];
        if (!Array.isArray(this.state.socialPosts)) this.state.socialPosts = [];
        if (!Array.isArray(this.state.competitorTrends)) this.state.competitorTrends = [];
        if (!Array.isArray(this.state.competitorTrendKeywords)) this.state.competitorTrendKeywords = [];
        if (!Array.isArray(this.state.trendSearchQueries)) this.state.trendSearchQueries = [];
        if (!Array.isArray(this.state.scheduledPosts)) this.state.scheduledPosts = [];
        if (!Array.isArray(this.state.publishedPosts)) this.state.publishedPosts = [];
        
        // Migrate competitorUrls from old string format to array
        if (typeof this.state.competitorUrls === 'string') {
            this.state.competitorUrls = this.state.competitorUrls.split(',').map(c => c.trim()).filter(c => c);
        }
        if (!Array.isArray(this.state.competitorUrls)) {
            this.state.competitorUrls = [];
        }
        if (!this.state.companySocialLinks || typeof this.state.companySocialLinks !== 'object') {
            this.state.companySocialLinks = {};
        }
        if (Array.isArray(this.state.competitorProfiles)) {
            this.state.competitorProfiles = this.state.competitorProfiles.reduce((acc, profile) => {
                const domain = this.normalizeCompetitorDomain(profile.domain || profile.website || profile.name || '');
                if (domain) acc[domain] = { ...profile, domain };
                return acc;
            }, {});
        }
        if (!this.state.competitorProfiles || typeof this.state.competitorProfiles !== 'object') {
            this.state.competitorProfiles = {};
        }
        this.clearKnownDemoState();
        
        // Ensure enabledAgents exists
        if (!this.state.enabledAgents || typeof this.state.enabledAgents !== 'object') {
            this.state.enabledAgents = { ad: false, content: false, support: false, sales: false, leadIntelligence: false };
        }
        this.state.enabledAgents = {
            ad: this.state.enabledAgents.ad !== false,
            content: this.state.enabledAgents.content !== false,
            support: this.state.enabledAgents.support !== false,
            sales: this.state.enabledAgents.sales !== false,
            leadIntelligence: this.state.enabledAgents.leadIntelligence === true
        };
        if (!this.state.leadIntelligence || typeof this.state.leadIntelligence !== 'object') {
            this.state.leadIntelligence = {
                enabled: false,
                running: false,
                intervalMs: 3600000,
                status: null
            };
        }

        // Ensure contentAutopilot settings exist
        if (!this.state.contentAutopilot || typeof this.state.contentAutopilot !== 'object') {
            this.state.contentAutopilot = {
                enabled: false,
                publishMode: 'draft',
                autoAttachMedia: true,
                frequencies: {
                    facebook: { enabled: false, value: 1, interval: 'day' },
                    instagram: { enabled: false, value: 2, interval: 'day' },
                    linkedin: { enabled: false, value: 1, interval: 'week' },
                    twitter: { enabled: false, value: 1, interval: 'day' },
                    reddit: { enabled: false, value: 1, interval: 'week' },
                    youtube: { enabled: false, value: 1, interval: 'week' }
                }
            };
        }

        // Ensure crmAutopilot settings exist
        if (!this.state.crmAutopilot || typeof this.state.crmAutopilot !== 'object') {
            this.state.crmAutopilot = {
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
            };
        }
        this.state.crmAutopilot = {
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
            ...this.state.crmAutopilot
        };
        this.normalizeAutoApproveCampaigns();
        if (!Array.isArray(this.state.crmAutopilot.dncList)) {
            this.state.crmAutopilot.dncList = [];
        }
        this.state.leadStageCounts = this.state.leadStageCounts || {};
        
        // Clean out any old-format individual email drafts from verificationQueue
        this.state.verificationQueue = this.state.verificationQueue.filter(item => item && Array.isArray(item.steps));

        await this.loadServerConfig();
        await this.loadOpenRouterSettings();
        await this.loadLeadIntelligenceStatus();
        await this.loadCrmStateFromServer();
        
        // Populate inputs
        document.getElementById("biz-name").value = this.state.bizName;
        document.getElementById("biz-website").value = this.state.bizWebsite;
        document.getElementById("biz-desc").value = this.state.bizDesc;
        document.getElementById("biz-audience").value = this.state.bizAudience;
        this.dom.bizSwotInput.value = this.state.bizSwot || "";
        this.dom.agencyGoalInput.value = this.state.agencyGoal || "";
        this.dom.coreMessageInput.value = this.state.coreMessage || "";
        this.dom.extraDetailsInput.value = this.state.extraDetails || "";
        this.resizeOnboardingResearchFields();
        document.getElementById("ad-budget").value = this.state.adBudget;
        this.dom.dealValueInput.value = this.state.dealValue || 1000;
        this.dom.conversionRateInput.value = this.state.conversionRate || 10;
        this.dom.marketingGoalInput.value = this.state.marketingGoal || "lead-gen";
        
        // Populate Autopilot Settings Inputs
        this.dom.contentAutopilotMasterEnabled.checked = this.state.contentAutopilot.enabled !== false;
        this.dom.contentPublishMode.value = this.state.contentAutopilot.publishMode || 'draft';
        this.dom.contentAutopilotMedia.checked = this.state.contentAutopilot.autoAttachMedia !== false;
        ['facebook', 'instagram', 'linkedin', 'twitter', 'reddit', 'youtube'].forEach(platform => {
            const freq = this.state.contentAutopilot.frequencies[platform] || { enabled: false, value: 1, interval: 'day' };
            document.getElementById(`frequency-${platform}-enabled`).checked = freq.enabled;
            document.getElementById(`frequency-${platform}-val`).value = freq.value;
            document.getElementById(`frequency-${platform}-interval`).value = freq.interval;
        });

        this.dom.crmLeadLimit.value = this.state.crmAutopilot.dailyLeadTarget || 100;
        this.dom.crmDailyScrapeQuery.value = this.state.crmAutopilot.dailyScrapeQuery || '';
        this.dom.crmDailyScrapeEnabled.checked = this.state.crmAutopilot.dailyScrapeEnabled === true;
        this.dom.crmAutoEnrollScraped.checked = this.state.crmAutopilot.autoEnrollScrapedLeads === true;
        this.dom.crmAutoApproveCampaigns.checked = this.state.crmAutopilot.autoApproveCampaigns === true;
        this.dom.crmAutoAdvanceCampaigns.checked = this.state.crmAutopilot.autoAdvanceCampaigns === true;
        this.dom.crmAutoPause.checked = this.state.crmAutopilot.autoPauseOnReply !== false;
        this.dom.crmSimulateUnsubs.checked = false;
        this.state.crmAutopilot.simulateUnsubscribes = false;

        // Render the competitor list UI from array
        this.renderCompetitorList();
        this.syncCompetitorHiddenInput();
        this.populateCampaignSelectDropdowns();
        this.renderCampaignWorkflowSummary();
        this.renderDncList();
        
        // Restore agent toggle states and card classes
        this.getAgentKeys().forEach(key => this.syncAgentToggleUI(key));
        this.renderLeadIntelligenceStatus();
        
        this.dom.settingsApiKey.value = this.state.serverConfig.geminiConfigured ? "Configured on server (.env)" : "";
        this.renderOpenRouterSettings();
        this.dom.settingsUseFallback.checked = this.state.useFallback;
        this.dom.settingsDailyLimit.value = this.state.outboundDailyLimit || 50;
        this.normalizeAutoApproveCampaigns();
        this.dom.settingsBypassVerification.checked = this.state.bypassEmailVerification;
        this.dom.settingsBookingLink.value = this.state.crmAutopilot.bookingLink || '';
        this.dom.settingsSalesPageUrl.value = this.state.crmAutopilot.salesPageUrl || '';
        this.dom.settingsDemoVideoUrl.value = this.state.crmAutopilot.demoVideoUrl || '';
        this.dom.settingsYoutubePageUrl.value = this.state.crmAutopilot.youtubePageUrl || '';
        
        this.dom.previewBizName.innerText = this.state.bizName;
        try {
            const url = new URL(this.state.bizWebsite);
            this.dom.previewDomain.innerText = url.hostname;
        } catch(err) {
            this.dom.previewDomain.innerText = this.state.bizWebsite;
        }

        this.updateApiStatusUI();
    }

    async loadServerConfig() {
        try {
            const response = await fetch('/api/app-config');
            if (!response.ok) throw new Error("App config unavailable");
            const config = await response.json();
            this.state.serverConfig = {
                ...this.state.serverConfig,
                ...config
            };
        } catch (error) {
            console.warn("Could not load server config:", error.message);
        }
    }

    getAgentKeys() {
        return ['ad', 'content', 'support', 'sales', 'leadIntelligence'];
    }

    getAgentConsoleId(agentKey) {
        if (agentKey === 'leadIntelligence') return 'agent-intelligence';
        return `agent-${agentKey}`;
    }

    syncAgentToggleUI(agentKey) {
        const isEnabled = this.state.enabledAgents[agentKey] === true;
        const setupCheckbox = document.getElementById(`toggle-${agentKey}-agent`);
        const dashboardCheckbox = document.getElementById(`dashboard-toggle-${agentKey}-agent`);
        if (setupCheckbox) setupCheckbox.checked = isEnabled;
        if (dashboardCheckbox) dashboardCheckbox.checked = isEnabled;

        document.querySelectorAll(`.agent-workflow-card[data-agent="${agentKey}"]`).forEach(card => {
            card.classList.toggle('agent-active', isEnabled);
            card.classList.toggle('agent-inactive', !isEnabled);
        });

        const dot = this.dom.agentStatusDots[this.getAgentConsoleId(agentKey)];
        if (dot && agentKey !== 'leadIntelligence') {
            dot.className = isEnabled ? 'status-indicator working' : 'status-indicator idling';
        }
    }

    async loadLeadIntelligenceStatus() {
        try {
            const response = await fetch('/api/lead-intelligence/status');
            if (!response.ok) throw new Error("Lead intelligence status unavailable");
            const data = await response.json();
            this.state.leadIntelligence = {
                ...this.state.leadIntelligence,
                ...data
            };
            this.state.enabledAgents.leadIntelligence = data.enabled === true;
            this.saveState();
            this.syncAgentToggleUI('leadIntelligence');
            this.renderLeadIntelligenceStatus();
            return data;
        } catch (error) {
            console.warn("Could not load lead intelligence status:", error.message);
            this.renderLeadIntelligenceStatus(error.message);
            return null;
        }
    }

    summarizeLeadIntelligenceStatus() {
        const info = this.state.leadIntelligence || {};
        const status = info.status || {};
        const countByStatus = (rows = [], name) => {
            const found = rows.find(row => String(row.status || '').toLowerCase() === String(name).toLowerCase());
            return found ? Number(found.count || 0) : 0;
        };
        const pending = countByStatus(status.offices || [], 'Pending') + countByStatus(status.offices || [], 'Discovered');
        const harvested = countByStatus(status.offices || [], 'Harvested');
        const blocked = countByStatus(status.offices || [], 'Blocked');
        const contacts = Number(status.contacts || 0);
        return { pending, harvested, blocked, contacts };
    }

    renderLeadIntelligenceStatus(errorMessage = '') {
        const info = this.state.leadIntelligence || {};
        const summary = this.summarizeLeadIntelligenceStatus();
        const enabled = this.state.enabledAgents.leadIntelligence === true;
        const dot = this.dom.agentStatusDots['agent-intelligence'];
        const task = this.dom.agentTasks['agent-intelligence'];
        const meta = this.dom.leadIntelligenceMeta;
        const runBtn = this.dom.btnRunLeadIntelligence;

        if (dot) {
            dot.className = info.running ? 'status-indicator thinking' : enabled ? 'status-indicator working' : 'status-indicator idling';
        }
        if (task) {
            if (errorMessage) {
                task.innerText = `Status unavailable: ${errorMessage}`;
            } else if (!enabled) {
                task.innerText = 'Hidden database worker paused';
            } else if (info.running) {
                task.innerText = 'Building brokerage roster database now';
            } else if (summary.contacts > 0) {
                task.innerText = `${summary.contacts} hidden contacts found`;
            } else {
                task.innerText = `${summary.pending || 0} offices queued for public roster harvest`;
            }
        }
        if (meta) {
            meta.innerText = `Queued ${summary.pending || 0} | Harvested ${summary.harvested || 0} | Blocked ${summary.blocked || 0}`;
        }
        if (runBtn) {
            runBtn.disabled = !enabled || info.running === true;
            runBtn.title = enabled ? 'Run one hidden lead intelligence cycle now' : 'Turn on Lead Intelligence first';
        }
    }

    async saveLeadIntelligenceEnabled(enabled) {
        try {
            const response = await fetch('/api/lead-intelligence/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: enabled === true })
            });
            if (!response.ok) throw new Error(await this.parseApiError(response, 'Could not update Lead Intelligence'));
            const data = await response.json();
            this.state.leadIntelligence = {
                ...this.state.leadIntelligence,
                ...data
            };
            this.state.enabledAgents.leadIntelligence = data.enabled === true;
            this.syncAgentToggleUI('leadIntelligence');
            this.renderLeadIntelligenceStatus();
        } catch (error) {
            this.appendConsoleLine('system', `Lead Intelligence toggle failed: ${error.message}`);
            this.state.enabledAgents.leadIntelligence = !enabled;
            this.syncAgentToggleUI('leadIntelligence');
            this.renderLeadIntelligenceStatus(error.message);
            alert(`Could not update Lead Intelligence: ${error.message}`);
        }
    }

    async runLeadIntelligenceNow() {
        if (!this.state.enabledAgents.leadIntelligence) return;
        const btn = this.dom.btnRunLeadIntelligence;
        const originalHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
        }
        this.state.leadIntelligence.running = true;
        this.renderLeadIntelligenceStatus();
        this.appendConsoleLine('agent-sales', 'Lead Intelligence Worker started one hidden roster harvest cycle.');

        try {
            const response = await fetch('/api/lead-intelligence/run-once?async=true', { method: 'POST' });
            if (!response.ok) throw new Error(await this.parseApiError(response, 'Lead Intelligence run failed'));
            const data = await response.json();
            this.state.leadIntelligence.status = data.status || this.state.leadIntelligence.status;
            const result = data.result || {};
            if (result.skipped) {
                this.state.leadIntelligence.running = false;
                this.appendConsoleLine('agent-sales', `Lead Intelligence skipped: ${result.reason || 'nothing queued'}.`);
            } else {
                this.appendConsoleLine('agent-sales', 'Lead Intelligence accepted. Watching the hidden worker status now.');
                await this.watchLeadIntelligenceRun();
            }
            await this.loadLeadIntelligenceStatus();
        } catch (error) {
            this.state.leadIntelligence.running = false;
            this.renderLeadIntelligenceStatus(error.message);
            this.appendConsoleLine('system', `Lead Intelligence run failed: ${error.message}`);
            alert(`Lead Intelligence run failed: ${error.message}`);
        } finally {
            if (btn) {
                btn.innerHTML = originalHtml || `<i class="fa-solid fa-play"></i>`;
            }
            this.renderLeadIntelligenceStatus();
        }
    }

    async watchLeadIntelligenceRun() {
        const startedAt = Date.now();
        const maxWaitMs = 5 * 60 * 1000;
        let sawRunning = false;
        let lastRunId = null;

        while (Date.now() - startedAt < maxWaitMs) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const data = await this.loadLeadIntelligenceStatus();
            const recent = data?.status?.recentRuns?.[0];
            if (data?.running) {
                sawRunning = true;
                if (recent?.id && recent.id !== lastRunId) {
                    lastRunId = recent.id;
                    this.appendConsoleLine('agent-sales', recent.message || 'Lead Intelligence worker is running.');
                }
                continue;
            }

            this.state.leadIntelligence.running = false;
            if (recent && (sawRunning || recent.id === lastRunId || Date.now() - startedAt > 10000)) {
                const stats = recent.stats || {};
                this.appendConsoleLine('agent-sales', `Lead Intelligence ${String(recent.status || '').toLowerCase()}: ${stats.contacts || 0} contact(s), ${stats.pagesScanned || 0} page(s) scanned.`);
                return recent;
            }
        }

        this.state.leadIntelligence.running = false;
        this.appendConsoleLine('system', 'Lead Intelligence is still running in the background. Refresh status from the dashboard in a minute.');
        return null;
    }

    async loadOpenRouterSettings() {
        try {
            const response = await fetch('/api/openrouter-settings');
            if (!response.ok) throw new Error("OpenRouter settings unavailable");
            this.state.openRouterSettings = await response.json();
        } catch (error) {
            console.warn("Could not load OpenRouter settings:", error.message);
            const models = this.state.serverConfig.openRouterModels || {};
            this.state.openRouterSettings = {
                configured: this.state.serverConfig.openRouterConfigured === true,
                enabled: this.state.serverConfig.openRouterConfigured === true,
                webSearchEnabled: models.webSearchEnabled === true,
                dailyRequestLimit: models.dailyRequestLimit || 200,
                modelOrder: Array.isArray(models.order) ? models.order : []
            };
        }
    }

    renderOpenRouterSettings() {
        const settings = this.state.openRouterSettings || {};
        const modelOrder = Array.isArray(settings.modelOrder) ? settings.modelOrder : [];
        if (this.dom.settingsOpenRouterKey) {
            this.dom.settingsOpenRouterKey.value = "";
            this.dom.settingsOpenRouterKey.placeholder = settings.configured
                ? `Configured from ${settings.source || 'server'}; paste a new key to replace`
                : "Paste OpenRouter key to save";
        }
        if (this.dom.settingsOpenRouterStatus) {
            this.dom.settingsOpenRouterStatus.textContent = settings.configured
                ? `OpenRouter configured from ${settings.source || 'server'}. Lead intelligence will try free models before Gemini when enabled.`
                : "OpenRouter is optional. Lead intelligence will use free OpenRouter models first when enabled, then fall back to Gemini.";
        }
        if (this.dom.settingsOpenRouterEnabled) this.dom.settingsOpenRouterEnabled.checked = settings.enabled === true;
        if (this.dom.settingsOpenRouterWebSearch) this.dom.settingsOpenRouterWebSearch.checked = settings.webSearchEnabled === true;
        if (this.dom.settingsOpenRouterDailyLimit) this.dom.settingsOpenRouterDailyLimit.value = settings.dailyRequestLimit || 200;
        if (this.dom.settingsOpenRouterModels) {
            this.dom.settingsOpenRouterModels.value = modelOrder.join('\n');
        }
    }

    async saveOpenRouterSettings({ clearApiKey = false } = {}) {
        const modelOrder = (this.dom.settingsOpenRouterModels.value || '')
            .split(/\r?\n|,/)
            .map(item => item.trim())
            .filter(Boolean);
        const payload = {
            enabled: this.dom.settingsOpenRouterEnabled.checked,
            apiKey: this.dom.settingsOpenRouterKey.value.trim(),
            clearApiKey,
            webSearchEnabled: this.dom.settingsOpenRouterWebSearch.checked,
            dailyRequestLimit: parseInt(this.dom.settingsOpenRouterDailyLimit.value, 10) || 200,
            modelOrder
        };

        const response = await fetch('/api/openrouter-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            throw new Error(data.error || "OpenRouter settings could not be saved");
        }

        this.state.openRouterSettings = data.openRouter || this.state.openRouterSettings;
        this.state.serverConfig.openRouterConfigured = this.state.openRouterSettings.enabled === true;
        this.state.serverConfig.openRouterModels = {
            ...(this.state.serverConfig.openRouterModels || {}),
            order: this.state.openRouterSettings.modelOrder || [],
            research: this.state.openRouterSettings.researchModel,
            webSearchEnabled: this.state.openRouterSettings.webSearchEnabled,
            dailyRequestLimit: this.state.openRouterSettings.dailyRequestLimit
        };
        this.renderOpenRouterSettings();
    }

    getConfiguredClientLabel() {
        const businessName = String(this.state.bizName || '').trim();
        if (businessName) return businessName;

        const website = String(this.state.bizWebsite || '').trim();
        if (!website) return '';

        try {
            return new URL(website).hostname;
        } catch (error) {
            return website;
        }
    }

    appendStartupStatusLine() {
        const clientLabel = this.getConfiguredClientLabel();
        if (clientLabel) {
            this.appendConsoleLine('system', `Workspace ready for ${clientLabel}. Onboarding profile loaded.`);
            return;
        }

        this.appendConsoleLine('system', 'Workspace ready. Add a client in Agency Onboarding to begin.');
    }

    async fetchLeadsFromServer() {
        try {
            const selectedLeadId = this.state.selectedLeadId;
            const stage = this.state.leadsStageFilter || 'All';
            const search = this.state.leadsSearchQuery || '';
            const page = this.state.leadsPage || 1;
            const url = `/api/leads?stage=${encodeURIComponent(stage)}&search=${encodeURIComponent(search)}&page=${page}&limit=50`;
            
            const res = await fetch(url);
            if (!res.ok) throw new Error("Leads fetch failed");
            const data = await res.json();
            
            this.state.leads = data.leads || [];
            this.state.leadsPage = data.page || 1;
            this.state.leadsPagesCount = data.pages || 1;
            this.state.stats.leads = data.total || 0;

            if (selectedLeadId !== null) {
                const selectedIndex = this.state.leads.findIndex(lead => lead.id === selectedLeadId);
                this.state.selectedLeadIndex = selectedIndex >= 0 ? selectedIndex : null;
            }
            
            this.renderLeadsList();
            this.renderStats();
            this.updatePaginationUI();

            if (this.state.selectedLeadIndex !== null) {
                this.renderSelectedLead();
            }
        } catch (err) {
            console.error('[Leads Fetch Error]', err.message);
        }
    }

    startCrmRefreshPolling() {
        if (this.crmRefreshTimer) clearInterval(this.crmRefreshTimer);
        this.crmRefreshTimer = setInterval(() => {
            if (window.location.hash !== "#crm") return;
            if (this.crmRefreshInFlight) return;
            this.crmRefreshInFlight = true;
            this.fetchLeadsFromServer().finally(() => {
                this.crmRefreshInFlight = false;
            });
        }, 5000);
    }

    updatePaginationUI() {
        const info = document.getElementById("leads-pagination-info");
        if (info) {
            info.innerText = `Page ${this.state.leadsPage} of ${this.state.leadsPagesCount}`;
        }
        const prevBtn = document.getElementById("btn-leads-prev");
        const nextBtn = document.getElementById("btn-leads-next");
        if (prevBtn) prevBtn.disabled = this.state.leadsPage <= 1;
        if (nextBtn) nextBtn.disabled = this.state.leadsPage >= this.state.leadsPagesCount;
    }

    async loadCrmStateFromServer() {
        try {
            const response = await fetch('/api/crm-state');
            if (!response.ok) throw new Error("CRM storage unavailable");
            const serverState = await response.json();

            this.state.campaignsList = Array.isArray(serverState.campaignsList) ? serverState.campaignsList : [];
            this.state.verificationQueue = Array.isArray(serverState.verificationQueue) ? serverState.verificationQueue : [];
            this.state.crmAutopilot = {
                ...this.state.crmAutopilot,
                ...(serverState.crmAutopilot || {})
            };
            this.normalizeAutoApproveCampaigns();
            this.state.leadStageCounts = serverState.leadStageCounts || {};
            
            await this.fetchLeadsFromServer();
            this.populateCampaignSelectDropdowns();
            this.renderCampaignWorkflowSummary();
        } catch (error) {
            console.warn("Could not load CRM storage; using browser state:", error.message);
            this.renderLeadsList();
            this.renderCampaignWorkflowSummary();
        }
    }

    clearKnownDemoState() {
        const cleanupKey = "autopilot_demo_cleanup_v1";
        if (localStorage.getItem(cleanupKey) === "done") return;

        const looksLikeOriginalDemo =
            this.state.bizName === "Cleared2Close" ||
            this.state.bizWebsite === "https://cleared2close.com" ||
            (Array.isArray(this.state.competitorUrls) &&
                this.state.competitorUrls.includes("dotloop.com") &&
                this.state.competitorUrls.includes("skyslope.com"));

        if (!looksLikeOriginalDemo) {
            localStorage.setItem(cleanupKey, "done");
            return;
        }

        this.state.bizName = "";
        this.state.bizWebsite = "";
        this.state.bizDesc = "";
        this.state.bizAudience = "";
        this.state.agencyGoal = "";
        this.state.coreMessage = "";
        this.state.extraDetails = "";
        this.state.adBudget = 0;
        this.state.competitorUrls = [];
        this.state.enabledAgents = { ad: false, content: false, support: false, sales: false, leadIntelligence: false };
        this.state.contentAutopilot.enabled = false;
        Object.keys(this.state.contentAutopilot.frequencies || {}).forEach(platform => {
            this.state.contentAutopilot.frequencies[platform].enabled = false;
        });
        this.state.crmAutopilot.enabled = false;
        this.state.crmAutopilot.dncList = [];
        this.state.stats = { impressions: 0, clicks: 0, leads: 0, spend: 0, revenue: 0 };
        this.state.campaigns = [];
        this.state.socialPosts = [];
        this.state.scheduledPosts = [];
        this.state.publishedPosts = [];
        this.state.leads = [];
        this.state.campaignsList = [];
        this.state.verificationQueue = [];
        this.state.supportSessions = [];
        localStorage.setItem(cleanupKey, "done");
    }

    normalizeAutoApproveCampaigns() {
        const enabled = this.state.crmAutopilot.autoApproveCampaigns === true || this.state.crmAutopilot.bypassEmailVerification === true;
        this.setAutoApproveCampaigns(enabled);
    }

    setAutoApproveCampaigns(enabled) {
        const value = enabled === true;
        this.state.bypassEmailVerification = value;
        this.state.crmAutopilot.autoApproveCampaigns = value;
        this.state.crmAutopilot.bypassEmailVerification = value;
        if (this.dom.settingsBypassVerification) this.dom.settingsBypassVerification.checked = value;
        if (this.dom.crmAutoApproveCampaigns) this.dom.crmAutoApproveCampaigns.checked = value;
    }

    saveState() {
        localStorage.setItem("autopilot_agency_state", JSON.stringify({
            bizName: this.state.bizName,
            bizWebsite: this.state.bizWebsite,
            bizDesc: this.state.bizDesc,
            bizAudience: this.state.bizAudience,
            bizSwot: this.state.bizSwot,
            businessReport: this.state.businessReport,
            companySocialLinks: this.state.companySocialLinks,
            agencyGoal: this.state.agencyGoal,
            coreMessage: this.state.coreMessage,
            extraDetails: this.state.extraDetails,
            adBudget: this.state.adBudget,
            dealValue: this.state.dealValue,
            conversionRate: this.state.conversionRate,
            competitorUrls: this.state.competitorUrls,
            competitorProfiles: this.state.competitorProfiles,
            enabledAgents: this.state.enabledAgents,
            contentAutopilot: this.state.contentAutopilot,
            crmAutopilot: this.state.crmAutopilot,
            marketingGoal: this.state.marketingGoal,
            useFallback: this.state.useFallback,
            socialPosts: this.state.socialPosts,
            competitorTrends: this.state.competitorTrends,
            competitorTrendKeywords: this.state.competitorTrendKeywords,
            trendSearchQueries: this.state.trendSearchQueries,
            trendRefreshWarning: this.state.trendRefreshWarning,
            scheduledPosts: this.state.scheduledPosts,
            publishedPosts: this.state.publishedPosts,
            leads: this.state.leads,
            campaignsList: this.state.campaignsList,
            verificationQueue: this.state.verificationQueue,
            outboundDailyLimit: this.state.outboundDailyLimit,
            bypassEmailVerification: this.state.bypassEmailVerification
        }));

        this.persistCrmStateSoon();
    }

    persistCrmStateSoon() {
        if (this.crmPersistTimer) {
            clearTimeout(this.crmPersistTimer);
        }

        this.crmPersistTimer = setTimeout(() => {
            this.persistCrmState();
        }, 500);
    }

    async persistCrmState() {
        const payload = {
            leads: this.state.leads || [],
            campaignsList: this.state.campaignsList || [],
            verificationQueue: this.state.verificationQueue || [],
            crmAutopilot: this.state.crmAutopilot || {}
        };

        try {
            const response = await fetch('/api/crm-state', {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`CRM storage save failed: ${response.status}`);
        } catch (error) {
            console.warn("CRM backend save failed; local browser state remains available:", error.message);
        }
    }

    updateApiStatusUI() {
        const geminiLive = this.state.serverConfig && this.state.serverConfig.geminiConfigured;
        const openRouterLive = this.state.openRouterSettings && this.state.openRouterSettings.enabled;
        if (geminiLive && openRouterLive) {
            this.dom.headerApiStatus.innerHTML = `<i class="fa-solid fa-microchip text-accent"></i> OpenRouter + Gemini Live`;
            this.dom.headerApiStatus.style.color = "var(--accent)";
        } else if (geminiLive) {
            this.dom.headerApiStatus.innerHTML = `<i class="fa-solid fa-microchip text-accent"></i> Gemini API Live`;
            this.dom.headerApiStatus.style.color = "var(--accent)";
        } else {
            this.dom.headerApiStatus.innerHTML = `<i class="fa-solid fa-flask text-orange"></i> Local Simulator`;
            this.dom.headerApiStatus.style.color = "var(--orange)";
        }
    }

    initDefaultCampaigns() {
        if (!Array.isArray(this.state.campaigns)) this.state.campaigns = [];
    }

    initDefaultSocialPosts() {
        if (!this.state.socialPosts) this.state.socialPosts = [];
        if (!this.state.scheduledPosts) this.state.scheduledPosts = [];
        if (!this.state.publishedPosts) this.state.publishedPosts = [];
        if (!this.state.competitorTrends) this.state.competitorTrends = [];
    }

    // Call Gemini secure backend API Proxy
    async queryGeminiAPI(promptText) {
        try {
            const response = await fetch('/api/gemini-proxy', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ prompt: promptText })
            });
            
            if (!response.ok) {
                throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            return data.text;
        } catch (error) {
            console.error("Gemini proxy query failed:", error);
            throw error;
        }
    }

    getScanProgressStages() {
        return [
            { step: "crawl", percent: 10, seconds: 0, title: "Reading website pages and public copy..." },
            { step: "business", percent: 25, seconds: 8, title: "Researching the company, offer, and value..." },
            { step: "competitors", percent: 43, seconds: 22, title: "Finding direct competitors and positioning..." },
            { step: "socials", percent: 60, seconds: 40, title: "Checking competitor and company social profiles..." },
            { step: "swot", percent: 78, seconds: 62, title: "Developing SWOT and strategic business analysis..." },
            { step: "finalize", percent: 90, seconds: 84, title: "Finalizing onboarding fields and report..." }
        ];
    }

    startScanProgress() {
        if (!this.dom.scanProgressPanel) return;
        if (this.scanProgressTimer) clearInterval(this.scanProgressTimer);

        this.scanProgressStartedAt = Date.now();
        this.dom.scanProgressPanel.style.display = "flex";
        this.setScanProgressStage(0);

        this.scanProgressTimer = setInterval(() => {
            const elapsedSeconds = (Date.now() - this.scanProgressStartedAt) / 1000;
            const stages = this.getScanProgressStages();
            let nextIndex = 0;
            stages.forEach((stage, index) => {
                if (elapsedSeconds >= stage.seconds) nextIndex = index;
            });
            this.setScanProgressStage(nextIndex);
        }, 1200);
    }

    setScanProgressStage(activeIndex) {
        const stages = this.getScanProgressStages();
        const activeStage = stages[activeIndex] || stages[0];
        if (this.dom.scanProgressTitle) {
            this.dom.scanProgressTitle.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-purple"></i> ${activeStage.title}`;
        }
        if (this.dom.scanProgressPercent) this.dom.scanProgressPercent.innerText = `${activeStage.percent}%`;
        if (this.dom.scanProgressBar) this.dom.scanProgressBar.style.width = `${activeStage.percent}%`;

        this.dom.scanProgressSteps.forEach((item, index) => {
            item.classList.toggle("complete", index < activeIndex);
            item.classList.toggle("active", index === activeIndex);
            item.classList.remove("error");
        });
    }

    completeScanProgress() {
        if (this.scanProgressTimer) clearInterval(this.scanProgressTimer);
        this.scanProgressTimer = null;
        if (this.dom.scanProgressPanel) this.dom.scanProgressPanel.style.display = "flex";
        if (this.dom.scanProgressTitle) {
            this.dom.scanProgressTitle.innerHTML = `<i class="fa-solid fa-circle-check text-success"></i> Research complete. Onboarding fields updated.`;
        }
        if (this.dom.scanProgressPercent) this.dom.scanProgressPercent.innerText = "100%";
        if (this.dom.scanProgressBar) this.dom.scanProgressBar.style.width = "100%";
        this.dom.scanProgressSteps.forEach(item => {
            item.classList.add("complete");
            item.classList.remove("active", "error");
        });
    }

    failScanProgress(message) {
        if (this.scanProgressTimer) clearInterval(this.scanProgressTimer);
        this.scanProgressTimer = null;
        if (this.dom.scanProgressPanel) this.dom.scanProgressPanel.style.display = "flex";
        if (this.dom.scanProgressTitle) {
            this.dom.scanProgressTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-pink"></i> Scan stopped: ${this.escapeHtml(message || "Please try again.")}`;
        }
        this.dom.scanProgressSteps.forEach(item => {
            if (item.classList.contains("active")) item.classList.add("error");
        });
    }

    autoGrowSetupTextarea(textarea) {
        if (!textarea) return;
        const minHeight = textarea.id === "biz-swot" ? 560 : 340;
        const maxHeight = textarea.id === "biz-swot" ? 980 : 720;
        textarea.style.setProperty("min-height", `${minHeight}px`, "important");
        textarea.style.setProperty("height", "auto", "important");
        const nextHeight = Math.min(Math.max(textarea.scrollHeight + 4, minHeight), maxHeight);
        textarea.style.setProperty("height", `${nextHeight}px`, "important");
        textarea.style.setProperty("overflow-y", textarea.scrollHeight > maxHeight ? "auto" : "hidden", "important");
    }

    resizeOnboardingResearchFields() {
        requestAnimationFrame(() => {
            this.autoGrowSetupTextarea(document.getElementById("biz-desc"));
            this.autoGrowSetupTextarea(this.dom.bizSwotInput);
        });
    }

    openLongTextModal(sourceId, title) {
        const source = document.getElementById(sourceId);
        if (!source || !this.dom.longTextModal) return;

        this.longTextModalSourceId = sourceId;
        this.dom.longTextModalTitle.innerHTML = `<i class="fa-solid fa-up-right-and-down-left-from-center text-accent"></i> ${this.escapeHtml(title || "Expanded Editor")}`;
        this.dom.longTextModalInput.value = source.value || "";
        this.dom.longTextModal.style.display = "flex";
        setTimeout(() => this.dom.longTextModalInput.focus(), 50);
    }

    closeLongTextModal() {
        if (this.dom.longTextModal) this.dom.longTextModal.style.display = "none";
        this.longTextModalSourceId = null;
    }

    saveLongTextModal() {
        if (!this.longTextModalSourceId) return this.closeLongTextModal();
        const source = document.getElementById(this.longTextModalSourceId);
        if (!source) return this.closeLongTextModal();

        source.value = this.dom.longTextModalInput.value;
        this.autoGrowSetupTextarea(source);
        if (this.longTextModalSourceId === "biz-desc") {
            this.state.bizDesc = source.value;
        } else if (this.longTextModalSourceId === "biz-swot") {
            this.state.bizSwot = source.value;
        }
        this.saveState();
        this.closeLongTextModal();
    }

    // Web Scraper Controller
    async handleWebsiteScan() {
        const url = document.getElementById("biz-website").value.trim();
        if (!url) {
            alert("Please enter a Website URL first.");
            return;
        }

        this.dom.scanStatus.style.display = "inline-block";
        this.dom.btnScanWebsite.disabled = true;
        this.dom.btnScanWebsite.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Scanning...`;
        this.startScanProgress();

        try {
            const response = await fetch('/api/scrape', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Scraping failed");
            }

            const data = await response.json();
            
            // Format and load text areas
            const descriptionText = data.description || "";
            const coreOffersText = data.offers || "";
            const valueText = data.valueProposition ? `\n\nValue Proposition:\n${data.valueProposition}` : "";
            const swotText = this.normalizeSwotText(this.getSwotValueFromScan(data), data.businessReport, data);
            
            document.getElementById("biz-name").value = data.businessName || document.getElementById("biz-name").value;
            document.getElementById("biz-desc").value = `${descriptionText}\n\nCore Offers:\n${coreOffersText}${valueText}`;
            this.dom.bizSwotInput.value = swotText;
            this.resizeOnboardingResearchFields();
            this.state.bizSwot = swotText;
            this.state.businessReport = data.businessReport || "";
            this.state.companySocialLinks = data.companySocialLinks || {};
            
            // Auto-populate target audience and competitors on scan!
            if (data.audience) {
                document.getElementById("biz-audience").value = data.audience;
            }
            const competitorSource = data.competitors || (Array.isArray(data.competitorProfiles) ? data.competitorProfiles.map(profile => profile.domain).join(', ') : '');
            if (competitorSource) {
                const scannedCompetitors = this.parseCompetitorDomains(competitorSource);
                this.storeCompetitorProfiles(data.competitorProfiles || []);
                this.state.competitorUrls = scannedCompetitors;
                this.renderCompetitorList();
                this.syncCompetitorHiddenInput();
            }
            this.state.bizName = document.getElementById("biz-name").value;
            this.state.bizWebsite = url;
            this.state.bizDesc = document.getElementById("biz-desc").value;
            this.state.bizAudience = document.getElementById("biz-audience").value;
            this.state.agencyGoal = this.dom.agencyGoalInput.value.trim();
            this.state.coreMessage = this.dom.coreMessageInput.value.trim();
            this.state.extraDetails = this.dom.extraDetailsInput.value.trim();
            this.saveState();
            this.completeScanProgress();
            
            this.appendConsoleLine('system', `Deep onboarding research complete for: ${url}. AI built the company profile, audience, competitors, social links, and SWOT profile.`);
            
        } catch (error) {
            console.error("Website scan failed:", error);
            this.failScanProgress(error.message);
            alert(`Scanning failed: ${error.message}`);
        } finally {
            this.dom.scanStatus.style.display = "none";
            this.dom.btnScanWebsite.disabled = false;
            this.dom.btnScanWebsite.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-purple"></i> Scan`;
        }
    }

    // AI Target Audience Identification Controller
    async handleAudienceFind() {
        const description = document.getElementById("biz-desc").value.trim();
        if (!description) {
            alert("Please describe your business first, or Scan Website to generate one.");
            return;
        }

        this.dom.btnFindAudience.disabled = true;
        this.dom.btnFindAudience.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Finding...`;

        try {
            const parts = description.split("Core Offers:\n");
            const desc = parts[0].trim();
            const offers = parts[1] ? parts[1].trim() : "";

            const response = await fetch('/api/audience', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description: desc, offers })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Audience lookup failed");
            }

            const data = await response.json();
            document.getElementById("biz-audience").value = data.audience;
            this.appendConsoleLine('system', `Target audience discovery complete. Identified groups: ${data.audience}`);

        } catch (error) {
            console.error("Audience finding failed:", error);
            alert(`Failed to identify target audience: ${error.message}`);
        } finally {
            this.dom.btnFindAudience.disabled = false;
            this.dom.btnFindAudience.innerHTML = `<i class="fa-solid fa-magnifying-glass-chart text-cyan"></i> Find`;
        }
    }

    // AI Competitors Identification Controller
    async handleCompetitorsFind() {
        const description = document.getElementById("biz-desc").value.trim();
        if (!description) {
            alert("Please describe your business first, or Scan Website to generate one.");
            return;
        }

        this.dom.btnFindCompetitors.disabled = true;
        this.dom.btnFindCompetitors.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Discovering...`;

        try {
            const parts = description.split("Core Offers:\n");
            const desc = parts[0].trim();
            const offers = parts[1] ? parts[1].trim() : "";

            const response = await fetch('/api/competitors', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description: desc, offers })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Competitor lookup failed");
            }

            const data = await response.json();
            const discoveredCompetitors = this.parseCompetitorDomains(data.competitors);
            this.storeCompetitorProfiles(data.competitorProfiles || []);
            this.state.competitorUrls = discoveredCompetitors;
            this.renderCompetitorList();
            this.syncCompetitorHiddenInput();
            this.saveState();
            this.appendConsoleLine('system', `Competitor discovery complete. Identified competitor domains: ${data.competitors}`);

        } catch (error) {
            console.error("Competitor finding failed:", error);
            alert(`Failed to identify competitors: ${error.message}`);
        } finally {
            this.dom.btnFindCompetitors.disabled = false;
            this.dom.btnFindCompetitors.innerHTML = `<i class="fa-solid fa-users-viewfinder text-orange"></i> Auto-Discover`;
        }
    }

    // ── Competitor List Management ──────────────────────────────────────
    
    normalizeCompetitorDomain(value) {
        let domain = String(value || '').trim();
        if (!domain) return "";
        domain = domain.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();
        return domain;
    }

    parseCompetitorDomains(value) {
        return String(value || '')
            .split(',')
            .map(domain => this.normalizeCompetitorDomain(domain))
            .filter(Boolean);
    }

    getSwotValueFromScan(data = {}) {
        return data.swotProfile ||
            data.swot_profile ||
            data.swotAnalysis ||
            data.swot_analysis ||
            data.SWOT ||
            data.SWOTAnalysis ||
            data.businessAnalysis ||
            (data.analysis && (data.analysis.swot || data.analysis.swotProfile)) ||
            (data.report && (data.report.swot || data.report.swotProfile)) ||
            "";
    }

    getFirstSwotField(source, keys = []) {
        if (!source || typeof source !== 'object') return '';
        for (const key of keys) {
            if (source[key]) return source[key];
        }
        return '';
    }

    stringifySwotSection(body) {
        if (!body) return '';
        if (Array.isArray(body)) return body.map(item => String(item).trim()).filter(Boolean).join('; ');
        if (typeof body === 'object') return Object.values(body).map(item => String(item).trim()).filter(Boolean).join('; ');
        return String(body).trim();
    }

    normalizeSwotText(value, fallbackReport = '', context = {}) {
        if (typeof value === 'string' && value.trim()) return value.trim();
        if (value && typeof value === 'object') {
            const nested = this.getFirstSwotField(value, [
                'swotProfile',
                'swot_profile',
                'swotAnalysis',
                'swot_analysis',
                'SWOT',
                'SWOTAnalysis',
                'businessAnalysis'
            ]);
            if (nested && nested !== value) {
                const normalizedNested = this.normalizeSwotText(nested, fallbackReport, context);
                if (normalizedNested) return normalizedNested;
            }

            const sections = [
                ['Strengths', this.getFirstSwotField(value, ['strengths', 'Strengths', 'strength', 'Strength', 'advantages', 'competitiveAdvantages', 'pros'])],
                ['Weaknesses', this.getFirstSwotField(value, ['weaknesses', 'Weaknesses', 'weakness', 'Weakness', 'gaps', 'limitations', 'cons'])],
                ['Opportunities', this.getFirstSwotField(value, ['opportunities', 'Opportunities', 'opportunity', 'Opportunity', 'growthOpportunities', 'openings'])],
                ['Threats', this.getFirstSwotField(value, ['threats', 'Threats', 'threat', 'Threat', 'risks', 'competitiveThreats'])]
            ].filter(([, body]) => body);

            if (sections.length) {
                return sections.map(([label, body]) => {
                    const text = this.stringifySwotSection(body);
                    return `${label}: ${text}`;
                }).join('\n\n');
            }
        }

        const report = String(fallbackReport || '').trim();
        const swotIndex = report.toLowerCase().indexOf('swot');
        if (swotIndex !== -1) return report.slice(swotIndex, swotIndex + 1600).trim();
        return this.buildFallbackSwotText(context);
    }

    buildFallbackSwotText(context = {}) {
        const businessName = context.businessName || document.getElementById("biz-name")?.value || "This business";
        const description = String(context.description || '').trim();
        const offers = String(context.offers || '').replace(/\n+/g, '; ').trim();
        const valueProposition = String(context.valueProposition || '').trim();
        const competitorProfiles = Array.isArray(context.competitorProfiles) ? context.competitorProfiles : [];
        const competitorStrengths = competitorProfiles
            .map(profile => `${profile.name || profile.domain}: ${profile.strengths || profile.summary || ''}`.trim())
            .filter(text => text.length > 12)
            .slice(0, 3)
            .join(' | ');

        return [
            `Strengths: ${businessName} appears strongest around ${valueProposition || description || 'its core offer and market positioning'}. The scanned offers point to ${offers || 'a focused product/service mix'} that can guide ads, social posts, and client replies.`,
            `Weaknesses: The public scan should be reviewed for proof depth, pricing clarity, comparison pages, demos, case studies, and trust signals. Any missing specifics can make campaigns less convincing when prospects compare alternatives.`,
            `Opportunities: ${businessName} can turn the company profile, competitor gaps, and customer pain points into stronger landing-page copy, comparison content, segmented ads, and repeatable email/social angles.`,
            `Threats: Competitors may have stronger brand recognition, broader feature pages, more social proof, or clearer category positioning. ${competitorStrengths ? `Notable competitor strengths found: ${competitorStrengths}.` : 'Keep monitoring competitor messaging and social channels so campaigns stay current.'}`
        ].join('\n\n');
    }

    storeCompetitorProfiles(profiles = []) {
        if (!Array.isArray(profiles)) return;
        this.state.competitorProfiles = this.state.competitorProfiles || {};
        profiles.forEach(profile => {
            const domain = this.normalizeCompetitorDomain(profile.domain || profile.website || profile.name || '');
            if (!domain) return;
            this.state.competitorProfiles[domain] = {
                ...profile,
                domain,
                socialLinks: profile.socialLinks || {}
            };
        });
    }

    async researchCompetitorProfile(domain) {
        const cleanDomain = this.normalizeCompetitorDomain(domain);
        if (!cleanDomain) return;

        const description = document.getElementById("biz-desc").value.trim();
        const parts = description.split("Core Offers:\n");
        const desc = parts[0].trim();
        const offers = parts[1] ? parts[1].trim() : "";

        try {
            const response = await fetch('/api/competitor-profile', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    domain: cleanDomain,
                    businessName: document.getElementById("biz-name").value.trim(),
                    description: desc,
                    offers
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Competitor profile lookup failed");
            }

            const data = await response.json();
            this.storeCompetitorProfiles([data.competitorProfile]);
            this.renderCompetitorList();
            this.saveState();
            this.appendConsoleLine('system', `Competitor profile enriched for ${cleanDomain}.`);
        } catch (error) {
            console.error("Competitor profile research failed:", error);
            const existing = this.state.competitorProfiles[cleanDomain] || { domain: cleanDomain, name: cleanDomain, socialLinks: {} };
            existing.summary = existing.summary && !existing.summary.includes('Researching')
                ? existing.summary
                : 'Added to the competitor list. AI profile research did not complete yet; try Auto-Discover to enrich it later.';
            this.state.competitorProfiles[cleanDomain] = existing;
            this.renderCompetitorList();
            this.saveState();
        }
    }

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    getStrategicContext() {
        const competitorSummaries = this.state.competitorUrls
            .map(domain => {
                const cleanDomain = this.normalizeCompetitorDomain(domain);
                const profile = (this.state.competitorProfiles || {})[cleanDomain] || {};
                const parts = [
                    cleanDomain,
                    profile.summary,
                    profile.strengths ? `Strengths: ${profile.strengths}` : '',
                    profile.differentiationAgainstCompany ? `Positioning: ${profile.differentiationAgainstCompany}` : ''
                ].filter(Boolean);
                return parts.join(' - ');
            })
            .filter(Boolean)
            .join('\n');

        return [
            this.state.agencyGoal ? `User's ad agency goal:\n${this.state.agencyGoal}` : '',
            this.state.coreMessage ? `Core message to reinforce:\n${this.state.coreMessage}` : '',
            this.state.extraDetails ? `Additional user-provided details and constraints:\n${this.state.extraDetails}` : '',
            this.state.bizSwot ? `SWOT profile:\n${this.state.bizSwot}` : '',
            this.state.businessReport ? `Business intelligence report:\n${this.state.businessReport}` : '',
            competitorSummaries ? `Competitor intelligence:\n${competitorSummaries}` : ''
        ].filter(Boolean).join('\n\n');
    }

    renderCompetitorList() {
        const list = this.dom.competitorList;
        list.innerHTML = '';
        
        this.state.competitorUrls.forEach((domain, index) => {
            const cleanDomain = this.normalizeCompetitorDomain(domain);
            const profile = (this.state.competitorProfiles || {})[cleanDomain] || {};
            const socialLinks = profile.socialLinks || {};
            const socialHtml = Object.entries(socialLinks)
                .filter(([, href]) => href)
                .map(([platform, href]) => `<a href="${this.escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="competitor-social-link">${this.escapeHtml(platform)}</a>`)
                .join('');
            const summaryHtml = profile.summary || profile.strengths || profile.differentiationAgainstCompany
                ? `<div class="competitor-profile">
                        ${profile.summary ? `<p>${this.escapeHtml(profile.summary)}</p>` : ''}
                        ${profile.strengths ? `<small><strong>Strengths:</strong> ${this.escapeHtml(profile.strengths)}</small>` : ''}
                        ${profile.differentiationAgainstCompany ? `<small><strong>Positioning:</strong> ${this.escapeHtml(profile.differentiationAgainstCompany)}</small>` : ''}
                        ${socialHtml ? `<div class="competitor-social-links">${socialHtml}</div>` : ''}
                   </div>`
                : '';
            const tag = document.createElement('div');
            tag.className = 'competitor-tag';
            tag.setAttribute('draggable', 'true');
            tag.setAttribute('data-index', index);
            tag.innerHTML = `
                <span class="drag-handle"><i class="fa-solid fa-grip-vertical"></i></span>
                <span class="competitor-rank">${index + 1}</span>
                <span class="competitor-card-body">
                    <span class="competitor-domain">${this.escapeHtml(cleanDomain)}</span>
                    ${summaryHtml}
                </span>
                <button type="button" class="btn-remove-competitor" data-domain="${this.escapeHtml(cleanDomain)}"><i class="fa-solid fa-xmark"></i></button>
            `;
            
            // Drag events
            tag.addEventListener('dragstart', (e) => {
                tag.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index.toString());
            });
            tag.addEventListener('dragend', () => {
                tag.classList.remove('dragging');
                list.classList.remove('drag-over');
            });
            tag.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const dragging = list.querySelector('.dragging');
                if (dragging && dragging !== tag) {
                    const rect = tag.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        list.insertBefore(dragging, tag);
                    } else {
                        list.insertBefore(dragging, tag.nextSibling);
                    }
                }
            });
            tag.addEventListener('drop', (e) => {
                e.preventDefault();
                list.classList.remove('drag-over');
                // Rebuild array from current DOM order
                this.rebuildCompetitorArrayFromDOM();
            });
            
            // Remove button
            tag.querySelector('.btn-remove-competitor').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeCompetitor(cleanDomain);
            });
            
            list.appendChild(tag);
        });
        
        // List-level drag events
        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            list.classList.add('drag-over');
        });
        list.addEventListener('dragleave', (e) => {
            if (!list.contains(e.relatedTarget)) {
                list.classList.remove('drag-over');
            }
        });
        list.addEventListener('drop', (e) => {
            e.preventDefault();
            list.classList.remove('drag-over');
            this.rebuildCompetitorArrayFromDOM();
        });
    }
    
    rebuildCompetitorArrayFromDOM() {
        const tags = this.dom.competitorList.querySelectorAll('.competitor-tag');
        const newOrder = [];
        tags.forEach(tag => {
            const domain = tag.querySelector('.competitor-domain').textContent;
            newOrder.push(this.normalizeCompetitorDomain(domain));
        });
        this.state.competitorUrls = newOrder;
        
        // Update rank badges
        tags.forEach((tag, i) => {
            tag.querySelector('.competitor-rank').textContent = i + 1;
            tag.setAttribute('data-index', i);
        });
        
        this.syncCompetitorHiddenInput();
    }
    
    async addCompetitorFromInput() {
        const input = this.dom.competitorAddInput;
        let domain = input.value.trim();
        if (!domain) return;
        
        // Clean up — remove protocol, trailing slashes
        domain = this.normalizeCompetitorDomain(domain);
        
        // Check for duplicates
        if (this.state.competitorUrls.some(existing => this.normalizeCompetitorDomain(existing) === domain)) {
            if (!this.state.competitorProfiles[domain] || !this.state.competitorProfiles[domain].summary) {
                this.researchCompetitorProfile(domain);
            }
            input.value = '';
            return;
        }
        
        this.state.competitorUrls.push(domain);
        this.state.competitorProfiles[domain] = {
            domain,
            name: domain,
            summary: 'Researching competitor profile, positioning, and social links...',
            socialLinks: {}
        };
        input.value = '';
        this.renderCompetitorList();
        this.syncCompetitorHiddenInput();
        this.saveState();
        this.researchCompetitorProfile(domain);
    }
    
    removeCompetitor(domain) {
        const cleanDomain = this.normalizeCompetitorDomain(domain);
        this.state.competitorUrls = this.state.competitorUrls.filter(c => this.normalizeCompetitorDomain(c) !== cleanDomain);
        this.renderCompetitorList();
        this.syncCompetitorHiddenInput();
    }
    
    getCompetitorArray() {
        return [...this.state.competitorUrls];
    }
    
    syncCompetitorHiddenInput() {
        // Keep the hidden input in sync for any code that reads it directly
        this.dom.competitorUrlsInput.value = this.state.competitorUrls.join(', ');
    }
    
    // ── Agent Toggle Handler ────────────────────────────────────────────
    
    async handleAgentToggle(agentKey, isEnabled) {
        this.state.enabledAgents[agentKey] = isEnabled === true;
        this.syncAgentToggleUI(agentKey);
        
        // Persist immediately
        this.saveState();

        if (agentKey === 'leadIntelligence') {
            await this.saveLeadIntelligenceEnabled(isEnabled === true);
        }
        
        // Restart local automation timers with updated agent config.
        this.stopAutomationTimers();
        this.startAutomationTimers();
        
        const agentNames = { ad: 'Ad Strategy', content: 'Content Creator', support: '24/7 Support', sales: 'Sales CRM', leadIntelligence: 'Lead Intelligence' };
        this.appendConsoleLine('system', `Agent ${agentNames[agentKey]} ${isEnabled ? 'ACTIVATED' : 'DEACTIVATED'}.`);
    }

    // ── Autopilot Workflow Training & Execution Methods ──────────────────

    populateCampaignSelectDropdowns() {
        const firstCampaignSelect = this.dom.crmFirstCampaign;
        const secondCampaignSelect = this.dom.crmSecondCampaign;
        const thirdCampaignSelect = this.dom.crmThirdCampaign;
        if (!firstCampaignSelect || !secondCampaignSelect || !thirdCampaignSelect) return;

        // Clear existing options except default
        firstCampaignSelect.innerHTML = '<option value="">-- No Active Campaign --</option>';
        secondCampaignSelect.innerHTML = '<option value="">-- No Active Campaign --</option>';
        thirdCampaignSelect.innerHTML = '<option value="">-- No Active Campaign --</option>';

        // Get list of campaigns
        const campaigns = this.state.campaignsList || [];
        campaigns.forEach(c => {
            const opt1 = document.createElement("option");
            opt1.value = c.id;
            opt1.textContent = c.name;
            firstCampaignSelect.appendChild(opt1);

            const opt2 = document.createElement("option");
            opt2.value = c.id;
            opt2.textContent = c.name;
            secondCampaignSelect.appendChild(opt2);

            const opt3 = document.createElement("option");
            opt3.value = c.id;
            opt3.textContent = c.name;
            thirdCampaignSelect.appendChild(opt3);
        });

        // Set selected values
        if (this.state.crmAutopilot.firstCampaignId) {
            firstCampaignSelect.value = this.state.crmAutopilot.firstCampaignId;
        }
        if (this.state.crmAutopilot.secondCampaignId) {
            secondCampaignSelect.value = this.state.crmAutopilot.secondCampaignId;
        }
        if (this.state.crmAutopilot.thirdCampaignId) {
            thirdCampaignSelect.value = this.state.crmAutopilot.thirdCampaignId;
        }
    }

    getCampaignNameById(id) {
        if (!id) return 'Not selected';
        const campaign = (this.state.campaignsList || []).find(c => String(c.id) === String(id));
        return campaign ? campaign.name : 'Not active';
    }

    renderCampaignWorkflowSummary() {
        const container = this.dom.crmCampaignWorkflowSummary;
        if (!container) return;

        const counts = this.state.leadStageCounts || {};
        const scraped = counts.Scraped || 0;
        const emailed = counts.Emailed || 0;
        const conversations = counts['Two-Way Conversation'] || 0;
        const needsHuman = counts['Needs Human Action'] || 0;
        const quarantined = counts.Quarantined || 0;
        const hot = counts['Hot Lead'] || 0;
        const firstName = this.getCampaignNameById(this.state.crmAutopilot.firstCampaignId);
        const secondName = this.getCampaignNameById(this.state.crmAutopilot.secondCampaignId);
        const thirdName = this.getCampaignNameById(this.state.crmAutopilot.thirdCampaignId);
        const verificationMode = this.state.crmAutopilot.autoApproveCampaigns ? 'Auto-approve enabled: new campaigns send Step 1 immediately to Scraped leads.' : 'Manual approval: campaigns wait in the Verification Queue until you approve Step 1.';
        const pauseMode = this.state.crmAutopilot.autoPauseOnReply !== false ? 'Replies pause the campaign and mark the lead Hot Lead.' : 'Replies mark Hot Lead, but auto-pause is off.';

        container.innerHTML = `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:8px; padding:14px;">
                <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Audience Now</div>
                <div style="font-size:1.6rem; font-weight:800; color:var(--accent); margin-top:6px;">${scraped}</div>
                <div style="font-size:0.82rem; color:var(--text-secondary);">Scraped leads eligible for the next Step 1 send.</div>
            </div>
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:8px; padding:14px;">
                <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Current Pipeline</div>
                <div style="font-size:0.85rem; color:var(--text-primary); margin-top:8px;">${emailed} Emailed · ${conversations} Two-Way · ${needsHuman} Human · ${quarantined} Quarantined</div>
                <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:6px;">Only Scraped leads are selected for a new campaign launch.</div>
            </div>
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:8px; padding:14px;">
                <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Campaign Chain</div>
                <div style="font-size:0.82rem; color:var(--text-primary); margin-top:8px;">1. ${firstName}</div>
                <div style="font-size:0.82rem; color:var(--text-primary);">2. ${secondName}</div>
                <div style="font-size:0.82rem; color:var(--text-primary);">3. ${thirdName}</div>
            </div>
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:8px; padding:14px;">
                <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Launch Rule</div>
                <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:8px;">${verificationMode}</div>
                <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:6px;">${pauseMode}</div>
                <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:6px;">Auto-approve: ${this.state.crmAutopilot.autoApproveCampaigns ? 'On' : 'Off'} · Auto-enroll: ${this.state.crmAutopilot.autoEnrollScrapedLeads ? 'On' : 'Off'} · Auto-follow-up: ${this.state.crmAutopilot.autoAdvanceCampaigns ? 'On' : 'Off'}</div>
            </div>
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:8px; padding:14px;">
                <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Daily Scrape</div>
                <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:8px;">${this.state.crmAutopilot.dailyScrapeEnabled ? 'On' : 'Off'}${this.state.crmAutopilot.dailyScrapeQuery ? ` · ${this.state.crmAutopilot.dailyScrapeQuery}` : ''}</div>
                <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:6px;">Last run: ${this.state.crmAutopilot.lastDailyScrapeDate || 'not yet'}</div>
            </div>
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:8px; padding:14px;">
                <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Tracking Rule</div>
                <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:8px;">Replies/unsubscribes are tracked through Mailgun webhooks.</div>
                <div style="font-size:0.82rem; color:var(--orange); margin-top:6px;">Open/click/signup routing is not connected yet.</div>
            </div>
        `;
    }

    getNextCampaignInConfiguredChain(currentCampaignId) {
        const chain = [
            this.state.crmAutopilot.firstCampaignId,
            this.state.crmAutopilot.secondCampaignId,
            this.state.crmAutopilot.thirdCampaignId
        ].filter(Boolean);
        const currentIndex = chain.findIndex(id => String(id) === String(currentCampaignId));
        return currentIndex >= 0 ? chain[currentIndex + 1] || null : null;
    }

    renderCampaignRoleBadges(campaignId) {
        const badges = [];
        if (String(this.state.crmAutopilot.firstCampaignId) === String(campaignId)) badges.push('Campaign 1');
        if (String(this.state.crmAutopilot.secondCampaignId) === String(campaignId)) badges.push('Campaign 2');
        if (String(this.state.crmAutopilot.thirdCampaignId) === String(campaignId)) badges.push('Campaign 3');
        return badges.map(label => `<span class="badge">${label}</span>`).join(' ');
    }

    renderDncList() {
        const body = this.dom.crmDncListBody;
        const countBadge = this.dom.crmDncCount;
        if (!body || !countBadge) return;

        const list = this.state.crmAutopilot.dncList || [];
        countBadge.textContent = `${list.length} Blacklisted`;

        if (list.length === 0) {
            body.innerHTML = `
                <tr>
                    <td colspan="2" style="padding:20px; text-align:center; color:var(--text-secondary); font-style:italic;">No emails on the blacklist.</td>
                </tr>`;
            return;
        }

        body.innerHTML = list.map(email => `
            <tr>
                <td style="padding:10px; font-family:var(--font-mono); font-size:0.8rem;">${email}</td>
                <td style="padding:10px; text-align:center; width:70px;">
                    <span class="badge warning-badge" title="DNC entries are permanent safeguards">Permanent</span>
                </td>
            </tr>
        `).join("");
    }

    async addDncFromInput() {
        const input = this.dom.crmDncAddInput;
        const email = input.value.trim().toLowerCase();
        if (!email) return;

        try {
            const response = await fetch('/api/dnc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, reason: 'Manual CRM blacklist' })
            });
            if (!response.ok) throw new Error('Could not add DNC email');

            await this.loadCrmStateFromServer();
            this.renderDncList();
            this.appendConsoleLine('system', `Added ${email} to DNC blacklist. Retroactive protection applied.`);
        } catch (error) {
            alert(`Failed to add DNC email: ${error.message}`);
        }
        input.value = '';
    }

    removeDnc(email) {
        alert(`${email} is on the permanent DNC list. Server-side removal is disabled by default.`);
    }

    // CRM follow-ups are processed by the backend pipeline worker.
    runCrmDripTick() {
        return;
    }

    simulateLeadUnsubscribe(lead) {
        if (lead.stage === "DNC") return;

        this.appendConsoleLine('system', `Lead ${lead.name} clicked unsubscribe or replied: "Please remove me from your list."`);
        
        lead.stage = "DNC";
        lead.currentCampaignId = null;
        lead.currentCampaignStep = null;
        if (!lead.history) lead.history = [];
        lead.history.push({
            sender: "lead",
            time: "Just Now",
            text: "Unsubscribe me from all communications."
        });
        lead.history.push({
            sender: "agent-action",
            time: "Just Now",
            text: "Lead unsubscribed. Permanent DNC block active."
        });

        if (!this.state.crmAutopilot.dncList.includes(lead.email.toLowerCase())) {
            this.state.crmAutopilot.dncList.push(lead.email.toLowerCase());
        }

        this.saveState();
        this.renderLeadsList();
        this.renderDncList();
        if (this.state.selectedLeadIndex !== null && this.state.leads[this.state.selectedLeadIndex].id === lead.id) {
            this.selectLead(this.state.selectedLeadIndex);
        }
        this.appendConsoleLine('agent-sales', `Sales CRM Agent processed unsubscribe for ${lead.name}. Blacklisted: ${lead.email}`);
    }

    runContentSchedulerTick() {
        // Skip if Content agent or autopilot is disabled
        if (!this.state.enabledAgents.content || !this.state.contentAutopilot.enabled) return;

        if (!this.state.contentAutopilot.lastIntervalIds) {
            this.state.contentAutopilot.lastIntervalIds = {};
        }
        if (!this.state.contentAutopilot.intervalCounts) {
            this.state.contentAutopilot.intervalCounts = {};
        }

        const platforms = ['facebook', 'instagram', 'linkedin', 'twitter', 'reddit', 'youtube'];
        let stateChanged = false;

        platforms.forEach(platform => {
            const freq = this.state.contentAutopilot.frequencies[platform] || { enabled: false, value: 0, interval: 'day' };
            if (!freq.enabled || freq.value <= 0) return;

            // Day = 20s (20000ms), Week = 80s (80000ms)
            const intervalDuration = freq.interval === 'week' ? 80000 : 20000;
            const currentIntervalId = Math.floor(Date.now() / intervalDuration);

            const lastIntervalId = this.state.contentAutopilot.lastIntervalIds[platform] || 0;
            if (currentIntervalId !== lastIntervalId) {
                // A new day/week has started! Reset counts for this platform
                this.state.contentAutopilot.lastIntervalIds[platform] = currentIntervalId;
                this.state.contentAutopilot.intervalCounts[platform] = 0;
                stateChanged = true;
            }

            const currentCount = this.state.contentAutopilot.intervalCounts[platform] || 0;
            if (currentCount < freq.value) {
                // Generate a post for this platform
                this.state.contentAutopilot.intervalCounts[platform] = currentCount + 1;
                this.generateAutopilotPost(platform);
                stateChanged = true;
            }
        });

        if (stateChanged) {
            this.saveState();
        }
    }

    async generateAutopilotPost(platform) {
        // Topics list
        const topics = [
            "Why manual transaction coordination leads to closing file errors.",
            "How real estate agents waste 10 hours a week chasing signatures.",
            "The importance of automated compliance checks in real estate brokerages.",
            "Streamlining realtor client communication to secure deal files.",
            "Why administrative burnout is costing brokerages their top-producing agents.",
            "Closing real estate deals faster with zero manual checklists."
        ];
        const topic = topics[Math.floor(Math.random() * topics.length)];

        this.appendConsoleLine('agent-content', `Autopilot scheduling posting check for ${platform} about: "${topic.substring(0,40)}..."`);

        let platformSpec = "LinkedIn or Twitter style";
        let platformRule = "Keep it under 280 characters.";
        
        if (platform === "facebook") {
            platformSpec = "engaging Facebook style, encouraging community discussion and comments";
            platformRule = "Include an engaging question at the end. Use a warm, friendly tone.";
        } else if (platform === "instagram") {
            platformSpec = "aesthetic Instagram style, using visual imagery words and emojis";
            platformRule = "Keep it very short and punchy (maximum 2-3 short sentences, under 150 characters total). Focus on visual impact, use emojis, and include 5-8 hashtags at the end. Do NOT write long paragraphs. Make it easy to read on a mobile screen.";
        } else if (platform === "twitter") {
            platformSpec = "X (Twitter) tweet format";
            platformRule = "Strictly keep it under 280 characters. Make the hook extremely punchy.";
        } else if (platform === "reddit") {
            platformSpec = "informative Reddit self-post text, formatted with Markdown paragraphs and bullet points";
            platformRule = "Use a casual, authentic community-driven tone. No salesy hype. Start with a catchy Title line at the top.";
        } else if (platform === "linkedin") {
            platformSpec = "professional, value-focused LinkedIn style with good line spacing";
            platformRule = "Focus on business value, productivity, or industry lessons learned.";
        } else if (platform === "youtube") {
            platformSpec = "YouTube Video Concept, Script Intro, and Description text";
            platformRule = "Output a suggested Title, a 2-sentence script hook, and a short description with hashtags.";
        } else if (platform === "reels") {
            platformSpec = "detailed Instagram Reels template and storyboard, including a beat-sync guide and text-on-screen hook overlays";
            platformRule = `Structure the response EXACTLY in this Markdown layout:

### 🎵 Suggested Audio Vibe
- **Audio Track Style:** [Describe energetic/chill/transition trending audio search keywords]
- **Ideal Music Hook:** [Describe audio drop timing]

### 🎬 Text-on-Screen (First 3s Hook)
- **Overlay Text:** "[Make it a punchy pain point or curiosity statement]"

### 📊 Storyboard & Beat Sync Guide
| Time (seconds) | Visual Video Scene Description | Beat / Action Cue |
| --- | --- | --- |
| **0.0s - 1.5s** | [Visual prompt for recording or stocking] | [Sync action / audio cue] |
| **1.5s - 3.0s** | [Visual prompt] | [Sync action] |
| **3.0s - 5.0s** | [Visual prompt] | [Sync action] |
| **5.0s - 8.0s** | [Visual prompt for CTA / Screen record] | [End card CTA] |

### 🎙️ Narrator Voiceover Script
"[Write a conversational, punchy 2-3 sentence speech/script that matches the visual duration]"`;
        }

const prompt = `You are a social media copywriter for '${this.state.bizName}'.
Description: ${this.state.bizDesc}
Target Audience: ${this.state.bizAudience}
Strategic context:
${this.getStrategicContext() || 'No deep research profile has been generated yet.'}

Draft a social media post optimized specifically for the ${platformSpec} platform about: "${topic}".
Rule: ${platformRule}
Only respond with the post text. No other commentary or wrapping.`;

        let postText = "";
        try {
            if (this.state.serverConfig && this.state.serverConfig.geminiConfigured) {
                postText = await this.queryGeminiAPI(prompt);
            } else {
                throw new Error("Gemini is not configured on the server.");
            }
        } catch (apiErr) {
            this.appendConsoleLine('system', `Autopilot post generation skipped for ${platform}: ${apiErr.message}`);
            return;
            if (platform === "reels") {
                postText = `### 🎵 Suggested Audio Vibe
- **Audio Track Style:** Upbeat energetic transition beat (Search: 'Austin Millz Breath' on Reels)
- **Ideal Music Hook:** Transition drops at 1.5s mark

### 🎬 Text-on-Screen (First 3s Hook)
- **Overlay Text:** "Stop wasting 10 hours a week chasing signatures!"

### 📊 Storyboard & Beat Sync Guide
| Time (seconds) | Visual Video Scene Description | Beat / Action Cue |
| --- | --- | --- |
| **0.0s - 1.5s** | Realtor sitting at desk pulling their hair out looking at paper folders. | Beat builds up, text overlay flashes. |
| **1.5s - 3.0s** | Screen transition: phone screen showing ${this.state.bizName || 'the client'} workflow dashboard solving the problem instantly. | Bass drop, smooth zoom. |
| **3.0s - 5.0s** | Realtor smiling, walking out of office holding car keys. | Energetic pan. |
| **5.0s - 8.0s** | Outro slide with a simple call to action for ${this.state.bizName || 'the client'}. | CTA text overlay. |

### 🎙️ Narrator Voiceover Script
"You did not build your business to get buried in repetitive admin. ${this.state.bizName || 'Our team'} helps take the busywork off your plate so you can focus on clients, revenue, and growth. Hit the link in bio to take the next step."`;
            } else {
                postText = `[Autopilot ${platform.toUpperCase()}] Autonomously optimizing ${this.state.bizName} workflow. Save hours on file coordination! #Automation #${platform.toUpperCase()}`;
            }
        }

        let mediaUrl = null;
        if (this.state.contentAutopilot.autoAttachMedia !== false) {
            mediaUrl = await this.createGeneratedPostMedia(postText, platform, topic);
        }

        const requestedPublishMode = this.state.contentAutopilot.publishMode || 'draft';
        const newPost = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            platform,
            time: "Draft",
            body: postText,
            mediaUrl,
            impressions: 0,
            likes: 0,
            comments: 0
        };

        if (requestedPublishMode === 'publish') {
            this.state.socialPosts.unshift(newPost);
            this.renderSocialPostsGrid();
            this.appendConsoleLine('agent-content', `Autopilot generated a ${platform} draft. Auto-publish requires a connected publisher workflow.`);
        } else {
            this.state.socialPosts.unshift(newPost);
            this.renderSocialPostsGrid();
            this.appendConsoleLine('agent-content', `Autopilot drafted post for ${platform} and saved to queue.`);
        }
    }

    async handleVideoInspect() {
        const url = this.dom.downloaderUrlInput.value.trim();
        if (!url) {
            alert("Please paste a valid video URL first.");
            return;
        }

        this.dom.btnInspectVideo.disabled = true;
        this.dom.btnInspectVideo.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Inspecting...`;
        this.appendConsoleLine('system', `Inspecting video metadata for URL: "${url.substring(0, 45)}..."`);

        try {
            const response = await fetch('/api/inspect-video', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to inspect video");
            }
            const data = await response.json();
            
            // Cache in memory
            this.inspectedVideo = data;

            // Show card
            this.dom.downloaderMetadataCard.style.display = "flex";
            this.dom.downloaderThumb.src = data.thumbnail || "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=200";
            this.dom.downloaderTitle.textContent = data.title;
            this.dom.downloaderAuthor.innerHTML = `<i class="fa-solid fa-user"></i> ${data.uploader}`;
            
            // Format duration (s to mm:ss)
            const minutes = Math.floor(data.duration / 60);
            const seconds = data.duration % 60;
            this.dom.downloaderDuration.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;

            // Hide processing or player or transcripts from previous inspects
            this.dom.downloaderPlayerBox.style.display = "none";
            this.dom.downloaderTranscriptBox.style.display = "none";
            this.dom.downloaderProcessing.style.display = "none";

            this.appendConsoleLine('agent-content', `Inspected: "${data.title}" by ${data.uploader}. Ready for ingestion.`);
        } catch (error) {
            console.error("Video inspection failed:", error);
            alert("Inspection failed: " + error.message);
        } finally {
            this.dom.btnInspectVideo.disabled = false;
            this.dom.btnInspectVideo.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Inspect Asset`;
        }
    }

    async handleVideoDownload(type) {
        if (!this.inspectedVideo) {
            alert("Please inspect a video URL first.");
            return;
        }

        const url = this.inspectedVideo.url;
        const endpoint = type === 'audio' ? '/api/extract-audio' : '/api/download-video';
        
        // Show spinner
        this.dom.downloaderProcessing.style.display = "flex";
        this.dom.downloaderProcessingText.textContent = type === 'audio' 
            ? "Extracting raw audio stream via yt-dlp..." 
            : "Downloading MP4 video file via yt-dlp (this may take up to a minute)...";
        
        this.dom.downloaderPlayerBox.style.display = "none";
        this.setDownloaderButtonsDisabled(true);

        this.appendConsoleLine('system', `yt-dlp worker running: Ingesting ${type} format for video: "${this.inspectedVideo.title.substring(0,35)}..."`);

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Media download failed");
            }
            const data = await response.json();

            // Render Player
            this.dom.downloaderProcessing.style.display = "none";
            this.dom.downloaderPlayerBox.style.display = "block";
            
            if (type === 'audio') {
                this.dom.downloaderPlayerContainer.innerHTML = `
                    <div style="padding:15px; text-align:center;">
                        <audio src="${data.downloadUrl}" controls style="width:280px; margin-bottom:10px;"></audio>
                        <br>
                        <a href="${data.downloadUrl}" download class="btn btn-outline" style="font-size:0.75rem; display:inline-block; padding:4px 8px; border-color:var(--purple); color:var(--purple);">
                            <i class="fa-solid fa-download"></i> Save Audio File
                        </a>
                    </div>
                `;
            } else {
                this.dom.downloaderPlayerContainer.innerHTML = `
                    <video src="${data.downloadUrl}" controls style="max-width:100%; max-height:280px; border-radius:6px; display:block;"></video>
                    <div style="padding:10px 0; text-align:center;">
                        <a href="${data.downloadUrl}" download class="btn btn-outline" style="font-size:0.75rem; display:inline-block; padding:4px 8px; border-color:var(--orange); color:var(--orange);">
                            <i class="fa-solid fa-download"></i> Save Video File
                        </a>
                    </div>
                `;
            }

            this.appendConsoleLine('agent-content', `yt-dlp Ingestion Success: ${type} cached locally at: ${data.downloadUrl}`);
        } catch (error) {
            console.error("Media Ingestion failed:", error);
            this.dom.downloaderProcessing.style.display = "none";
            alert("Ingestion failed: " + error.message);
        } finally {
            this.setDownloaderButtonsDisabled(false);
        }
    }

    async handleTranscriptExtract() {
        if (!this.inspectedVideo) {
            alert("Please inspect a video URL first.");
            return;
        }

        const url = this.inspectedVideo.url;
        this.dom.downloaderProcessing.style.display = "flex";
        this.dom.downloaderProcessingText.textContent = "Downloading subtitles and parsing clean transcript (no download required)...";
        this.dom.downloaderTranscriptBox.style.display = "none";
        this.setDownloaderButtonsDisabled(true);

        this.appendConsoleLine('system', `AI Transcriber working: Fetching captions for "${this.inspectedVideo.title.substring(0,35)}..."`);

        try {
            const response = await fetch('/api/extract-transcript', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Transcript extraction failed");
            }
            const data = await response.json();

            this.dom.downloaderProcessing.style.display = "none";
            this.dom.downloaderTranscriptBox.style.display = "block";
            this.dom.downloaderTranscriptText.textContent = data.transcript;
            
            // Cache in memory for adaptation
            this.extractedTranscript = data.transcript;

            this.appendConsoleLine('agent-content', `Subtitles extracted successfully! Clean transcript generated (${data.transcript.split(" ").length} words).`);
        } catch (error) {
            console.error("Transcript failed:", error);
            this.dom.downloaderProcessing.style.display = "none";
            alert("Transcription failed: " + error.message);
        } finally {
            this.setDownloaderButtonsDisabled(false);
        }
    }

    setDownloaderButtonsDisabled(disabled) {
        this.dom.btnDownloadVideo.disabled = disabled;
        this.dom.btnExtractAudio.disabled = disabled;
        this.dom.btnExtractTranscript.disabled = disabled;
    }

    adaptTranscriptToPost() {
        if (!this.extractedTranscript) {
            alert("No transcript has been extracted yet.");
            return;
        }

        // Copy transcript to post creator topic box
        this.dom.contentTopicInput.value = `Summarize and adapt this video transcript: "${this.extractedTranscript.substring(0, 300)}..."`;
        
        // Click the drafts sub-tab to switch view
        const draftsTab = Array.from(this.dom.studioTabs).find(t => t.getAttribute("data-target") === "studio-drafts");
        if (draftsTab) draftsTab.click();

        this.appendConsoleLine('system', `Copied video transcript to Content drafts topic. Adjust checks and click 'Draft Social Post'.`);
        alert("Transcript copied to Drafts tab topic! You can now customize details and click 'Draft Social Post' to write your posts.");
    }



    async handleAdGeneration() {
        const topic = this.dom.adGenTopic.value.trim();
        if (!topic) return;

        this.dom.adGeneratorResults.style.display = "block";
        this.dom.adGeneratorResults.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; color:var(--text-secondary);">
                <i class="fa-solid fa-spinner fa-spin text-purple" style="font-size:1.25rem;"></i>
                <span>Gemini is generating ad variations for "${topic}"...</span>
            </div>
        `;

        const prompt = `You are a professional conversion copywriter for an ad agency. 
Your client is '${this.state.bizName}'. 
Description of their business: ${this.state.bizDesc}
Their target audience is: ${this.state.bizAudience}
Strategic context:
${this.getStrategicContext() || 'No deep research profile has been generated yet.'}
Write 3 variations of short-form ad copies focusing on: "${topic}".
Each variation should contain:
1. Headline (max 40 chars)
2. Primary Copy (Facebook/Meta format, engaging hook, max 200 chars)
3. Call To Action (e.g. Learn More, Book Demo)

Format your response in clean markdown or plain text with clear headings Option 1, Option 2, Option 3. Do not include markdown bold symbols (*).`;

        try {
            let resultText = "";
            if (this.state.serverConfig && this.state.serverConfig.geminiConfigured) {
                resultText = await this.queryGeminiAPI(prompt);
            } else {
                throw new Error("Gemini is not configured on the server.");
            }

            // Parse options for preview integration
            this.dom.adGeneratorResults.innerHTML = `
                <h4 style="margin-bottom:12px; color:var(--purple);"><i class="fa-solid fa-sparkles"></i> AI Generated Copy Options</h4>
                <div class="gen-options-container">
                    ${this.formatAdOptionsHTML(resultText)}
                </div>
            `;
            
            this.attachAdCopyPreviewListeners();

        } catch (error) {
            this.dom.adGeneratorResults.innerHTML = `
                <div class="alert alert-danger" style="color:var(--orange); background:rgba(255, 145, 0, 0.05); padding:12px; border-radius:8px; border:1px solid var(--orange);">
                    <i class="fa-solid fa-triangle-exclamation"></i> Error calling Gemini API: ${error.message}.
                </div>
            `;
        }
    }

    formatAdOptionsHTML(text) {
        // Simple parser to extract options
        const options = text.split(/Option \d+:?/i).filter(Boolean);
        if (options.length === 0) {
            return `<div class="gen-option-card"><div class="gen-option-text">${text}</div></div>`;
        }

        return options.map((opt, i) => {
            const lines = opt.trim().split("\n").filter(Boolean);
            let headline = "Ditch transaction admin";
            let body = opt.trim();
            let cta = "Learn More";

            lines.forEach(line => {
                if (line.toLowerCase().startsWith("headline:")) {
                    headline = line.replace(/headline:/i, "").trim();
                } else if (line.toLowerCase().startsWith("primary copy:")) {
                    body = line.replace(/primary copy:/i, "").trim();
                } else if (line.toLowerCase().startsWith("call to action:") || line.toLowerCase().startsWith("cta:")) {
                    cta = line.replace(/call to action:|cta:/i, "").trim();
                }
            });

            // Clean up lines if body was not specifically identified
            if (body === opt.trim()) {
                body = lines.filter(l => !l.toLowerCase().startsWith("headline:") && !l.toLowerCase().startsWith("call to action:") && !l.toLowerCase().startsWith("cta:")).join("\n");
            }

            return `
                <div class="gen-option-card">
                    <div class="gen-option-header">
                        <span>Option ${i+1}</span>
                        <button class="btn btn-sm btn-outline btn-use-copy" data-headline="${headline}" data-body="${body}" data-cta="${cta}">
                            Apply to Preview
                        </button>
                    </div>
                    <div class="gen-option-text">
                        <strong>Headline:</strong> ${headline}<br>
                        <strong>Copy:</strong> ${body}<br>
                        <strong>CTA:</strong> ${cta}
                    </div>
                </div>
            `;
        }).join("");
    }

    attachAdCopyPreviewListeners() {
        const buttons = this.dom.adGeneratorResults.querySelectorAll(".btn-use-copy");
        buttons.forEach(btn => {
            btn.addEventListener("click", () => {
                const headline = btn.getAttribute("data-headline");
                const body = btn.getAttribute("data-body");
                const cta = btn.getAttribute("data-cta");
                
                document.getElementById("preview-headline").innerText = headline;
                document.getElementById("preview-meta-body").innerText = body;
            document.querySelector(".btn-mock-action").innerText = cta;
                
                // Add alert notification
                this.appendConsoleLine('system', `Ad Copy Variant applied to preview: "${headline}"`);
            });
        });
    }

    async handleContentGeneration() {
        const topic = this.dom.contentTopicInput.value.trim();
        if (!topic) return;

        // Get selected platforms
        const checkedCheckboxes = Array.from(document.querySelectorAll('input[name="platform-target"]:checked')).map(cb => cb.value);
        if (checkedCheckboxes.length === 0) {
            alert("Please select at least one target platform checkbox below.");
            return;
        }

        this.dom.btnGenerateContent.disabled = true;
        this.dom.btnGenerateContent.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Drafting...`;

        try {
            this.appendConsoleLine('system', `AI Content Agent drafting posts for ${checkedCheckboxes.join(', ')}...`);

            // Generate posts in parallel
            await Promise.all(checkedCheckboxes.map(async (platform) => {
                let platformSpec = "LinkedIn or Twitter style";
                let platformRule = "Keep it under 280 characters.";
                
                if (platform === "facebook") {
                    platformSpec = "engaging Facebook style, encouraging community discussion and comments";
                    platformRule = "Include an engaging question at the end. Use a warm, friendly tone.";
                } else if (platform === "instagram") {
                    platformSpec = "aesthetic Instagram style, using visual imagery words and emojis";
                    platformRule = "Keep it very short and punchy (maximum 2-3 short sentences, under 150 characters total). Focus on visual impact, use emojis, and include 5-8 hashtags at the end. Do NOT write long paragraphs. Make it easy to read on a mobile screen.";
                } else if (platform === "twitter") {
                    platformSpec = "X (Twitter) tweet format";
                    platformRule = "Strictly keep it under 280 characters. Make the hook extremely punchy.";
                } else if (platform === "reddit") {
                    platformSpec = "informative Reddit self-post text, formatted with Markdown paragraphs and bullet points";
                    platformRule = "Use a casual, authentic community-driven tone. No salesy hype. Start with a catchy Title line at the top.";
                } else if (platform === "linkedin") {
                    platformSpec = "professional, value-focused LinkedIn style with good line spacing";
                    platformRule = "Focus on business value, productivity, or industry lessons learned.";
                } else if (platform === "youtube") {
                    platformSpec = "YouTube Video Concept, Script Intro, and Description text";
                    platformRule = "Output a suggested Title, a 2-sentence script hook, and a short description with hashtags.";
                } else if (platform === "reels") {
                    platformSpec = "detailed Instagram Reels template and storyboard, including a beat-sync guide and text-on-screen hook overlays";
                    platformRule = `Structure the response EXACTLY in this Markdown layout:

### 🎵 Suggested Audio Vibe
- **Audio Track Style:** [Describe energetic/chill/transition trending audio search keywords]
- **Ideal Music Hook:** [Describe audio drop timing]

### 🎬 Text-on-Screen (First 3s Hook)
- **Overlay Text:** "[Make it a punchy pain point or curiosity statement]"

### 📊 Storyboard & Beat Sync Guide
| Time (seconds) | Visual Video Scene Description | Beat / Action Cue |
| --- | --- | --- |
| **0.0s - 1.5s** | [Visual prompt for recording or stocking] | [Sync action / audio cue] |
| **1.5s - 3.0s** | [Visual prompt] | [Sync action] |
| **3.0s - 5.0s** | [Visual prompt] | [Sync action] |
| **5.0s - 8.0s** | [Visual prompt for CTA / Screen record] | [End card CTA] |

### 🎙️ Narrator Voiceover Script
"[Write a conversational, punchy 2-3 sentence speech/script that matches the visual duration]"`;
                }

const prompt = `You are a social media copywriter for '${this.state.bizName}'.
Description: ${this.state.bizDesc}
Target Audience: ${this.state.bizAudience}
Strategic context:
${this.getStrategicContext() || 'No deep research profile has been generated yet.'}

Draft a social media post optimized specifically for the ${platformSpec} platform about: "${topic}".
Rule: ${platformRule}
Only respond with the post text. No other commentary or wrapping.`;

                let postText = "";
                try {
                    postText = await this.queryGeminiAPI(prompt);
                } catch (apiErr) {
                    throw new Error(`AI draft generation failed for ${platform}: ${apiErr.message}`);
                    console.warn(`Gemini API error for ${platform}:`, apiErr.message);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    if (platform === "reels") {
                        postText = `### 🎵 Suggested Audio Vibe
- **Audio Track Style:** Upbeat energetic transition beat (Search: 'Austin Millz Breath' on Reels)
- **Ideal Music Hook:** Transition drops at 1.5s mark

### 🎬 Text-on-Screen (First 3s Hook)
- **Overlay Text:** "Stop wasting 10 hours a week chasing signatures!"

### 📊 Storyboard & Beat Sync Guide
| Time (seconds) | Visual Video Scene Description | Beat / Action Cue |
| --- | --- | --- |
| **0.0s - 1.5s** | Realtor sitting at desk pulling their hair out looking at paper folders. | Beat builds up, text overlay flashes. |
| **1.5s - 3.0s** | Screen transition: phone screen showing ${this.state.bizName || 'the client'} workflow dashboard solving the problem instantly. | Bass drop, smooth zoom. |
| **3.0s - 5.0s** | Realtor smiling, walking out of office holding car keys. | Energetic pan. |
| **5.0s - 8.0s** | Outro slide with a simple call to action for ${this.state.bizName || 'the client'}. | CTA text overlay. |

### 🎙️ Narrator Voiceover Script
"You did not build your business to get buried in repetitive admin. ${this.state.bizName || 'Our team'} helps take the busywork off your plate so you can focus on clients, revenue, and growth. Hit the link in bio to take the next step."`;
                    } else {
                        postText = "";
                    }
                }

                let mediaUrl = null;
                if (this.state.contentAutopilot.autoAttachMedia !== false) {
                    mediaUrl = await this.createGeneratedPostMedia(postText, platform, topic);
                }

                const newPost = {
                    id: Date.now() + Math.floor(Math.random() * 1000), // ensure uniqueness in parallel
                    platform,
                    time: "Draft",
                    body: postText,
                    mediaUrl,
                    impressions: 0,
                    likes: 0,
                    comments: 0
                };

                this.state.socialPosts.unshift(newPost);
            }));

            this.saveState();
            this.renderSocialPostsGrid();
            this.appendConsoleLine('agent-content', `Drafts successfully generated for: ${checkedCheckboxes.join(', ')}`);

        } catch (error) {
            console.error("Content generation error:", error);
            alert("Content draft generation failed: " + error.message);
        } finally {
            this.dom.btnGenerateContent.disabled = false;
            this.dom.btnGenerateContent.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Draft Social Post`;
        }
    }

    async createGeneratedPostMedia(postText, platform, topic = "") {
        if (!postText || !String(postText).trim()) return null;

        try {
            this.appendConsoleLine('agent-content', `Generating visual asset for ${platform} draft...`);

            let visualPrompt = "";
            try {
                const promptResponse = await fetch('/api/generate-image-prompt', {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        text: `Platform: ${platform}
Topic: ${topic}

Post:
${postText}`
                    })
                });

                if (promptResponse.ok) {
                    const promptData = await promptResponse.json();
                    visualPrompt = String(promptData.visualPrompt || "").trim();
                }
            } catch (promptErr) {
                console.warn("Image prompt generation failed:", promptErr.message);
            }

            if (!visualPrompt) {
                visualPrompt = this.generatePromptFromBody(postText);
            }

            const response = await fetch('/api/generate-image', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    promptText: `${visualPrompt}

Social platform: ${platform}. Create a polished, realistic social media creative image. No text overlays, no logos, no UI screenshots unless the post explicitly requires a software dashboard.`
                })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || "Image generation failed.");
            }
            if (!data.mediaUrl || !String(data.mediaUrl).startsWith('/downloads/')) {
                throw new Error("Image generation did not return a local media asset.");
            }

            this.appendConsoleLine('agent-content', `Attached generated ${data.model || 'AI'} image to ${platform} draft.`);
            return data.mediaUrl;
        } catch (error) {
            console.warn(`Generated media unavailable for ${platform}:`, error.message);
            this.appendConsoleLine('system', `Could not attach generated image for ${platform}: ${error.message}`);
            return null;
        }
    }

    async handleRecommendedPostOfDay() {
        const checkedPlatforms = Array.from(document.querySelectorAll('input[name="platform-target"]:checked')).map(cb => cb.value);
        if (checkedPlatforms.length === 0) {
            alert("Select at least one platform before asking for today's recommendation.");
            return;
        }
        if (!this.state.serverConfig || !this.state.serverConfig.geminiConfigured) {
            alert("Gemini is not configured on the server, so I cannot recommend a post topic yet.");
            return;
        }

        const btn = this.dom.btnRecommendContent;
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Recommending...`;

        try {
            const trendContext = Array.isArray(this.state.competitorTrends) && this.state.competitorTrends.length > 0
                ? this.state.competitorTrends.slice(0, 6).map(t => `- ${t.platform || 'social'}: ${t.topic || ''} | ${t.body || ''} | engagement: ${t.engagement || 'unknown'}`).join("\n")
                : "No live trend cards are loaded yet. Use the strategic business context and likely audience pain points.";

            const today = new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric"
            });

            const prompt = `You are the daily content strategist for '${this.state.bizName || 'this business'}'.
Today is ${today}.

Business description:
${this.state.bizDesc || 'No business description saved yet.'}

Target audience:
${this.state.bizAudience || 'No target audience saved yet.'}

Strategic context:
${this.getStrategicContext() || 'No deep research profile has been generated yet.'}

Recent trend context:
${trendContext}

Selected platforms: ${checkedPlatforms.join(', ')}

Recommend ONE specific post topic for today that is timely, likely to earn attention, and useful for this audience.
The topic should be specific enough that a copywriter can draft from it immediately.
Do not write the post. Return only the topic as one sentence, no numbering, no quotes, no commentary.`;

            const rawTopic = await this.queryGeminiAPI(prompt);
            const topic = String(rawTopic || "")
                .split("\n")
                .map(line => line.replace(/^[-*\d.)\s]+/, "").trim())
                .find(Boolean);

            if (!topic) {
                throw new Error("AI returned an empty recommendation.");
            }

            this.dom.contentTopicInput.value = topic;
            this.appendConsoleLine('agent-content', `Recommended post topic for today: "${topic}"`);
            await this.handleContentGeneration();
        } catch (error) {
            console.error("Recommended post generation failed:", error);
            alert("Could not create today's recommended post: " + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    renderStats() {
        const calculatedLeadValue = this.state.dealValue * (this.state.conversionRate / 100);
        const ctr = this.state.stats.impressions > 0
            ? ((this.state.stats.clicks / this.state.stats.impressions) * 100).toFixed(1)
            : "0.0";
        this.dom.headerLeads.innerText = this.state.stats.leads;
        this.dom.headerSpend.innerText = `$${this.state.stats.spend.toFixed(2)}`;
        this.dom.kpiImpressions.innerText = this.state.stats.impressions.toLocaleString();
        this.dom.kpiClicks.innerText = `${this.state.stats.clicks.toLocaleString()} (${ctr}%)`;
        this.dom.kpiLeads.innerText = this.state.stats.leads;
        this.dom.kpiRevenue.innerText = `$${Math.round(this.state.stats.leads * calculatedLeadValue).toLocaleString()}`;
    }

    renderCampaignsTable() {
        this.dom.campaignsListBody.innerHTML = this.state.campaigns.map(c => `
            <tr>
                <td><span class="campaign-active-dot"></span>${c.name}</td>
                <td><span class="badge success-badge">${c.status}</span></td>
                <td>$${c.dailyBudget.toFixed(2)}</td>
                <td>${c.clicks.toLocaleString()}</td>
                <td>${c.impressions.toLocaleString()}</td>
                <td>${c.conversions}</td>
                <td>$${(c.cost / c.conversions).toFixed(2)}</td>
            </tr>
        `).join("");
    }

    formatPostBody(body) {
        if (!body) return "";
        let html = body
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
            
        // Look for markdown tables (beat sync guide)
        if (html.includes("|")) {
            const lines = html.split("\n");
            let inTable = false;
            let tableHtml = '<table class="reels-beat-table">';
            let newLines = [];
            let isFirstRow = true;
            
            lines.forEach(line => {
                if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
                    if (line.includes("---")) return; // skip header divider
                    
                    inTable = true;
                    const cells = line.split("|").slice(1, -1).map(c => c.trim());
                    const cellTag = isFirstRow ? "th" : "td";
                    
                    let rowHtml = "<tr>";
                    cells.forEach(c => {
                        rowHtml += `<${cellTag}>${c}</${cellTag}>`;
                    });
                    rowHtml += "</tr>";
                    
                    if (isFirstRow) {
                        tableHtml += `<thead>${rowHtml}</thead><tbody>`;
                        isFirstRow = false;
                    } else {
                        tableHtml += rowHtml;
                    }
                } else {
                    if (inTable) {
                        tableHtml += "</tbody></table>";
                        newLines.push(tableHtml);
                        tableHtml = '<table class="reels-beat-table">';
                        inTable = false;
                        isFirstRow = true;
                    }
                    newLines.push(line);
                }
            });
            if (inTable) {
                tableHtml += "</tbody></table>";
                newLines.push(tableHtml);
            }
            html = newLines.join("\n");
        }
        
        // Formats headers, bold tags, lists, and breaks
        html = html
            .replace(/### (.*?)(?:\n|<br>|$)/g, '<h4 style="color:var(--orange); margin:12px 0 6px 0; font-size:0.95rem;"><i class="fa-solid fa-star text-pink"></i> $1</h4>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--text-primary); font-weight:600;">$1</strong>')
            .replace(/^\- (.*?)(?:\n|<br>|$)/gm, '<li>$1</li>')
            .replace(/\n\n/g, "<br><br>")
            .replace(/\n/g, "<br>");
            
        return html;
    }

    normalizeDownloadedMediaUrl(mediaUrl) {
        if (!mediaUrl || typeof mediaUrl !== "string") return mediaUrl;
        if (!mediaUrl.startsWith("/downloads/")) return mediaUrl;
        return mediaUrl.replace(/\.f\d+\.webm$/i, ".mp4");
    }

    renderSocialPostsGrid() {
        if (Array.isArray(this.state.socialPosts)) {
            this.state.socialPosts.forEach(p => {
                p.mediaUrl = this.normalizeDownloadedMediaUrl(p.mediaUrl);
            });
        }
        if (!this.state.socialPosts || this.state.socialPosts.length === 0) {
            this.dom.socialPostsContainer.innerHTML = `
                <div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-secondary); width:100%; grid-column: 1 / -1;">
                    <i class="fa-solid fa-file-signature" style="font-size: 2.5rem; color: var(--purple); margin-bottom: 15px;"></i>
                    <p>No drafts created yet. Enter a topic above to draft a post, or visit "Research & Trends" to adapt competitor ideas.</p>
                </div>`;
            return;
        }

        this.dom.socialPostsContainer.innerHTML = this.state.socialPosts.map(p => {
            const isEditing = String(p.id) === String(this.editingPostId);
            return `
            <div class="social-post-card" style="${p.platform === 'reels' ? 'border-top: 3px dashed var(--pink);' : ''}">
                <div class="post-meta">
                    <span class="post-platform ${p.platform}-color">
                        ${p.platform === 'reels' ? '<i class="fa-solid fa-clapperboard"></i> Reels' : `<i class="fa-brands fa-${p.platform}"></i> ${p.platform}`}
                    </span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="post-time">${p.time}</span>
                        ${!isEditing ? `
                        <button class="edit-draft-btn" onclick="App.startEditPost('${p.id}')" title="Edit Draft wording/links">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>` : ''}
                    </div>
                </div>
                ${isEditing ? `
                <div class="post-body-edit-container" style="margin-top: 10px; width: 100%;">
                    <textarea id="edit-body-${p.id}" class="post-body-edit-textarea">${p.body}</textarea>
                </div>
                ` : `
                <div class="post-body" style="font-size:0.85rem; line-height:1.5; color:var(--text-secondary); text-align:left;">${this.formatPostBody(p.body)}</div>
                `}
                ${p.mediaUrl ? `
                <div class="post-media-preview ${p.mediaUrl.includes('.mp4') || p.mediaUrl.includes('.webm') ? 'media-video' : 'media-image'}" id="media-preview-${p.id}">
                    ${p.mediaUrl.includes('.mp4') || p.mediaUrl.includes('.webm') ? `
                        <video id="video-${p.id}" src="${p.mediaUrl}" controls playsinline preload="metadata"></video>
                        <div id="captions-${p.id}" class="reels-captions-overlay" style="position: absolute; bottom: 15px; left: 10px; right: 10px; text-align: center; pointer-events: none; text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000; font-family: 'Outfit', 'Inter', sans-serif; font-weight: 800; font-size: 1.15rem; color: #fff; text-transform: uppercase; z-index: 10; display: flex; flex-wrap: wrap; justify-content: center; gap: 4px;"></div>
                    ` : `
                        <img src="${p.mediaUrl}" />
                    `}
                    ${!isEditing ? `
                    <button onclick="App.removePostImage('${p.id}', 'socialPosts')" style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; z-index: 15;"><i class="fa-solid fa-times"></i></button>
                    ` : ''}
                </div>` : ''}
                ${isEditing ? `
                <div class="card-actions-row" style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end;">
                    <button class="card-action-btn btn-save" onclick="App.saveEditedPost('${p.id}')">
                        <i class="fa-solid fa-check"></i> Save
                    </button>
                    <button class="card-action-btn btn-cancel" onclick="App.cancelEditPost()">
                        <i class="fa-solid fa-xmark"></i> Cancel
                    </button>
                </div>
                ` : `
                <div class="card-actions-row" style="margin-top:12px;">
                    <button class="card-action-btn btn-post" onclick="App.publishPostNow('${p.id}')">
                        <i class="fa-solid fa-paper-plane"></i> Post Now
                    </button>
                    ${(p.platform === 'reels' || p.platform === 'youtube') ? `
                        ${p.mediaUrl && p.mediaUrl.includes('avatar_') ? `
                        <button class="card-action-btn btn-speech" id="btn-speech-${p.id}" onclick="App.toggleSpeech('${p.id}')" style="border: 1px solid var(--purple); color: var(--purple); background: rgba(187,94,255,0.08); font-weight: 600;">
                            <i class="fa-solid fa-volume-high"></i> Listen Voice
                        </button>
                        ` : `
                        <button class="card-action-btn btn-avatar" onclick="App.openAvatarModal('${p.id}', 'socialPosts')" style="border: 1px solid var(--purple); color: var(--purple); background: transparent;">
                            <i class="fa-solid fa-user-tie"></i> AI Avatar
                        </button>
                        `}
                    ` : `
                    <button class="card-action-btn btn-image" onclick="App.generatePostImage('${p.id}')" style="border: 1px solid var(--accent); color: var(--accent); background: transparent;">
                        <i class="fa-solid fa-image"></i> AI Image
                    </button>
                    `}
                    <button class="card-action-btn btn-video" onclick="App.generatePostVideo('${p.id}')" style="border: 1px solid var(--pink); color: var(--pink); background: transparent;">
                        <i class="fa-solid fa-video"></i> AI Video
                    </button>
                    <button class="card-action-btn btn-sched" onclick="App.showScheduleModal('${p.id}')">
                        <i class="fa-solid fa-clock"></i> Schedule
                    </button>
                    <button class="card-action-btn btn-del" onclick="App.deleteSocialPost('${p.id}', 'socialPosts')">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
                `}
            </div>
            `;
        }).join("");
    }

    renderScheduledQueue() {
        if (!this.state.scheduledPosts || this.state.scheduledPosts.length === 0) {
            this.dom.queueContainer.innerHTML = `
                <div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-secondary); width:100%; grid-column: 1 / -1;">
                    <i class="fa-solid fa-calendar-days" style="font-size: 2.5rem; color: var(--orange); margin-bottom: 15px;"></i>
                    <p>No scheduled posts. Go to the "Drafts" tab and schedule a draft to see it here.</p>
                </div>`;
            return;
        }

        this.dom.queueContainer.innerHTML = this.state.scheduledPosts.map(p => {
            const isEditing = String(p.id) === String(this.editingPostId);
            return `
            <div class="social-post-card" style="border-top: 2px solid var(--orange); ${p.platform === 'reels' ? 'border-top: 3px dashed var(--pink);' : ''}">
                <div class="post-meta">
                    <span class="post-platform ${p.platform}-color">
                        ${p.platform === 'reels' ? '<i class="fa-solid fa-clapperboard"></i> Reels' : `<i class="fa-brands fa-${p.platform}"></i> ${p.platform}`}
                    </span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="post-time" style="color: var(--orange); font-weight: 600;"><i class="fa-solid fa-clock"></i> ${p.time}</span>
                        ${!isEditing ? `
                        <button class="edit-draft-btn" onclick="App.startEditPost('${p.id}')" title="Edit Scheduled Post wording/links">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>` : ''}
                    </div>
                </div>
                ${isEditing ? `
                <div class="post-body-edit-container" style="margin-top: 10px; width: 100%;">
                    <textarea id="edit-body-${p.id}" class="post-body-edit-textarea">${p.body}</textarea>
                </div>
                ` : `
                <div class="post-body" style="font-size:0.85rem; line-height:1.5; color:var(--text-secondary); text-align:left;">${this.formatPostBody(p.body)}</div>
                `}
                ${p.mediaUrl ? `
                <div class="post-media-preview ${p.mediaUrl.includes('.mp4') || p.mediaUrl.includes('.webm') ? 'media-video' : 'media-image'}" style="margin-bottom: 12px;">
                    ${p.mediaUrl.includes('.mp4') || p.mediaUrl.includes('.webm') ? `
                        <video src="${p.mediaUrl}" controls playsinline preload="metadata"></video>
                    ` : `
                        <img src="${p.mediaUrl}" />
                    `}
                    ${!isEditing ? `
                    <button onclick="App.removePostImage('${p.id}', 'scheduledPosts')" style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; z-index: 15;"><i class="fa-solid fa-times"></i></button>
                    ` : ''}
                </div>` : ''}
                ${isEditing ? `
                <div class="card-actions-row" style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end;">
                    <button class="card-action-btn btn-save" onclick="App.saveEditedPost('${p.id}')">
                        <i class="fa-solid fa-check"></i> Save
                    </button>
                    <button class="card-action-btn btn-cancel" onclick="App.cancelEditPost()">
                        <i class="fa-solid fa-xmark"></i> Cancel
                    </button>
                </div>
                ` : `
                <div class="card-actions-row" style="margin-top:12px;">
                    <button class="card-action-btn btn-post" onclick="App.publishPostNow('${p.id}', 'scheduledPosts')">
                        <i class="fa-solid fa-paper-plane"></i> Post Now
                    </button>
                    <button class="card-action-btn btn-del" onclick="App.deleteSocialPost(${p.id}, 'scheduledPosts')">
                        <i class="fa-solid fa-trash"></i> Cancel
                    </button>
                </div>
                `}
            </div>
            `;
        }).join("");
    }

    renderPublishedAnalytics() {
        if (!this.state.publishedPosts || this.state.publishedPosts.length === 0) {
            this.dom.analyticsContainer.innerHTML = `
                <div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-secondary); width:100%; grid-column: 1 / -1;">
                    <i class="fa-solid fa-chart-line" style="font-size: 2.5rem; color: var(--accent); margin-bottom: 15px;"></i>
                    <p>No published posts yet. Publish a post immediately or wait for scheduled queues to go live.</p>
                </div>`;
            return;
        }

        this.dom.analyticsContainer.innerHTML = this.state.publishedPosts.map(p => `
            <div class="social-post-card" style="border-top: 2px solid var(--accent); ${p.platform === 'reels' ? 'border-top: 3px dashed var(--pink);' : ''}">
                <div class="post-meta">
                    <span class="post-platform ${p.platform}-color">
                        ${p.platform === 'reels' ? '<i class="fa-solid fa-clapperboard"></i> Reels' : `<i class="fa-brands fa-${p.platform}"></i> ${p.platform}`}
                    </span>
                    <span class="post-time">${p.time}</span>
                </div>
                <div class="post-body" style="font-size:0.85rem; line-height:1.5; color:var(--text-secondary); text-align:left;">${this.formatPostBody(p.body)}</div>
                ${p.mediaUrl ? `
                <div class="post-media-preview ${p.mediaUrl.includes('.mp4') || p.mediaUrl.includes('.webm') ? 'media-video' : 'media-image'}" style="margin-bottom: 12px;">
                    ${p.mediaUrl.includes('.mp4') || p.mediaUrl.includes('.webm') ? `
                        <video src="${p.mediaUrl}" controls playsinline preload="metadata"></video>
                    ` : `
                        <img src="${p.mediaUrl}" />
                    `}
                </div>` : ''}
                <div class="post-actions">
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <span class="post-metric"><i class="fa-solid fa-chart-simple"></i> ${p.impressions ? p.impressions.toLocaleString() : 0} Views</span>
                        <span class="post-metric"><i class="fa-solid fa-heart"></i> ${p.likes || 0} Likes</span>
                        <span class="post-metric"><i class="fa-solid fa-comment"></i> ${p.comments || 0} Comments</span>
                    </div>
                    <button class="card-action-btn" onclick="App.clonePostToDrafts('${p.id}')" style="padding: 4px 8px; font-size: 0.7rem; border: 1px solid var(--accent); background: transparent; color: var(--accent); border-radius: 4px; cursor: pointer; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.background='var(--accent-glow)'" onmouseout="this.style.background='transparent'">
                        <i class="fa-solid fa-rotate-left"></i> Re-draft
                    </button>
                </div>
            </div>
        `).join("");
    }

    async loadCompetitorTrends(forceRefresh = false) {
        if (!forceRefresh && this.state.competitorTrends && this.state.competitorTrends.length > 0) {
            this.renderCompetitorTrendsGrid();
            return;
        }

        const requestId = Date.now();
        this.latestTrendRequestId = requestId;
        this.dom.trendsContainer.innerHTML = `
            <div style="padding: 40px; text-align: center; color: var(--text-secondary); width: 100%; grid-column: 1 / -1;">
                <i class="fa-solid fa-spinner fa-spin text-purple" style="font-size: 2.5rem; margin-bottom: 15px;"></i>
                <p>AI is researching competitor posts and analyzing engagement metrics...</p>
            </div>`;

        try {
            const response = await fetch('/api/trends', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    competitors: Array.isArray(this.state.competitorUrls) ? this.state.competitorUrls.join(', ') : this.state.competitorUrls,
                    bizName: this.state.bizName,
                    bizDesc: this.state.bizDesc,
                    bizAudience: this.state.bizAudience,
                    bizSwot: this.state.bizSwot,
                    businessReport: this.state.businessReport,
                    competitorProfiles: this.state.competitorProfiles,
                    agencyGoal: this.state.agencyGoal,
                    coreMessage: this.state.coreMessage
                })
            });

            if (!response.ok) throw new Error("Failed to load trends");

            const data = await response.json();
            if (this.latestTrendRequestId !== requestId) return;

            const nextTrends = Array.isArray(data) ? data : (Array.isArray(data.trends) ? data.trends : []);
            const hadExistingTrends = Array.isArray(this.state.competitorTrends) && this.state.competitorTrends.length > 0;
            if (nextTrends.length > 0) {
                this.state.competitorTrends = nextTrends;
                this.state.trendRefreshWarning = data.stale
                    ? (data.warning || "No new competitor posts were parsed, so the last successful trend cards were kept.")
                    : "";
            } else if (hadExistingTrends) {
                this.state.trendRefreshWarning = "Refresh did not parse any new competitor posts, so the last successful trend cards are still shown.";
            } else {
                this.state.competitorTrends = [];
                this.state.trendRefreshWarning = "";
            }
            this.state.competitorTrendKeywords = Array.isArray(data.keywords) ? data.keywords : [];
            this.state.trendSearchQueries = Array.isArray(data.searchedQueries) ? data.searchedQueries : [];
            this.saveState();
            this.renderCompetitorTrendsGrid();
        } catch (error) {
            console.error("Trends load failed:", error);
            this.dom.trendsContainer.innerHTML = `<p class="text-danger" style="grid-column: 1 / -1;">Failed to load competitor trends: ${error.message}</p>`;
        }
    }

    renderCompetitorTrendsGrid() {
        const keywordSummaryHtml = this.renderTrendKeywordSummary();
        const warningHtml = this.state.trendRefreshWarning
            ? `<div class="social-post-card" style="grid-column:1 / -1; border-left:3px solid var(--orange);"><strong style="font-size:0.9rem; color:var(--orange);"><i class="fa-solid fa-triangle-exclamation"></i> Trend refresh note</strong><p style="margin:8px 0 0; color:var(--text-secondary); font-size:0.85rem;">${this.escapeHtml(this.state.trendRefreshWarning)}</p></div>`
            : '';
        if (!this.state.competitorTrends || this.state.competitorTrends.length === 0) {
            this.dom.trendsContainer.innerHTML = `
                ${keywordSummaryHtml}
                ${warningHtml}
                <div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-secondary); width:100%; grid-column: 1 / -1;">
                    <i class="fa-solid fa-magnifying-glass" style="font-size: 2.5rem; color: var(--purple); margin-bottom: 15px;"></i>
                    <p>No competitor posts were parsed yet. The agent searched onboarding keywords${this.state.trendSearchQueries && this.state.trendSearchQueries.length ? ` like ${this.escapeHtml(this.state.trendSearchQueries.slice(0, 3).join(', '))}` : ''}; try Refresh Trends again or enrich Agency Onboarding with more offers, audience pains, and competitor profiles.</p>
                </div>`;
            return;
        }

        this.dom.trendsContainer.innerHTML = keywordSummaryHtml + warningHtml + this.state.competitorTrends.map(t => {
            const platform = this.escapeHtml(t.platform || 'market');
            const platformClass = String(t.platform || 'market').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'market';
            const keyword = this.escapeHtml(t.searchKeyword || t.keyword || '');
            const sourceUrl = t.sourceUrl ? this.escapeHtml(t.sourceUrl) : '';
            const platformIcon = platformClass === 'market' ? 'fa-solid fa-chart-line' : `fa-brands fa-${platformClass}`;
            return `
            <div class="social-post-card" style="border-left: 3px solid var(--purple);">
                <div class="post-meta">
                    <span class="badge" style="background: rgba(187,94,255,0.1); color: var(--purple); border:1px solid rgba(187,94,255,0.2);">
                        <i class="fa-solid fa-globe"></i> ${this.escapeHtml(t.competitor || 'Market')}
                    </span>
                    <span class="post-platform ${platformClass}-color" style="font-size:0.75rem;">
                        <i class="${platformIcon}"></i> ${platform}
                    </span>
                </div>
                <strong style="display:block; margin: 10px 0 5px 0; font-size: 0.95rem; color: var(--text-primary);">${this.escapeHtml(t.topic || 'Trend angle')}</strong>
                ${keyword ? `<div style="font-size:0.72rem; color:var(--accent); margin-bottom:7px;"><i class="fa-solid fa-key"></i> ${keyword}</div>` : ''}
                <p class="post-body" style="font-size: 0.85rem; color: var(--text-secondary); font-style: italic;">"${this.escapeHtml(t.body || '')}"</p>
                ${t.mediaUrl ? `
                <div class="post-media-preview" style="margin-top: 10px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color); max-height: 140px; width: 100%;">
                    <img src="${this.escapeHtml(t.mediaUrl)}" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>` : ''}
                ${this.renderTrendMetricLine(t)}
                ${sourceUrl ? `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; gap:6px; align-items:center; margin-top:8px; font-size:0.75rem; color:var(--accent); text-decoration:none;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Source</a>` : ''}
                <div class="card-actions-row">
                    <button class="card-action-btn btn-draft-trend" onclick="App.handleTrendRewrite(${Number(t.id) || 0})">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Turn into Draft
                    </button>
                </div>
            </div>
        `}).join("");
    }

    renderTrendMetricLine(trend) {
        const numericPattern = /\b\d[\d,.]*(?:\.\d+)?\s*(?:k|m)?\s*(?:views?|likes?|comments?|shares?|reposts?|replies?)\b/i;
        const metrics = String(trend.engagementMetrics || '').trim();
        const engagement = String(trend.engagement || '').trim();
        const signal = String(trend.trendSignal || '').trim();

        if (metrics && numericPattern.test(metrics)) {
            return `<div style="font-size: 0.75rem; color: var(--orange); margin-top: 10px; font-weight:600;"><i class="fa-solid fa-fire"></i> Engagement: ${this.escapeHtml(metrics)}</div>`;
        }

        if (engagement && numericPattern.test(engagement)) {
            return `<div style="font-size: 0.75rem; color: var(--orange); margin-top: 10px; font-weight:600;"><i class="fa-solid fa-fire"></i> Engagement: ${this.escapeHtml(engagement)}</div>`;
        }

        const trendSignal = signal || engagement.replace(/^search-backed trend signal:\s*/i, '').trim() || 'Source-backed trend signal';
        return `<div style="font-size: 0.75rem; color: var(--accent); margin-top: 10px; font-weight:600;"><i class="fa-solid fa-chart-line"></i> Trend signal: ${this.escapeHtml(trendSignal)}</div>`;
    }

    renderTrendKeywordSummary() {
        const keywords = Array.isArray(this.state.competitorTrendKeywords) ? this.state.competitorTrendKeywords : [];
        if (!keywords.length) return '';

        const keywordChips = keywords.slice(0, 10).map(item => {
            const term = this.escapeHtml(item.term || item.keyword || '');
            if (!term) return '';
            const count = Number(item.trendCount) || 0;
            const countHtml = count ? `<span style="opacity:0.75;">${count} hit${count === 1 ? '' : 's'}</span>` : '';
            return `<span class="badge" style="display:inline-flex; gap:6px; align-items:center; background:rgba(0,229,255,0.08); border:1px solid rgba(0,229,255,0.18); color:var(--accent); margin:0 6px 6px 0;"><i class="fa-solid fa-key"></i>${term}${countHtml}</span>`;
        }).join('');

        const queryCount = Array.isArray(this.state.trendSearchQueries) ? this.state.trendSearchQueries.length : 0;
        return `
            <div class="social-post-card" style="grid-column:1 / -1; border-left:3px solid var(--accent);">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:8px;">
                    <strong style="font-size:0.95rem; color:var(--text-primary);"><i class="fa-solid fa-chart-line text-cyan"></i> Top keyword targets</strong>
                    <span style="font-size:0.75rem; color:var(--text-secondary);">${queryCount ? `${queryCount} research searches` : 'Onboarding-derived plan'}</span>
                </div>
                <div>${keywordChips}</div>
            </div>`;
    }

    async handleTrendRewrite(trendId) {
        const trend = this.state.competitorTrends.find(t => t.id === trendId);
        if (!trend) return;

        this.appendConsoleLine('system', `AI Ghostwriter rewriting competitor topic: "${trend.topic}"...`);
        
        // Find the button and show loading spinner
        const cardSelector = document.querySelector(`[onclick="App.handleTrendRewrite(${trendId})"]`);
        if (cardSelector) {
            cardSelector.disabled = true;
            cardSelector.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Synthesizing...`;
        }

        try {
            const response = await fetch('/api/rewrite-trend', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bizName: this.state.bizName,
                    bizDesc: this.state.bizDesc,
                    bizOffers: this.state.bizDesc.split("Core Offers:\n")[1] || "",
                    trendBody: trend.body,
                    platform: trend.platform
                })
            });

            if (!response.ok) throw new Error("Ghostwriter rewrite request failed");

            const data = await response.json();
            
            // Add rewritten draft to drafts
            const newDraft = {
                id: Date.now(),
                platform: trend.platform,
                time: "Drafted from " + trend.competitor,
                body: data.text,
                impressions: 0, likes: 0, comments: 0
            };

            this.state.socialPosts.unshift(newDraft);
            this.saveState();
            
            this.appendConsoleLine('agent-content', `Draft created from trend: "${trend.topic}" successfully!`);
            alert("Trend successfully adapted and saved to your Drafts!");
            
            // Render Drafts
            this.renderSocialPostsGrid();
        } catch (error) {
            console.error("Trend rewrite failed:", error);
            alert("Failed to adapt competitor trend: " + error.message);
        } finally {
            if (cardSelector) {
                cardSelector.disabled = false;
                cardSelector.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Turn into Draft`;
            }
        }
    }

    async handleAutoIngestVideo() {
        const btn = document.getElementById("btn-auto-ingest-video");
        if (!btn) return;
        const originalHtml = btn.innerHTML;
        
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Researching...`;
        
        this.appendConsoleLine('agent-content', `Starting autonomous competitor Reel ingestion pipeline...`);
        this.appendConsoleLine('system', `AI is querying social channels for high-performing competitor real estate shorts...`);

        try {
            const response = await fetch('/api/auto-ingest-trends-video', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bizName: this.state.bizName,
                    bizDesc: this.state.bizDesc,
                    bizAudience: this.state.bizAudience
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Autonomous Ingestion failed");
            }

            const data = await response.json();
            
            this.appendConsoleLine('system', `Found & downloaded trending video: "${data.title}" by ${data.uploader}`);
            this.appendConsoleLine('agent-content', `Transcribed subtitle content: "${data.transcript.substring(0, 100)}..."`);
            this.appendConsoleLine('agent-content', `Gemini is ghostwriting a brand draft adapted to ${this.state.bizName || 'the client'}...`);

            const rewritePrompt = `You are a social media advertising expert.
Take this transcript from a trending real estate video:
"${data.transcript}"

Write a punchy Instagram Reels caption promoting our service, '${this.state.bizName || 'Client Business'}' (which does: ${this.state.bizDesc}).
Our service core value: Save agents time, handle compliance, let them close more deals.
Keep the caption short (max 2-3 sentences, under 150 characters), use emojis, and add 5-8 relevant hashtags. Include a clear Call to Action (e.g. "Link in bio!"). Do NOT write long paragraphs.`;

            let rewrittenText = "";
            try {
                rewrittenText = await this.queryGeminiAPI(rewritePrompt);
            } catch (rewriteErr) {
                this.appendConsoleLine('system', `Gemini rewrite failed, saving source-based draft anyway: ${rewriteErr.message}`);
                rewrittenText = `New angle inspired by "${data.title}": ${data.transcript.substring(0, 180)}...`;
            }

            const newPost = {
                id: Date.now(),
                platform: 'reels',
                time: `Adapted from ${data.uploader}`,
                body: rewrittenText,
                mediaUrl: data.downloadUrl,
                sourceMediaUrl: data.downloadUrl,
                sourceTitle: data.title,
                sourceUrl: data.url,
                impressions: 0,
                likes: 0,
                comments: 0
            };

            this.state.socialPosts.unshift(newPost);
            this.saveState();
            this.renderSocialPostsGrid();

            this.appendConsoleLine('agent-content', `Successfully created adapted Reel draft with downloaded video asset: ${data.filename}`);
            alert(`Successfully ingested viral Reel!\nTitle: ${data.title}\nSaved to drafts.`);
        } catch (error) {
            console.error("Auto Ingestion failed:", error);
            this.appendConsoleLine('system', `Error during autonomous video ingestion: ${error.message}`);
            alert("Failed to autonomously ingest and adapt viral Reel: " + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    // Modal display control
    showScheduleModal(postId) {
        this.state.currentSchedulingPostId = postId;
        this.dom.scheduleModal.style.display = "flex";
        
        // Set default datetime to tomorrow at 9:00 AM
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        
        // Format to ISO local for datetime-local input
        const pad = (num) => String(num).padStart(2, '0');
        const localDateTime = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth()+1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;
        this.dom.scheduleDatetimeInput.value = localDateTime;
    }

    hideScheduleModal() {
        this.dom.scheduleModal.style.display = "none";
        this.state.currentSchedulingPostId = null;
    }

    openAvatarModal(postId, listName) {
        console.log(`[Avatar Studio] Opening avatar modal for postId: ${postId} in ${listName}`);
        this.state.currentAvatarPostId = postId;
        this.state.currentAvatarListName = listName;
        
        let post = null;
        if (listName === 'socialPosts') {
            post = this.state.socialPosts.find(p => String(p.id) === String(postId));
        } else if (listName === 'scheduledPosts') {
            post = this.state.scheduledPosts.find(p => String(p.id) === String(postId));
        }
        
        if (!post) {
            console.error(`[Avatar Studio] Could not find post with ID: ${postId}`);
            alert(`Could not find draft post with ID: ${postId}`);
            return;
        }

        const scriptInput = document.getElementById("avatar-script-input");
        const progressBox = document.getElementById("avatar-render-progress-box");
        const progressBar = document.getElementById("avatar-progress-bar");
        const progressPercent = document.getElementById("avatar-progress-percent");
        const confirmBtn = document.getElementById("btn-generate-avatar-confirm");
        const closeBtn = document.getElementById("btn-close-avatar-studio");
        const modal = document.getElementById("avatar-modal");

        if (!scriptInput || !modal) {
            console.error("[Avatar Studio] Critical modal elements missing from DOM!");
            alert("Modal elements missing from DOM.");
            return;
        }

        scriptInput.value = post.recreationScript || post.body;
        if (progressBox) progressBox.style.display = "none";
        if (progressBar) progressBar.style.width = "0%";
        if (progressPercent) progressPercent.innerText = "0%";
        
        if (confirmBtn) confirmBtn.disabled = false;
        if (closeBtn) closeBtn.disabled = false;

        modal.style.display = "flex";
    }

    closeAvatarModal() {
        document.getElementById("avatar-modal").style.display = "none";
        this.state.currentAvatarPostId = null;
        this.state.currentAvatarListName = null;
    }

    handleRenderAvatar() {
        const postId = this.state.currentAvatarPostId;
        const listName = this.state.currentAvatarListName;
        const avatarId = document.getElementById("avatar-actor-select").value;
        const style = document.getElementById("avatar-style-select").value;
        const scriptText = document.getElementById("avatar-script-input").value.trim();

        if (!scriptText) {
            alert("Please provide a script for the spokesperson to read.");
            return;
        }

        const confirmBtn = document.getElementById("btn-generate-avatar-confirm");
        const cancelBtn = document.getElementById("btn-close-avatar-studio");
        
        confirmBtn.disabled = true;
        cancelBtn.disabled = true;

        const progressBox = document.getElementById("avatar-render-progress-box");
        const progressBar = document.getElementById("avatar-progress-bar");
        const statusText = document.getElementById("avatar-progress-status");
        const percentText = document.getElementById("avatar-progress-percent");

        progressBox.style.display = "block";

        let percent = 0;
        const statuses = [
            { limit: 25, text: "Preparing avatar render request..." },
            { limit: 55, text: "Sending script and source context..." },
            { limit: 80, text: "Waiting for renderer response..." },
            { limit: 100, text: "Saving returned video..." }
        ];

        this.appendConsoleLine('system', `AI Avatar Studio sending render request...`);

        const interval = setInterval(async () => {
            percent += Math.floor(Math.random() * 8) + 2;
            if (percent > 100) percent = 100;

            progressBar.style.width = `${percent}%`;
            percentText.innerText = `${percent}%`;

            const currentStatus = statuses.find(s => percent <= s.limit) || statuses[statuses.length - 1];
            statusText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${currentStatus.text}`;

            if (percent === 100) {
                clearInterval(interval);
                
                try {
                    let sourcePost = null;
                    if (listName === 'socialPosts') {
                        sourcePost = this.state.socialPosts.find(p => String(p.id) === String(postId));
                    } else if (listName === 'scheduledPosts') {
                        sourcePost = this.state.scheduledPosts.find(p => String(p.id) === String(postId));
                    }

                    const response = await fetch('/api/generate-avatar', {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            postId,
                            listName,
                            avatarId,
                            style,
                            script: scriptText,
                            sourceMediaUrl: sourcePost?.mediaUrl || null,
                            sourceUrl: sourcePost?.sourceUrl || null
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || "Avatar rendering failed on server");
                    }

                    const data = await response.json();

                    let post = null;
                    if (listName === 'socialPosts') {
                        post = this.state.socialPosts.find(p => String(p.id) === String(postId));
                    } else if (listName === 'scheduledPosts') {
                        post = this.state.scheduledPosts.find(p => String(p.id) === String(postId));
                    }

                    if (post) {
                        post.body = data.script;
                        post.mediaUrl = data.mediaUrl;
                        this.saveState();
                        
                        if (listName === 'socialPosts') {
                            this.renderSocialPostsGrid();
                        } else {
                            this.renderScheduledQueue();
                        }
                    }

                    this.appendConsoleLine('agent-content', `Avatar renderer returned video for Post #${postId}.`);
                    alert(`Avatar render complete!\nAvatar: ${avatarId.toUpperCase()}\nStatus: Saved to drafts.`);
                    this.closeAvatarModal();
                } catch (err) {
                    console.error("Avatar fetch error:", err);
                    alert("Failed to render avatar: " + err.message);
                    confirmBtn.disabled = false;
                    cancelBtn.disabled = false;
                }
            }
        }, 100);
    }

    confirmSchedulePost() {
        const datetimeVal = this.dom.scheduleDatetimeInput.value;
        if (!datetimeVal) {
            alert("Please select a date and time.");
            return;
        }

        const date = new Date(datetimeVal);
        const formattedTime = date.toLocaleDateString() + " at " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const postId = this.state.currentSchedulingPostId;
        const postIndex = this.state.socialPosts.findIndex(p => String(p.id) === String(postId));
        if (postIndex === -1) return;

        const post = this.state.socialPosts[postIndex];
        
        // Update time and move to scheduledPosts list
        post.time = "Scheduled for " + formattedTime;
        this.state.scheduledPosts.unshift(post);
        this.state.socialPosts.splice(postIndex, 1);
        
        this.saveState();
        this.hideScheduleModal();
        
        this.renderSocialPostsGrid();
        this.renderScheduledQueue();
        
        this.appendConsoleLine('agent-content', `Post scheduled successfully for: ${formattedTime}`);
        alert(`Post scheduled for ${formattedTime}`);
    }

    async publishPostNow(postId, listName = 'socialPosts') {
        let postIndex = -1;
        let post = null;

        if (listName === 'socialPosts') {
            postIndex = this.state.socialPosts.findIndex(p => String(p.id) === String(postId));
            if (postIndex !== -1) {
                post = this.state.socialPosts[postIndex];
            }
        } else if (listName === 'scheduledPosts') {
            postIndex = this.state.scheduledPosts.findIndex(p => String(p.id) === String(postId));
            if (postIndex !== -1) {
                post = this.state.scheduledPosts[postIndex];
            }
        }

        if (!post) return;

        this.appendConsoleLine('system', `Attempting API publication to ${post.platform}...`);

        try {
            const response = await fetch('/api/publish-post', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    platforms: [post.platform],
                    content: post.body,
                    mediaUrl: post.mediaUrl || ""
                })
            });

            if (!response.ok) throw new Error("API post request failed");
            const result = await response.json();

            const platformResult = result[post.platform];
            if (platformResult && !platformResult.success) {
                throw new Error(platformResult.error || "Unknown platform error");
            }

            if (listName === 'socialPosts') {
                this.state.socialPosts.splice(postIndex, 1);
            } else if (listName === 'scheduledPosts') {
                this.state.scheduledPosts.splice(postIndex, 1);
            }

            // Move to sent log. Real engagement metrics require platform analytics.
            post.time = "Sent to Publisher";
            post.impressions = 0;
            post.likes = 0;
            post.comments = 0;

            this.state.publishedPosts.unshift(post);
            this.saveState();

            this.renderSocialPostsGrid();
            this.renderScheduledQueue();
            this.renderPublishedAnalytics();

            this.appendConsoleLine('agent-content', `Social post forwarded to publisher for ${post.platform}.`);
            alert(`Social post forwarded to publisher for ${post.platform}.`);
        } catch (error) {
            console.error("API publishing failed:", error);
            this.appendConsoleLine('system', `API publication failed for ${post.platform}: ${error.message}`);
            alert(`Publishing failed: ${error.message}\nEnsure the platform is connected in Settings with correct credentials.`);
        }
    }

    deleteSocialPost(postId, listName) {
        if (!confirm("Are you sure you want to delete this social post?")) return;

        let postIndex = -1;
        if (listName === 'socialPosts') {
            postIndex = this.state.socialPosts.findIndex(p => String(p.id) === String(postId));
            if (postIndex !== -1) this.state.socialPosts.splice(postIndex, 1);
        } else if (listName === 'scheduledPosts') {
            postIndex = this.state.scheduledPosts.findIndex(p => String(p.id) === String(postId));
            if (postIndex !== -1) this.state.scheduledPosts.splice(postIndex, 1);
        }

        this.saveState();
        
        if (listName === 'socialPosts') this.renderSocialPostsGrid();
        if (listName === 'scheduledPosts') this.renderScheduledQueue();
        
        this.appendConsoleLine('agent-content', `Draft/Scheduled post deleted.`);
    }

    toggleSpeech(postId) {
        const post = this.state.socialPosts.find(p => String(p.id) === String(postId));
        if (!post) return;

        const btn = document.getElementById(`btn-speech-${postId}`);
        const video = document.getElementById(`video-${postId}`);
        const overlay = document.getElementById(`captions-${postId}`);

        // If currently speaking for this post, stop it
        if (this.state.activeSpeechPostId === postId) {
            window.speechSynthesis.cancel();
            this.state.activeSpeechPostId = null;
            if (btn) btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Listen Voice';
            if (video) video.pause();
            if (overlay) overlay.innerHTML = '';
            this.appendConsoleLine('agent-content', 'Voice preview stopped.');
            return;
        }

        // Cancel any other speaking post first
        if (this.state.activeSpeechPostId) {
            const oldId = this.state.activeSpeechPostId;
            const oldBtn = document.getElementById(`btn-speech-${oldId}`);
            const oldVideo = document.getElementById(`video-${oldId}`);
            const oldOverlay = document.getElementById(`captions-${oldId}`);
            if (oldBtn) oldBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Listen Voice';
            if (oldVideo) oldVideo.pause();
            if (oldOverlay) oldOverlay.innerHTML = '';
        }

        window.speechSynthesis.cancel();
        this.state.activeSpeechPostId = postId;

        if (btn) btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> Stop Voice';
        if (video) {
            video.currentTime = 0;
            video.muted = true;
            video.play().catch(e => console.log('Video play blocked:', e));
        }

        // Clean hashtags and emojis from text for better TTS reading
        const cleanText = post.body
            .replace(/#\w+/g, '') // remove hashtags
            .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // remove emojis
            .trim();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        // Select appropriate voice based on avatar name
        const voices = window.speechSynthesis.getVoices();
        const isFemale = post.mediaUrl.includes('sarah') || post.mediaUrl.includes('chloe');
        let voice = null;

        if (isFemale) {
            voice = voices.find(v => v.lang.startsWith('en') && (v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('jenny') || v.name.toLowerCase().includes('hazel') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('samantha')));
        } else {
            voice = voices.find(v => v.lang.startsWith('en') && (v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('guy') || v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('mark') || v.name.toLowerCase().includes('george')));
        }
        if (voice) utterance.voice = voice;

        // Caption synchronization using speech synthesis boundary events
        const words = cleanText.split(/\s+/);
        utterance.onboundary = (event) => {
            if (event.name === 'word' && overlay) {
                const charIndex = event.charIndex;
                let cumulative = 0;
                let activeWordIndex = 0;
                for (let i = 0; i < words.length; i++) {
                    if (charIndex >= cumulative && charIndex < cumulative + words[i].length + 1) {
                        activeWordIndex = i;
                        break;
                    }
                    cumulative += words[i].length + 1;
                }

                // Sliding window display
                const start = Math.max(0, activeWordIndex - 1);
                const end = Math.min(words.length, activeWordIndex + 3);
                const slice = words.slice(start, end);

                overlay.innerHTML = slice.map((w, idx) => {
                    const isCurrent = (start + idx) === activeWordIndex;
                    return `<span style="color: ${isCurrent ? '#FFE600' : '#FFF'}; font-size: ${isCurrent ? '1.35rem' : '1.1rem'}; font-weight: 800; text-transform: uppercase; transition: all 0.1s ease; transform: ${isCurrent ? 'scale(1.15)' : 'scale(1.0)'}; display: inline-block; margin: 0 4px;">${w}</span>`;
                }).join(" ");
            }
        };

        utterance.onend = () => {
            if (this.state.activeSpeechPostId === postId) {
                this.state.activeSpeechPostId = null;
                if (btn) btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Listen Voice';
                if (video) video.pause();
                if (overlay) overlay.innerHTML = '';
            }
        };

        utterance.onerror = (e) => {
            console.error('Speech synthesis error:', e);
            if (this.state.activeSpeechPostId === postId) {
                this.state.activeSpeechPostId = null;
                if (btn) btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Listen Voice';
                if (video) video.pause();
                if (overlay) overlay.innerHTML = '';
            }
        };

        window.speechSynthesis.speak(utterance);
        this.appendConsoleLine('agent-content', `Voice playback active for draft ${postId}.`);
    }

    renderLeadsList() {
        this.dom.crmLeadCount.innerText = `${this.state.leads.length} Leads`;
        this.dom.leadsListContainer.innerHTML = this.state.leads.map((l, i) => `
            <div class="lead-item ${this.state.selectedLeadIndex === i ? 'active' : ''}" data-index="${i}">
                <div class="lead-header">
                    <span class="lead-name">${l.name}</span>
                    <span class="lead-stage badge ${l.stage === 'Demo Scheduled' ? 'success-badge' : ['Hot Lead', 'Two-Way Conversation'].includes(l.stage) ? 'warning-badge' : l.stage === 'Quarantined' ? 'danger-badge' : ''}">${l.stage}</span>
                </div>
                <div class="lead-email">${l.company} · ${l.email}</div>
                ${l.activeEnrollment ? `<div class="lead-email">Campaign ${l.activeEnrollment.campaignOrder}: ${l.activeEnrollment.campaignName || 'Unknown'} · Step ${l.activeEnrollment.currentStep}</div>` : ''}
            </div>
        `).join("");

        // Attach click listeners to lead list items
        this.dom.leadsListContainer.querySelectorAll(".lead-item").forEach(item => {
            item.addEventListener("click", () => {
                const index = parseInt(item.getAttribute("data-index"));
                this.selectLead(index);
            });
        });
    }

    selectLead(index) {
        this.state.selectedLeadIndex = index;
        const selectedLead = this.state.leads[index];
        this.state.selectedLeadId = selectedLead ? selectedLead.id : null;
        this.renderLeadsList(); // Refresh active state highlight
        this.renderSelectedLead();
    }

    renderSelectedLead() {
        const index = this.state.selectedLeadIndex;
        const lead = index !== null ? this.state.leads[index] : null;
        if (!lead) {
            this.dom.selectedLeadHeader.innerHTML = `
                <h3>Outbound Negotiation Log</h3>
                <p class="text-muted">Select a lead to inspect conversation</p>
            `;
            this.dom.crmChatMessages.innerHTML = `<div class="empty-state"><p>Select a lead to see conversation logs.</p></div>`;
            return;
        }
        const details = [lead.company, lead.email, lead.phone, lead.website, lead.address]
            .filter(Boolean)
            .join(' | ');
        const sourceLine = lead.sourceUrl
            ? `<p class="text-muted" style="font-size:0.75rem;">Source: ${lead.sourceUrl}</p>`
            : '';
        const enrollmentLine = lead.activeEnrollment
            ? `<p class="text-muted" style="font-size:0.75rem;">Campaign ${lead.activeEnrollment.campaignOrder}: ${lead.activeEnrollment.campaignName || 'Unknown'} · Step ${lead.activeEnrollment.currentStep} · ${lead.activeEnrollment.status}</p>`
            : '';

        this.dom.selectedLeadHeader.innerHTML = `
            <h3>Outbound Negotiation Log: ${lead.name}</h3>
            <p class="text-muted">${details}</p>
            ${sourceLine}
            ${enrollmentLine}
        `;

        const safeLeadUrl = (value) => {
            try {
                const url = new URL(String(value || '').trim());
                return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
            } catch (error) {
                return '';
            }
        };
        const leadWebsiteUrl = safeLeadUrl(lead.website);
        const leadSourceUrl = safeLeadUrl(lead.sourceUrl);
        const displayLeadAddress = (() => {
            const rawAddress = String(lead.address || '').trim();
            if (!rawAddress) return '';
            if (rawAddress.startsWith('{')) {
                try {
                    const parsed = JSON.parse(rawAddress);
                    const cityStateZip = [
                        parsed.city,
                        [parsed.state, parsed.postal_code].filter(Boolean).join(' ')
                    ].filter(Boolean).join(', ');
                    return [parsed.street, cityStateZip, parsed.country]
                        .map(part => String(part || '').trim())
                        .filter(Boolean)
                        .join(', ');
                } catch (error) {
                    return '';
                }
            }
            return rawAddress;
        })();
        const leadMetaChips = [
            lead.company ? `<span class="lead-meta-chip"><i class="fa-solid fa-building"></i>${this.escapeHtml(lead.company)}</span>` : '',
            lead.email ? `<span class="lead-meta-chip"><i class="fa-solid fa-envelope"></i>${this.escapeHtml(lead.email)}</span>` : '',
            lead.phone ? `<span class="lead-meta-chip"><i class="fa-solid fa-phone"></i>${this.escapeHtml(lead.phone)}</span>` : '',
            displayLeadAddress ? `<span class="lead-meta-chip"><i class="fa-solid fa-location-dot"></i>${this.escapeHtml(displayLeadAddress)}</span>` : ''
        ].filter(Boolean).join('');
        const leadActionLinks = [
            leadWebsiteUrl ? `<a class="lead-detail-link" href="${this.escapeHtml(leadWebsiteUrl)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-globe"></i>Website</a>` : '',
            leadSourceUrl ? `<a class="lead-detail-link" href="${this.escapeHtml(leadSourceUrl)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-map-location-dot"></i>Maps Source</a>` : ''
        ].filter(Boolean).join('');
        const canPauseCampaign = lead.activeEnrollment && lead.activeEnrollment.status === 'Active';
        const leadManagementActions = [
            canPauseCampaign
                ? `<button type="button" class="lead-action-button" title="Pause this lead's active drip campaign" onclick="App.pauseLeadCampaign(${lead.id})"><i class="fa-solid fa-pause"></i> Pause Campaign</button>`
                : '',
            `<button type="button" class="lead-action-button danger" title="Delete this lead from the pipeline" onclick="App.deleteLead(${lead.id})"><i class="fa-solid fa-trash"></i> Delete Lead</button>`
        ].filter(Boolean).join('');
        const safeEnrollmentLine = lead.activeEnrollment
            ? `<div class="lead-enrollment-note">Campaign ${this.escapeHtml(lead.activeEnrollment.campaignOrder)}: ${this.escapeHtml(lead.activeEnrollment.campaignName || 'Unknown')} &middot; Step ${this.escapeHtml(lead.activeEnrollment.currentStep)} &middot; ${this.escapeHtml(lead.activeEnrollment.status)}</div>`
            : '';

        this.dom.selectedLeadHeader.innerHTML = `
            <div class="selected-lead-title-row">
                <div>
                    <span class="selected-lead-eyebrow">Outbound Negotiation Log</span>
                    <h3>${this.escapeHtml(lead.name)}</h3>
                </div>
                ${lead.stage ? `<span class="lead-stage-pill">${this.escapeHtml(lead.stage)}</span>` : ''}
            </div>
            ${leadMetaChips ? `<div class="selected-lead-meta">${leadMetaChips}</div>` : ''}
            ${leadActionLinks ? `<div class="selected-lead-actions">${leadActionLinks}</div>` : ''}
            ${leadManagementActions ? `<div class="lead-management-actions">${leadManagementActions}</div>` : ''}
            ${safeEnrollmentLine}
        `;

        if (!lead.history || lead.history.length === 0) {
            this.dom.crmChatMessages.innerHTML = `<div class="empty-state"><p>No conversation logs found.</p></div>`;
            return;
        }

        this.dom.crmChatMessages.innerHTML = lead.history.map(m => {
            if (m.sender === 'agent-action') {
                return `<div class="chat-bubble agent-action">${m.text}</div>`;
            }
            const senderName = m.sender === 'agent' ? 'Sales Agent' : lead.name;
            const bubbleClass = m.sender === 'agent' ? 'agent-msg' : 'lead-msg';
            return `
                <div class="chat-bubble ${bubbleClass}">
                    <div class="msg-header">
                        <span>${senderName}</span>
                        <span>${m.time}</span>
                    </div>
                    <p>${m.text.replace(/\n/g, "<br>")}</p>
                </div>
            `;
        }).join("");
        
        // Auto scroll
        this.dom.crmChatMessages.scrollTop = this.dom.crmChatMessages.scrollHeight;
    }

    async pauseLeadCampaign(leadId) {
        const lead = this.state.leads.find(item => String(item.id) === String(leadId));
        if (!lead) return;

        if (!confirm(`Pause the active campaign for ${lead.name}?`)) return;

        try {
            const response = await fetch(`/api/leads/${leadId}/pause-campaign`, {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            if (!response.ok) {
                throw new Error(await this.parseApiError(response, "Could not pause campaign"));
            }

            const data = await response.json();
            this.appendConsoleLine('agent-sales', `Paused campaign outreach for ${lead.name}. ${data.pausedEnrollments || 0} enrollment(s) updated.`);
            await this.loadCrmStateFromServer();
            this.renderSelectedLead();
            this.renderCampaignWorkflowSummary();
        } catch (error) {
            console.error("[Lead Pause Error]", error);
            alert(`Failed to pause campaign: ${error.message}`);
        }
    }

    async deleteLead(leadId) {
        const lead = this.state.leads.find(item => String(item.id) === String(leadId));
        if (!lead) return;

        if (!confirm(`Delete ${lead.name} from the lead pipeline?\n\nThis removes their CRM record and campaign enrollment history, but it does not add them to the DNC blacklist.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
            if (!response.ok) {
                throw new Error(await this.parseApiError(response, "Could not delete lead"));
            }

            this.appendConsoleLine('agent-sales', `Deleted ${lead.name} from the lead pipeline.`);
            this.state.selectedLeadId = null;
            this.state.selectedLeadIndex = null;
            await this.loadCrmStateFromServer();
            this.renderSelectedLead();
            this.renderCampaignWorkflowSummary();
        } catch (error) {
            console.error("[Lead Delete Error]", error);
            alert(`Failed to delete lead: ${error.message}`);
        }
    }

    async runCrmPipelineNow() {
        const btn = this.dom.btnRunCrmPipeline;
        if (!btn) return;

        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Running Pipeline...`;

        try {
            const response = await fetch('/api/crm-pipeline/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trigger: 'manual-ui' })
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Pipeline run failed');
            }
            const data = await response.json();
            await this.loadCrmStateFromServer();
            this.renderVerificationQueue();
            this.renderCampaignsList();
            alert(`Pipeline run complete: ${JSON.stringify(data.result)}`);
        } catch (error) {
            console.error('CRM pipeline run failed:', error);
            alert(`Pipeline run failed: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-play"></i> Run Pipeline Now`;
        }
    }

    async parseApiError(response, fallbackMessage = "Request failed") {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            const errData = await response.json().catch(() => ({}));
            const details = errData.details ? ` Details: ${errData.details}` : "";
            return `${errData.error || fallbackMessage}${details}`;
        }

        const rawError = await response.text().catch(() => "");
        const cleaned = rawError.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        if (rawError.trim().startsWith("<!DOCTYPE html") || rawError.trim().startsWith("<html")) {
            return `${fallbackMessage}. The server returned an HTML error page instead of JSON, usually from an auth, proxy, or timeout layer.`;
        }
        return cleaned.slice(0, 400) || fallbackMessage;
    }

    async waitForLeadScrapeJob(jobId, niche) {
        const startedAt = Date.now();
        const maxWaitMs = 30 * 60 * 1000;
        let lastMessage = "";

        while (Date.now() - startedAt < maxWaitMs) {
            await new Promise(resolve => setTimeout(resolve, 4000));

            const response = await fetch(`/api/scrape-leads/jobs/${encodeURIComponent(jobId)}`);
            if (!response.ok) {
                throw new Error(await this.parseApiError(response, "Could not check lead scrape status"));
            }

            const data = await response.json();
            const job = data.job || {};
            if (job.message && job.message !== lastMessage) {
                lastMessage = job.message;
                this.appendConsoleLine('system', `Lead scrape status for "${niche}": ${job.message}`);
            }

            if (job.status === "completed") return job.result || {};
            if (job.status === "failed") {
                const details = job.details ? ` Details: ${job.details}` : "";
                throw new Error(`${job.error || "Lead scraping failed"}${details}`);
            }
        }

        throw new Error("Lead scraping is still running after 30 minutes. Refresh CRM state later or check server logs.");
    }

    // CRM Lead Scraper Execution
    async handleCrmScrape() {
        const niche = this.dom.crmScrapeNiche.value.trim();
        const count = parseInt(this.dom.crmScrapeCount.value) || 25;
        
        if (!niche) {
            alert("Please enter a target city and niche (e.g. Miami Realtors).");
            return;
        }

        this.dom.btnCrmScrape.disabled = true;
        this.dom.btnCrmScrape.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Scraping...`;
        this.appendConsoleLine('system', `AI Sales Agent starting outbound lead scraping for: "${niche}" (limit: ${count} leads)...`);

        try {
            const response = await fetch('/api/scrape-leads', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ niche, count })
            });

            if (!response.ok) {
                throw new Error(await this.parseApiError(response, "Lead scraping failed"));
            }
            const initialData = await response.json();
            const job = initialData.job || {};
            this.appendConsoleLine('system', `Lead scrape job queued${job.id ? ` (${job.id})` : ''}. You can keep using the CRM while it runs.`);

            const data = job.id
                ? await this.waitForLeadScrapeJob(job.id, niche)
                : initialData;
            
            if (data.leads && data.leads.length > 0) {
                this.state.leadsPage = 1;
                await this.loadCrmStateFromServer();
                
                let logMsg = `Scraped and loaded ${data.leads.length} leads for "${niche}" into pipeline via ${data.source || 'lead scraper'}.`;
                if (data.warnings && data.warnings.length) {
                    logMsg += ` Warnings: ${data.warnings.join(' | ')}`;
                }
                this.appendConsoleLine('agent-sales', logMsg);
                
                alert(`Successfully scraped and added ${data.leads.length} new leads!`);
            } else {
                const skipped = data.skipped ? ` Skipped: ${JSON.stringify(data.skipped)}` : '';
                const warnings = data.warnings && data.warnings.length ? ` Warnings: ${data.warnings.join(' | ')}` : '';
                this.appendConsoleLine('system', `No new name + email leads found for "${niche}".${skipped}${warnings}`);
                alert(`No new name + email leads found for that query.${skipped}${warnings}`);
            }
        } catch (error) {
            console.error("CRM Lead Scrape failed:", error);
            alert("Lead scraping failed: " + error.message);
        } finally {
            this.dom.btnCrmScrape.disabled = false;
            this.dom.btnCrmScrape.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Scrape Leads`;
        }
    }

    getDefaultCampaignCta() {
        const settings = this.state.crmAutopilot || {};
        return settings.demoVideoUrl || settings.youtubePageUrl || settings.salesPageUrl || this.state.bizWebsite || '';
    }

    applySalesAssetPlaceholders(text, campaign = {}) {
        const settings = this.state.crmAutopilot || {};
        const campaignCta = campaign.videoAsset || this.getDefaultCampaignCta();
        const bookingFallback = settings.bookingLink || settings.salesPageUrl || this.state.bizWebsite || 'reply with a couple times that work for you';
        return String(text || '')
            .replace(/\[CTA Link\]/g, campaignCta)
            .replace(/\[Booking Link\]/g, bookingFallback)
            .replace(/\[Calendar Link\]/g, bookingFallback)
            .replace(/\[Demo Link\]/g, settings.demoVideoUrl || settings.youtubePageUrl || campaignCta)
            .replace(/\[YouTube Link\]/g, settings.youtubePageUrl || settings.demoVideoUrl || campaignCta)
            .replace(/\[Sales Page\]/g, settings.salesPageUrl || campaignCta)
            .replace(/\[Website\]/g, this.state.bizWebsite || settings.salesPageUrl || campaignCta);
    }

    // CRM Outbound Campaign Creation
    async handleCrmCampaignCreate() {
        const name = this.dom.campaignName.value.trim();
        const type = this.dom.campaignType.value;
        const videoAsset = this.dom.campaignVideoAsset.value.trim() || this.getDefaultCampaignCta();
        const instructions = this.dom.campaignInstructions.value.trim();

        if (!name) {
            alert("Please enter a campaign name.");
            return;
        }

        this.dom.btnCreateCampaign.disabled = true;
        this.dom.btnCreateCampaign.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating Campaign...`;
        this.appendConsoleLine('system', `Campaign Builder drafting 3-step email drip campaign for "${name}"...`);

        try {
            const response = await fetch('/api/generate-campaign', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    campaignName: name,
                    campaignType: type,
                    customInstructions: instructions,
                    videoAsset,
                    bizName: this.state.bizName,
                    bizDesc: this.state.bizDesc,
                    bizWebsite: this.state.bizWebsite,
                    strategicContext: this.getStrategicContext()
                })
            });

            if (!response.ok) throw new Error("Campaign generator returned error");
            const data = await response.json();

            if (data.campaign) {
                if (this.state.crmAutopilot.autoApproveCampaigns) {
                    const sentCount = data.launchResult?.sentCount || 0;
                    const failedCount = data.launchResult?.failedCount || 0;
                    this.appendConsoleLine('system', `Launching campaign "${name}" immediately via Mailgun...`);
                    alert(`Campaign auto-approved. Sent Step 1 to ${sentCount} leads${failedCount ? ` (${failedCount} failed)` : ''}.`);
                } else {
                    alert(`Campaign generated! A campaign template for "${name}" is waiting in your Verification Queue.`);
                }
                
                await this.loadCrmStateFromServer();
                this.dom.crmCampaignForm.reset();
                this.populateCampaignSelectDropdowns();
                this.renderCampaignWorkflowSummary();
            }
        } catch (error) {
            console.error("Campaign creation failed:", error);
            alert("Failed to build campaign: " + error.message);
        } finally {
            this.dom.btnCreateCampaign.disabled = false;
            this.dom.btnCreateCampaign.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Generate AI Campaign Drip`;
        }
    }

    // Render Outbound Campaigns list
    renderCampaignsList() {
        const container = this.dom.crmCampaignsContainer;
        if (!container) return;
        this.renderCampaignWorkflowSummary();

        if (!this.state.campaignsList || this.state.campaignsList.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-secondary);">
                    <i class="fa-solid fa-bullhorn" style="font-size: 2.5rem; color: var(--purple); margin-bottom: 15px;"></i>
                    <p>No active email campaigns. Design one on the left!</p>
                </div>`;
            return;
        }

        container.innerHTML = this.state.campaignsList.map(c => `
            <div class="social-post-card" style="border-left: 3px solid var(--purple); padding:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <strong style="font-size:1rem; color:var(--text-primary);">${c.name}</strong>
                    <span class="badge success-badge">${c.status}</span>
                </div>
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:10px;">
                    <strong>Type:</strong> ${c.type.replace("-", " ")} · <strong>Created:</strong> ${c.dateCreated}
                </div>
                <div style="font-size:0.78rem; color:var(--text-secondary); margin-bottom:10px;">${this.renderCampaignRoleBadges(c.id)}</div>
                <p style="font-size:0.85rem; margin:8px 0; font-style:italic;">"${c.instructions.substring(0, 100)}..."</p>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
                    <button class="btn btn-outline btn-xs" onclick="App.showCampaignSteps(${c.id})"><i class="fa-solid fa-eye"></i> View Drip Copy</button>
                </div>
            </div>
        `).join("");
    }

    // Show campaign steps drip script
    showCampaignSteps(campaignId) {
        const campaign = this.state.campaignsList.find(c => c.id === campaignId);
        if (!campaign) return;

        let stepsHtml = campaign.steps.map((s, index) => `
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:8px; padding:16px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:0.8rem; color:var(--accent); font-weight:600; align-items:center;">
                    <span>Step ${s.step}</span>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span>Delay:</span>
                        <input type="text" class="campaign-edit-delay" data-index="${index}" value="${s.delay}" style="background:rgba(0,0,0,0.3); border:1px solid var(--border-color); border-radius:4px; padding:3px 8px; color:var(--text-primary); font-size:0.8rem; width:120px; text-align:right;">
                    </div>
                </div>
                <div style="margin-bottom:10px;">
                    <label style="font-size:0.75rem; font-weight:600; text-transform:uppercase; color:var(--text-secondary); display:block; margin-bottom:4px;">Subject</label>
                    <input type="text" class="campaign-edit-subject" data-index="${index}" value="${s.subject.replace(/"/g, '&quot;')}" style="background:rgba(0,0,0,0.3); border:1px solid var(--border-color); border-radius:6px; padding:8px 12px; color:var(--text-primary); font-size:0.85rem; width:100%; box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:0.75rem; font-weight:600; text-transform:uppercase; color:var(--text-secondary); display:block; margin-bottom:4px;">Email Body Script</label>
                    <textarea class="campaign-edit-body" data-index="${index}" style="background:rgba(0,0,0,0.3); border:1px solid var(--border-color); border-radius:6px; padding:10px 12px; color:var(--text-primary); font-size:0.85rem; width:100%; min-height:280px; box-sizing:border-box; font-family:inherit; resize:vertical; line-height:1.5;">${s.body}</textarea>
                </div>
            </div>
        `).join("");

        const stepsModal = document.createElement("div");
        stepsModal.className = "modal-overlay";
        stepsModal.id = "campaign-steps-modal";
        stepsModal.innerHTML = `
            <div class="modal-card" style="max-width: 800px; width:95%; max-height: 90vh; z-index: 1000;">
                <div class="modal-header">
                    <h3><i class="fa-solid fa-bullhorn"></i> Edit Campaign: ${campaign.name}</h3>
                    <button class="modal-close" onclick="document.getElementById('campaign-steps-modal').remove()">&times;</button>
                </div>
                <div class="modal-body" style="max-height:480px; overflow-y:auto; padding-right:8px;">
                    <div style="background:rgba(0,229,255,0.05); border:1px solid var(--accent); border-radius:6px; padding:10px 14px; margin-bottom:16px; font-size:0.8rem; color:var(--text-secondary);">
                        <i class="fa-solid fa-info-circle text-accent"></i> Make edits below. Use <strong>[CTA Link]</strong>, <strong>[Booking Link]</strong>, <strong>[Demo Link]</strong>, <strong>[Sales Page]</strong>, and <strong>[Lead Name]</strong> placeholders. New lead drafts will automatically fetch these templates.
                    </div>
                    ${stepsHtml}
                </div>
                <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:12px; margin-top:16px;">
                    <button class="btn btn-outline" onclick="document.getElementById('campaign-steps-modal').remove()">Cancel</button>
                    <button class="btn btn-primary" id="btn-save-campaign-edits"><i class="fa-solid fa-save"></i> Save Campaign Template</button>
                </div>
            </div>
        `;
        document.body.appendChild(stepsModal);

        // Bind save edits
        document.getElementById("btn-save-campaign-edits").addEventListener("click", () => {
            const subjectInputs = stepsModal.querySelectorAll(".campaign-edit-subject");
            const bodyAreas = stepsModal.querySelectorAll(".campaign-edit-body");
            const delayInputs = stepsModal.querySelectorAll(".campaign-edit-delay");

            subjectInputs.forEach(input => {
                const idx = parseInt(input.getAttribute("data-index"));
                campaign.steps[idx].subject = input.value.trim();
            });

            bodyAreas.forEach(area => {
                const idx = parseInt(area.getAttribute("data-index"));
                campaign.steps[idx].body = area.value;
            });

            delayInputs.forEach(input => {
                const idx = parseInt(input.getAttribute("data-index"));
                campaign.steps[idx].delay = input.value.trim();
            });

            this.saveState();
            this.renderCampaignsList();
            this.appendConsoleLine('system', `Campaign template "${campaign.name}" scripts updated successfully.`);
            stepsModal.remove();
            alert("Campaign template edits saved successfully!");
        });
    }

    // Render Manual Verification Queue
    renderVerificationQueue() {
        const container = this.dom.crmVerificationContainer;
        if (!container) return;

        this.updateVerificationBadge();

        if (!this.state.verificationQueue || this.state.verificationQueue.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-secondary); width:100%;">
                    <i class="fa-solid fa-circle-check" style="font-size: 2.5rem; color: var(--green); margin-bottom: 15px;"></i>
                    <p>Verification queue is empty! Start a campaign to generate outbound emails for review.</p>
                </div>`;
            return;
        }

        container.innerHTML = this.state.verificationQueue.map(c => {
            const targetLeadsCount = Number.isFinite(Number(c.targetLeadsCount)) ? Number(c.targetLeadsCount) : 0;
            const ctaLink = c.videoAsset || this.getDefaultCampaignCta();
            const ctaLabel = ctaLink || 'No CTA link saved';
            const stepsHtml = c.steps.map((s, index) => `
                <div style="background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.05); border-radius:6px; padding:12px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:0.75rem; color:var(--accent); font-weight:600; align-items:center;">
                        <span>Step ${s.step}</span>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span>Delay:</span>
                            <input type="text" class="queue-delay-${c.id}" data-step="${index}" value="${s.delay}" style="background:rgba(0,0,0,0.25); border:1px solid var(--border-color); border-radius:4px; padding:3px 6px; color:var(--text-primary); font-size:0.75rem; width:90px; text-align:right;">
                        </div>
                    </div>
                    <div style="margin-bottom:6px;">
                        <input type="text" class="queue-subject-${c.id}" data-step="${index}" value="${s.subject.replace(/"/g, '&quot;')}" style="background:rgba(0,0,0,0.25); border:1px solid var(--border-color); border-radius:4px; padding:6px 10px; color:var(--text-primary); font-size:0.8rem; width:100%; box-sizing:border-box;" placeholder="Subject Line">
                    </div>
                    <textarea class="queue-body-${c.id}" data-step="${index}" style="background:rgba(0,0,0,0.25); border:1px solid var(--border-color); border-radius:4px; padding:8px 10px; color:var(--text-primary); font-size:0.8rem; width:100%; min-height:260px; box-sizing:border-box; font-family:inherit; resize:vertical; line-height:1.4;">${this.applySalesAssetPlaceholders(s.body, c)}</textarea>
                </div>
            `).join("");

            return `
                <div class="social-post-card" style="border-top: 3px solid var(--orange); padding:20px; grid-column: 1 / -1; display:flex; flex-direction:column; gap:14px; width:100%; box-sizing:border-box;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:10px;">
                        <div>
                            <h4 style="margin:0; font-size:1.1rem; color:var(--text-primary);"><i class="fa-solid fa-bullhorn text-orange"></i> Campaign Review: ${c.name}</h4>
                            <p style="margin:4px 0 0 0; font-size:0.8rem; color:var(--text-secondary);">Targeting <strong>${targetLeadsCount}</strong> scraped leads in pipeline</p>
                            <p style="margin:4px 0 0 0; font-size:0.75rem; color:${ctaLink ? 'var(--text-secondary)' : 'var(--orange)'};">CTA Link: <strong>${ctaLabel}</strong></p>
                        </div>
                        <span class="badge warning-badge" style="padding:4px 8px;">Awaiting Launch</span>
                    </div>
                    
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px; margin:8px 0;">
                        ${stepsHtml}
                    </div>
                    
                    <div style="display:flex; justify-content:flex-end; gap:12px; border-top:1px solid rgba(255,255,255,0.05); padding-top:14px;">
                        <button class="btn btn-outline btn-del" style="color:var(--orange); border-color:var(--orange);" onclick="App.rejectCampaign(${c.id})"><i class="fa-solid fa-trash"></i> Cancel Campaign</button>
                        <button class="btn btn-primary" onclick="App.approveCampaign(${c.id})" ${targetLeadsCount === 0 ? 'disabled title="Scrape leads before launching this campaign."' : ''}><i class="fa-solid fa-paper-plane"></i> Approve & Send Step 1 to ${targetLeadsCount} Leads</button>
                    </div>
                </div>
            `;
        }).join("");
    }

    // Update Tab Badge Count
    updateVerificationBadge() {
        const badge = this.dom.crmVerificationBadge;
        if (!badge) return;

        const count = (this.state.verificationQueue || []).length;
        if (count > 0) {
            badge.innerText = count;
            badge.style.display = "inline-block";
        } else {
            badge.style.display = "none";
        }
    }

    // Approve Outbound Campaign
    async approveCampaign(id) {
        try {
            const campaignIndex = this.state.verificationQueue.findIndex(c => c.id === id);
            if (campaignIndex === -1) return;

            const campaign = this.state.verificationQueue[campaignIndex];
            const targetLeadsCount = Number.isFinite(Number(campaign.targetLeadsCount)) ? Number(campaign.targetLeadsCount) : 0;

            if (targetLeadsCount <= 0) {
                alert("There are no Scraped leads to email yet. Scrape/import leads first, then approve this campaign.");
                return;
            }

            if (!confirm(`Approve "${campaign.name}" and send Step 1 now to ${targetLeadsCount} Scraped leads?\n\nFollow-up steps stay attached to this campaign for later drip scheduling.`)) {
                return;
            }

            const subjectInputs = document.querySelectorAll(`.queue-subject-${id}`);
            const bodyAreas = document.querySelectorAll(`.queue-body-${id}`);
            const delayInputs = document.querySelectorAll(`.queue-delay-${id}`);

            const steps = [...campaign.steps];
            subjectInputs.forEach(input => {
                const stepIdx = parseInt(input.getAttribute("data-step"));
                steps[stepIdx].subject = input.value.trim();
            });

            bodyAreas.forEach(area => {
                const stepIdx = parseInt(area.getAttribute("data-step"));
                steps[stepIdx].body = area.value;
            });

            delayInputs.forEach(input => {
                const stepIdx = parseInt(input.getAttribute("data-step"));
                steps[stepIdx].delay = input.value.trim();
            });

            this.appendConsoleLine('system', `Launching campaign "${campaign.name}" via Mailgun...`);

            const res = await fetch(`/api/campaigns/${id}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    steps,
                    bizName: this.state.bizName,
                    bizWebsite: this.state.bizWebsite
                })
            });

            if (!res.ok) throw new Error("Launch failed");
            const result = await res.json();

            alert(`Campaign "${campaign.name}" approved. Sent Step 1 to ${result.sentCount || 0} leads${result.failedCount ? ` (${result.failedCount} failed)` : ''}.`);

            await this.loadCrmStateFromServer();
            this.renderVerificationQueue();
            this.renderCampaignsList();
            this.populateCampaignSelectDropdowns();
            this.renderCampaignWorkflowSummary();
        } catch (err) {
            console.error('[Launch Campaign Error]', err.message);
            alert("Failed to launch campaign: " + err.message);
        }
    }

    async rejectCampaign(id) {
        if (!confirm("Are you sure you want to cancel and delete this pending campaign?")) return;

        try {
            const res = await fetch(`/api/campaigns/${id}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error("Delete failed");

            await this.loadCrmStateFromServer();
            this.renderVerificationQueue();
            this.renderCampaignWorkflowSummary();
            this.appendConsoleLine('system', `Cancelled pending campaign.`);
        } catch (err) {
            console.error('[Delete Campaign Error]', err.message);
            alert("Failed to cancel campaign: " + err.message);
        }
    }

    renderSupportSessionsList() {
        this.dom.supportChatCount.innerText = `${this.state.supportSessions.length} Open`;
        this.dom.supportSessionsContainer.innerHTML = this.state.supportSessions.map((s, i) => `
            <div class="support-session-item ${this.state.selectedSupportIndex === i ? 'active' : ''}" data-index="${i}">
                <div class="session-header">
                    <span class="session-user">${s.user}</span>
                    <span class="session-time">Open</span>
                </div>
                <div class="session-last-msg">${s.lastMsg}</div>
            </div>
        `).join("");

        // Attach click listeners to session items
        this.dom.supportSessionsContainer.querySelectorAll(".support-session-item").forEach(item => {
            item.addEventListener("click", () => {
                const index = parseInt(item.getAttribute("data-index"));
                this.selectSupportSession(index);
            });
        });
    }

    selectSupportSession(index) {
        this.state.selectedSupportIndex = index;
        this.renderSupportSessionsList();
        
        const session = this.state.supportSessions[index];
        this.dom.selectedSupportHeader.innerHTML = `
            <h3>Website Chat: ${session.user}</h3>
            <p class="text-muted">Website chat conversation.</p>
        `;

        this.renderSupportChatBubbles(session);
    }

    renderSupportChatBubbles(session) {
        if (!session.history || session.history.length === 0) {
            this.dom.supportChatMessages.innerHTML = `<div class="empty-state"><p>No messages in chat session.</p></div>`;
            return;
        }

        this.dom.supportChatMessages.innerHTML = session.history.map(m => {
            const senderName = m.sender === 'agent' ? 'Support Agent' : 'Visitor';
            const bubbleClass = m.sender === 'agent' ? 'agent-msg' : 'lead-msg';
            return `
                <div class="chat-bubble ${bubbleClass}">
                    <div class="msg-header">
                        <span>${senderName}</span>
                        <span>${m.time}</span>
                    </div>
                    <p>${m.text.replace(/\n/g, "<br>")}</p>
                </div>
            `;
        }).join("");
        
        // Auto scroll
        this.dom.supportChatMessages.scrollTop = this.dom.supportChatMessages.scrollHeight;
    }

    appendConsoleLine(type, text) {
        const line = document.createElement("div");
        line.className = `console-line ${type}`;
        line.innerText = text;
        this.dom.consoleLog.appendChild(line);
        this.dom.consoleLog.scrollTop = this.dom.consoleLog.scrollHeight;
    }

    // Performance SVG Chart renderer
    drawPerformanceChart() {
        const container = document.getElementById("performance-chart");
        if (!container) return;

        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Clear old chart
        container.innerHTML = "";

        // Create SVG element
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        svg.style.overflow = "visible";

        // Chart Data (last 7 days conversions)
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const dataValues = [12, 18, 14, 22, 28, 20, 24]; // Lead counts
        
        const padding = { top: 20, right: 30, bottom: 30, left: 40 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        const maxVal = Math.max(...dataValues) * 1.2;
        
        // Calculate points
        const points = dataValues.map((val, idx) => {
            const x = padding.left + (idx / (dataValues.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - (val / maxVal) * chartHeight;
            return { x, y, day: days[idx], val };
        });

        // 1. Grid lines
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (i / 4) * chartHeight;
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", padding.left);
            line.setAttribute("y1", y);
            line.setAttribute("x2", padding.left + chartWidth);
            line.setAttribute("y2", y);
            line.setAttribute("stroke", "rgba(255, 255, 255, 0.04)");
            line.setAttribute("stroke-dasharray", "4,4");
            svg.appendChild(line);
        }

        // 2. Neon glow filter definitions
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        defs.innerHTML = `
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
            </linearGradient>
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        `;
        svg.appendChild(defs);

        // 3. Area under path
        let areaPathD = `M ${points[0].x} ${padding.top + chartHeight} `;
        points.forEach(pt => {
            areaPathD += `L ${pt.x} ${pt.y} `;
        });
        areaPathD += `L ${points[points.length - 1].x} ${padding.top + chartHeight} Z`;

        const areaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        areaPath.setAttribute("d", areaPathD);
        areaPath.setAttribute("fill", "url(#chartGradient)");
        svg.appendChild(areaPath);

        // 4. Line path
        let linePathD = `M ${points[0].x} ${points[0].y} `;
        for (let i = 1; i < points.length; i++) {
            linePathD += `L ${points[i].x} ${points[i].y} `;
        }

        const linePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        linePath.setAttribute("d", linePathD);
        linePath.setAttribute("fill", "none");
        linePath.setAttribute("stroke", "var(--accent)");
        linePath.setAttribute("stroke-width", "3");
        linePath.setAttribute("filter", "url(#neonGlow)");
        svg.appendChild(linePath);

        // 5. Data circles & labels
        points.forEach(pt => {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", pt.x);
            circle.setAttribute("cy", pt.y);
            circle.setAttribute("r", "5");
            circle.setAttribute("fill", "var(--bg-main)");
            circle.setAttribute("stroke", "var(--accent)");
            circle.setAttribute("stroke-width", "2");
            svg.appendChild(circle);

            // X-axis day labels
            const xText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            xText.setAttribute("x", pt.x);
            xText.setAttribute("y", padding.top + chartHeight + 20);
            xText.setAttribute("fill", "var(--text-secondary)");
            xText.setAttribute("font-size", "0.75rem");
            xText.setAttribute("text-anchor", "middle");
            xText.textContent = pt.day;
            svg.appendChild(xText);

            // Hover value labels
            const yText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            yText.setAttribute("x", pt.x);
            yText.setAttribute("y", pt.y - 10);
            yText.setAttribute("fill", "var(--text-primary)");
            yText.setAttribute("font-size", "0.7rem");
            yText.setAttribute("font-weight", "600");
            yText.setAttribute("text-anchor", "middle");
            yText.textContent = pt.val;
            svg.appendChild(yText);
        });

        container.appendChild(svg);
    }

    startAutomationTimers() {
        this.stopAutomationTimers();

        // CRM email automation is handled by the backend pipeline worker.
        // The browser only runs content drafting timers while the app is open.
        this.contentInterval = setInterval(() => this.runContentSchedulerTick(), 10000);
    }

    stopAutomationTimers() {
        if (this.dripInterval) clearInterval(this.dripInterval);
        if (this.contentInterval) clearInterval(this.contentInterval);
        this.dripInterval = null;
        this.contentInterval = null;
    }

    async respondToSupportSession(session) {
        // Show support agent is "thinking"
        const dotId = 'agent-support';
        if (this.dom.agentStatusDots[dotId]) {
            this.dom.agentStatusDots[dotId].className = 'status-indicator thinking';
        }
        if (this.dom.agentTasks[dotId]) {
            this.dom.agentTasks[dotId].innerText = `Formulating answer for visitor...`;
        }

const prompt = `You are the front-line client response agent for '${this.state.bizName}'.
Business profile: ${this.state.bizDesc}
Target audience: ${this.state.bizAudience}
Strategic context:
${this.getStrategicContext() || 'No deep research profile has been generated yet.'}
Visitor question: "${session.currentQuestion}"

Operating rules:
- Answer only from the business profile and common-sense product context.
- Do not invent integrations, pricing, guarantees, legal claims, or policies.
- If the answer is uncertain, say you can have the team confirm and offer to collect their email or book a short call.
- If the visitor shows buying intent, ask one concise qualifying follow-up or offer the next step.
- Keep the response warm, direct, and under 3 sentences.

Output only the visitor-facing reply.`;

        // 5-second typing simulator
        setTimeout(async () => {
            try {
                let answer = "";
                if (this.state.serverConfig && this.state.serverConfig.geminiConfigured) {
                    answer = await this.queryGeminiAPI(prompt);
                } else {
                    // Conservative support fallback when AI is unavailable.
                    if (session.currentQuestion.includes("zipForm")) {
                        answer = "That integration may be available, but I do not want to overstate it without confirming your setup. I can have the team verify zipForm support for your brokerage and send you the right next step.";
                    } else if (session.currentQuestion.includes("pricing")) {
                        answer = "Pricing depends on your volume and workflow, so the best next step is a quick fit check. I can help route you to a short demo so the team can quote the right package.";
                    } else {
                        answer = `Thank you for asking! Yes, ${this.state.bizName} handles that seamlessly by automating checkpoints and scanning disclosures. I'd be happy to escalate this to our team for a personalized walkthrough.`;
                    }
                }

                session.history.push({ sender: 'agent', text: answer, time: new Date().toLocaleTimeString() });
                session.lastMsg = answer;
                
                // Refresh views
                this.renderSupportSessionsList();
                const currentSession = this.state.supportSessions[this.state.selectedSupportIndex];
                if (currentSession === session) {
                    this.selectSupportSession(this.state.selectedSupportIndex);
                }

                this.appendConsoleLine('agent-support', `[Support Agent] Answered visitor query: "${answer.substring(0, 40)}..."`);
                
                // Reset status dots
                if (this.dom.agentStatusDots[dotId]) {
                    this.dom.agentStatusDots[dotId].className = 'status-indicator working';
                }
                if (this.dom.agentTasks[dotId]) {
                    this.dom.agentTasks[dotId].innerText = `Monitoring customer chat lines`;
                }

            } catch (err) {
                console.error("Support response simulation error:", err);
                if (this.dom.agentStatusDots[dotId]) {
                    this.dom.agentStatusDots[dotId].className = 'status-indicator idling';
                }
            }
        }, 5000);
    }

    // ----------------------------------------------------
    // MARKETING & ADVERTISING INTEGRATION METHODS
    // ----------------------------------------------------
    
    // Load Make Webhook settings
    async loadWebhookSettings() {
        try {
            const response = await fetch('/api/make-webhook');
            if (!response.ok) throw new Error("Failed to load webhook URL");
            const data = await response.json();
            const input = document.getElementById("settings-make-webhook");
            if (input) {
                input.value = data.makeWebhookUrl || "";
            }
        } catch (error) {
            console.error("Failed to load webhook settings:", error);
        }
    }

    // Save Make Webhook settings
    async saveWebhookSettings() {
        const input = document.getElementById("settings-make-webhook");
        if (!input) return;
        const url = input.value.trim();

        const btn = document.getElementById("btn-save-webhook");
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
        }

        try {
            const response = await fetch('/api/save-make-webhook', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ makeWebhookUrl: url })
            });
            if (!response.ok) throw new Error("Failed to save webhook URL");
            
            this.appendConsoleLine('system', `Make.com Webhook URL saved successfully: ${url || 'Cleared'}`);
            alert("Make.com Webhook settings saved successfully!");
            this.checkIntegrationStatuses();
        } catch (error) {
            console.error("Failed to save webhook settings:", error);
            alert("Failed to save webhook settings: " + error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `Save Webhook URL`;
            }
        }
    }

    // Check integration connection statuses and update UI
    async checkIntegrationStatuses() {
        try {
            const response = await fetch('/api/integration-statuses');
            if (!response.ok) throw new Error("Failed to check statuses");
            const statuses = await response.json();
            
            const platforms = ['linkedin', 'twitter', 'google', 'meta'];
            platforms.forEach(p => {
                const badge = document.getElementById(`webhook-${p}-badge`);
                if (!badge) return;
                
                const isConnected = statuses[p];
                if (isConnected) {
                    badge.innerText = "Active / Routing";
                    badge.className = "badge success-badge";
                } else {
                    badge.innerText = "Inactive";
                    badge.className = "badge";
                }
            });
        } catch (error) {
            console.error("Failed to check integration statuses:", error);
        }
    }

    // Test Webhook Connection
    async testWebhookConnection() {
        const btn = document.getElementById("btn-test-webhook");
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Dispatching...`;
        }

        try {
            const response = await fetch('/api/test-webhook', {
                method: "POST"
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to dispatch test payload");
            }
            
            const data = await response.json();
            if (data.success) {
                this.appendConsoleLine('system', `Make.com Webhook test succeeded! Server responded: "${data.message}"`);
                alert(data.message);
            } else {
                throw new Error(data.error || "Unknown webhook connection error");
            }
        } catch (error) {
            console.error("Test webhook failed:", error);
            this.appendConsoleLine('system', `Make.com Webhook test failed: ${error.message}`);
            alert("Webhook test failed:\n" + error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send Test Payload`;
            }
        }
    }
    // Generate AI image for a social post using the backend image pipeline.
    async generatePostImage(postId) {
        let post = this.state.socialPosts.find(p => String(p.id) === String(postId));
        if (!post) return;

        const btn = document.querySelector(`[onclick="App.generatePostImage('${postId}')"], [onclick="App.generatePostImage(${postId})"]`);
        let oldHtml = "";
        if (btn) {
            oldHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> AI Writing...`;
        }

        this.appendConsoleLine('system', `AI Content Agent analyzing post text to write visual concept...`);

        let defaultPrompt = "";
        try {
            const response = await fetch('/api/generate-image-prompt', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: post.body })
            });
            if (response.ok) {
                const data = await response.json();
                defaultPrompt = data.visualPrompt;
            } else {
                throw new Error("API failed");
            }
        } catch (err) {
            console.warn("Fallback to basic prompt generation:", err.message);
            defaultPrompt = this.generatePromptFromBody(post.body);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = oldHtml;
            }
        }

        const userPrompt = prompt("Describe the image you want to generate for this post:", defaultPrompt);
        if (userPrompt === null) return;
        const cleanPrompt = userPrompt.trim() || defaultPrompt;

        this.appendConsoleLine('system', `AI Content Agent generating image for Post #${postId}...`);
        this.appendConsoleLine('agent-content', `Creating visual asset: "${cleanPrompt}"`);

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Rendering...`;
        }

        try {
            const response = await fetch('/api/generate-image', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ promptText: cleanPrompt })
            });

            if (!response.ok) {
                throw new Error("Failed to render image on server");
            }

            const data = await response.json();
            post.mediaUrl = data.mediaUrl;
            this.saveState();
            this.renderSocialPostsGrid();
            this.appendConsoleLine('system', `Successfully attached AI image to Post #${postId}.`);
        } catch (err) {
            console.error("AI Image Generation failed:", err);
            alert("Failed to generate AI image: " + err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = oldHtml;
            }
        }
    }

    async generatePostVideo(postId) {
        let post = this.state.socialPosts.find(p => String(p.id) === String(postId));
        if (!post) return;

        const btn = document.querySelector(`[onclick="App.generatePostVideo('${postId}')"], [onclick="App.generatePostVideo(${postId})"]`);
        const oldHtml = btn ? btn.innerHTML : "";

        const defaultPrompt = this.generateVideoPromptFromPost(post);
        const userPrompt = prompt("Describe the vertical video you want to generate for this post:", defaultPrompt);
        if (userPrompt === null) return;
        const cleanPrompt = userPrompt.trim() || defaultPrompt;

        this.appendConsoleLine('system', `AI Content Agent generating vertical video for Post #${postId}...`);
        this.appendConsoleLine('agent-content', `Creating video asset: "${cleanPrompt}"`);

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Rendering...`;
        }

        try {
            const response = await fetch('/api/generate-video', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ promptText: cleanPrompt, aspectRatio: "9:16" })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to render video on server");
            }

            post.mediaUrl = data.mediaUrl;
            post.mediaModel = data.model || 'gemini-omni-flash-preview';
            this.saveState();
            this.renderSocialPostsGrid();
            this.appendConsoleLine('system', `Successfully attached AI video to Post #${postId}.`);
        } catch (err) {
            console.error("AI Video Generation failed:", err);
            alert("Failed to generate AI video: " + err.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = oldHtml;
            }
        }
    }

    generatePromptFromBody(body) {
        let promptText = body
            .replace(/#\w+/g, '') 
            .replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '') 
            .replace(/\r?\n|\r/g, ' ') 
            .replace(/['"“”`]/g, '') 
            .trim();
        
        let sentence = promptText.split(/[.!?]/)[0].trim();
        if (sentence.length < 10) {
            sentence = promptText;
        }
        if (sentence.length > 80) {
            sentence = sentence.substring(0, 80).trim() + "...";
        }
        
        return `Realistic editorial photo about ${sentence}, candid real-world business environment, natural window light, 35mm documentary photography, believable details, imperfect desk or workspace, no text overlays, no logos, no glossy 3D render, no plastic skin, no extra fingers, not stock-photo posing`;
    }

    generateVideoPromptFromPost(post) {
        const businessName = this.state.bizName || "the business";
        let postText = (post.body || "")
            .replace(/#\w+/g, '')
            .replace(/\r?\n|\r/g, ' ')
            .replace(/['"â€œâ€`]/g, '')
            .trim();

        if (postText.length > 420) {
            postText = postText.substring(0, 420).trim() + "...";
        }

        return `Create a 6-8 second vertical 9:16 social media video for ${businessName}. Topic: ${postText}. Make it feel like authentic modern short-form footage with natural camera movement, realistic lighting, clear subject action, emotionally engaging pacing, and no text overlays, captions, logos, watermarks, distorted hands, or surreal AI artifacts.`;
    }

    removePostImage(postId, listName) {
        let post = null;
        if (listName === 'socialPosts') {
            post = this.state.socialPosts.find(p => String(p.id) === String(postId));
        } else if (listName === 'scheduledPosts') {
            post = this.state.scheduledPosts.find(p => String(p.id) === String(postId));
        }

        if (post) {
            delete post.mediaUrl;
            this.saveState();
            if (listName === 'socialPosts') this.renderSocialPostsGrid();
            if (listName === 'scheduledPosts') this.renderScheduledQueue();
            this.appendConsoleLine('system', `Removed image from Post #${postId}.`);
        }
    }

    clearAllDrafts() {
        if (!confirm("Are you sure you want to clear all drafts from your list?")) return;
        this.state.socialPosts = [];
        this.saveState();
        this.renderSocialPostsGrid();
        this.appendConsoleLine('system', 'Cleared all social post drafts.');
    }

    startEditPost(postId) {
        this.editingPostId = String(postId);
        this.renderSocialPostsGrid();
        this.renderScheduledQueue();
    }

    cancelEditPost() {
        this.editingPostId = null;
        this.renderSocialPostsGrid();
        this.renderScheduledQueue();
    }

    saveEditedPost(postId) {
        const textarea = document.getElementById(`edit-body-${postId}`);
        if (!textarea) return;

        const newText = textarea.value.trim();
        if (!newText) {
            alert("Post body cannot be empty.");
            return;
        }

        let post = this.state.socialPosts.find(p => String(p.id) === String(postId));
        let listName = 'socialPosts';

        if (!post) {
            post = this.state.scheduledPosts.find(p => String(p.id) === String(postId));
            listName = 'scheduledPosts';
        }

        if (post) {
            post.body = newText;
            this.editingPostId = null;
            this.saveState();
            this.renderSocialPostsGrid();
            this.renderScheduledQueue();
            this.appendConsoleLine('agent-content', `Saved changes to post draft #${postId}.`);
        } else {
            alert("Could not find post to save.");
        }
    }

    clonePostToDrafts(postId) {
        const post = this.state.publishedPosts.find(p => String(p.id) === String(postId));
        if (!post) {
            alert("Could not find published post to clone.");
            return;
        }

        const newDraft = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            platform: post.platform,
            time: "Drafted from Sent",
            body: post.body,
            mediaUrl: post.mediaUrl,
            impressions: 0,
            likes: 0,
            comments: 0
        };

        this.state.socialPosts.unshift(newDraft);
        this.saveState();
        this.renderSocialPostsGrid();
        
        this.appendConsoleLine('agent-content', `Cloned published/failed post #${postId} back to drafts.`);
        alert("Post successfully copied back to your Drafts!");
        
        const draftsTab = Array.from(this.dom.studioTabs).find(t => t.getAttribute("data-target") === "studio-drafts");
        if (draftsTab) draftsTab.click();
    }
}

// Instantiate App
const App = new AutopilotApp();
