/**
 * Seed script for Popouts demo – fictious Silicon Valley executive
 *
 * HOW TO RUN:
 * 1. Open the Popouts extension (popup or sidepanel)
 * 2. Right-click inside it → Inspect
 * 3. Go to the Console tab
 * 4. Copy-paste this entire script and press Enter
 *
 * Pre-populates:
 * - 1:1s with Jordan Chen, Maya Patel, David Okonkwo
 * - Recurring: Weekly Product Review, Staff Sync, Board Prep
 * - Adhoc: Flux AI Kickoff, Design vs PM Conflict, Platform Unblock, Q2 Priorities
 *
 * DURING RECORDING: Add a new note to any meeting to demo AI extraction.
 */

(async function seedDemoData() {
  const CLEAR_EXISTING = true; // Set to false to add demo data without clearing

  const dbName = 'MeetingNotesDB';
  const req = indexedDB.open(dbName);

  req.onerror = () => console.error('Failed to open DB:', req.error);
  req.onsuccess = async () => {
    const db = req.result;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const tx = db.transaction(
      ['meetingSeries', 'meetingInstances', 'agendaItems', 'actionItems'],
      'readwrite'
    );

    const seriesStore = tx.objectStore('meetingSeries');
    const instancesStore = tx.objectStore('meetingInstances');
    const agendaStore = tx.objectStore('agendaItems');
    const actionsStore = tx.objectStore('actionItems');

    if (CLEAR_EXISTING) {
      await Promise.all([
        clearStore(actionsStore),
        clearStore(agendaStore),
        clearStore(instancesStore),
        clearStore(seriesStore),
      ]);
    }

    // --- 1:1 with Jordan Chen (Engineering lead) ---
    const series1Id = await add(seriesStore, {
      name: '1:1 with Jordan Chen',
      type: '1:1s',
      createdAt: new Date(),
    });

    const inst1Id = await add(instancesStore, {
      seriesId: series1Id,
      date: yesterday,
      notes: [
        {
          text: 'Jordan shared concerns about the infra migration timeline. The Kubernetes cutover is blocked on security sign-off from the CISO team. He will follow up with Sarah in InfoSec by Friday.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
        {
          text: 'Discussed Jordan\'s interest in leading the platform reliability initiative. He wants to grow into an architect role. Agreed to pair him with Elena for the next quarter.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
      ],
      extractedAt: new Date().toISOString(),
    });

    await add(agendaStore, { seriesId: series1Id, text: 'Infra migration blockers', status: 'closed', createdAt: new Date(), closedAt: new Date() });
    await add(agendaStore, { seriesId: series1Id, text: 'Career growth – architect path', status: 'closed', createdAt: new Date(), closedAt: new Date() });

    await add(actionsStore, { seriesId: series1Id, instanceId: inst1Id, text: 'Jordan to follow up with Sarah in InfoSec on security sign-off by Friday', assignee: null, dueDate: null, status: 'open', createdAt: new Date(), closedAt: null });
    await add(actionsStore, { seriesId: series1Id, instanceId: inst1Id, text: 'Pair Jordan with Elena for platform reliability initiative next quarter', assignee: null, dueDate: null, status: 'open', createdAt: new Date(), closedAt: null });

    // --- 1:1 with Maya Patel (Product) ---
    const series2Id = await add(seriesStore, {
      name: '1:1 with Maya Patel',
      type: '1:1s',
      createdAt: new Date(),
    });

    const inst2Id = await add(instancesStore, {
      seriesId: series2Id,
      date: yesterday,
      notes: [
        {
          text: 'Maya\'s team is behind on the checkout flow redesign. The design system handoff from the brand team was delayed. She needs me to escalate to Marcus so they prioritize the token updates.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
        {
          text: 'Maya asked about the PM rotation program. She wants to spend a quarter with the growth team to round out her experience. I will check with HR on the process and timeline.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
      ],
      extractedAt: new Date().toISOString(),
    });

    await add(agendaStore, { seriesId: series2Id, text: 'Checkout redesign timeline', status: 'closed', createdAt: new Date(), closedAt: new Date() });
    await add(agendaStore, { seriesId: series2Id, text: 'PM rotation program', status: 'open', createdAt: new Date(), closedAt: null });

    await add(actionsStore, { seriesId: series2Id, instanceId: inst2Id, text: 'Escalate to Marcus to prioritize design system token updates for checkout flow', assignee: null, dueDate: null, status: 'open', createdAt: new Date(), closedAt: null });
    await add(actionsStore, { seriesId: series2Id, instanceId: inst2Id, text: 'Check with HR on PM rotation program process and timeline', assignee: null, dueDate: null, status: 'open', createdAt: new Date(), closedAt: null });

    // --- 1:1 with David Okonkwo (Data Science) ---
    const series3Id = await add(seriesStore, {
      name: '1:1 with David Okonkwo',
      type: '1:1s',
      createdAt: new Date(),
    });

    const inst3Id = await add(instancesStore, {
      seriesId: series3Id,
      date: today,
      notes: [
        {
          text: 'David\'s ML pipeline is hitting rate limits on the Snowflake connector. He needs a higher tier or a dedicated connection. I will talk to the data platform team about options.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
        {
          text: 'David proposed a new churn prediction model that could improve retention by 12%. Wants to run a pilot with the lifecycle team. I will connect him with Priya from growth.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
      ],
      extractedAt: new Date().toISOString(),
    });

    await add(agendaStore, { seriesId: series3Id, text: 'ML pipeline rate limits', status: 'closed', createdAt: new Date(), closedAt: new Date() });
    await add(agendaStore, { seriesId: series3Id, text: 'Churn prediction pilot', status: 'open', createdAt: new Date(), closedAt: null });

    await add(actionsStore, { seriesId: series3Id, instanceId: inst3Id, text: 'Talk to data platform team about Snowflake connector tier or dedicated connection', assignee: null, dueDate: null, status: 'open', createdAt: new Date(), closedAt: null });
    await add(actionsStore, { seriesId: series3Id, instanceId: inst3Id, text: 'Connect David with Priya from growth for churn prediction pilot', assignee: null, dueDate: null, status: 'open', createdAt: new Date(), closedAt: null });

    // --- Weekly Product Review ---
    const series4Id = await add(seriesStore, {
      name: 'Weekly Product Review',
      type: 'recurring',
      createdAt: new Date(),
    });

    const inst4Id = await add(instancesStore, {
      seriesId: series4Id,
      date: yesterday,
      notes: [
        {
          text: 'Search v2 is at 78% completion. The faceted filters are done but the relevance tuning is blocked on the ML team. Jordan to sync with David on the ranking model.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
        {
          text: 'Maya to share the Q2 roadmap draft by EOW. We need to decide between the enterprise SSO initiative and the self-serve onboarding flow. Board wants clarity before the March review.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
      ],
      extractedAt: new Date().toISOString(),
    });

    await add(agendaStore, { seriesId: series4Id, text: 'Search v2 status', status: 'closed', createdAt: new Date(), closedAt: new Date() });
    await add(agendaStore, { seriesId: series4Id, text: 'Q2 roadmap draft', status: 'open', createdAt: new Date(), closedAt: null });

    await add(actionsStore, { seriesId: series4Id, instanceId: inst4Id, text: 'Jordan to sync with David on search relevance ranking model', assignee: null, dueDate: null, status: 'closed', createdAt: new Date(), closedAt: new Date() });
    await add(actionsStore, { seriesId: series4Id, instanceId: inst4Id, text: 'Maya to share Q2 roadmap draft by EOW', assignee: null, dueDate: null, status: 'open', createdAt: new Date(), closedAt: null });

    // --- Staff Sync ---
    const series5Id = await add(seriesStore, {
      name: 'Staff Sync',
      type: 'recurring',
      createdAt: new Date(),
    });

    const inst5Id = await add(instancesStore, {
      seriesId: series5Id,
      date: yesterday,
      notes: [
        {
          text: 'Reviewed headcount plan for Q2. We have two open reqs – senior backend and staff designer. Marcus will own the design hire; Jordan will drive the eng hire.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
        {
          text: 'Team morale check – the reorg rumors are causing anxiety. I will send a clarifying note to the org and schedule a town hall for next week.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
      ],
      extractedAt: new Date().toISOString(),
    });

    await add(agendaStore, { seriesId: series5Id, text: 'Headcount and hiring', status: 'closed', createdAt: new Date(), closedAt: new Date() });
    await add(agendaStore, { seriesId: series5Id, text: 'Reorg rumors – team morale', status: 'open', createdAt: new Date(), closedAt: null });

    await add(actionsStore, { seriesId: series5Id, instanceId: inst5Id, text: 'Send clarifying note on reorg and schedule town hall for next week', assignee: null, dueDate: null, status: 'open', createdAt: new Date(), closedAt: null });

    // --- Board Prep – Q2 Strategy ---
    const series6Id = await add(seriesStore, {
      name: 'Board Prep – Q2 Strategy',
      type: 'recurring',
      createdAt: new Date(),
    });

    const inst6Id = await add(instancesStore, {
      seriesId: series6Id,
      date: twoDaysAgo,
      notes: [
        {
          text: 'Board deck focus: 1) Q1 revenue beat vs plan, 2) enterprise pipeline health, 3) Flux AI partnership timeline and risks. Need CFO to finalize numbers by Tuesday.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
        {
          text: 'Investor asked about our international expansion. We should have a one-pager on LATAM and EU readiness. I will ask the strategy team to draft it.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
      ],
      extractedAt: new Date().toISOString(),
    });

    await add(agendaStore, { seriesId: series6Id, text: 'Board deck – Q1 results', status: 'closed', createdAt: new Date(), closedAt: new Date() });
    await add(agendaStore, { seriesId: series6Id, text: 'International expansion one-pager', status: 'open', createdAt: new Date(), closedAt: null });

    await add(actionsStore, { seriesId: series6Id, instanceId: inst6Id, text: 'CFO to finalize board numbers by Tuesday', assignee: null, dueDate: null, status: 'closed', createdAt: new Date(), closedAt: new Date() });
    await add(actionsStore, { seriesId: series6Id, instanceId: inst6Id, text: 'Ask strategy team to draft LATAM and EU readiness one-pager', assignee: null, dueDate: null, status: 'open', createdAt: new Date(), closedAt: null });

    // --- Flux AI Integration Kickoff (new project) ---
    const series7Id = await add(seriesStore, {
      name: 'Flux AI Integration Kickoff',
      type: 'adhoc',
      createdAt: new Date(),
    });

    const inst7Id = await add(instancesStore, {
      seriesId: series7Id,
      date: twoDaysAgo,
      notes: [
        {
          text: 'Flux AI partnership – they will provide the inference API. We need to decide between white-label vs co-branded. Legal is reviewing the MSA. Target go-live: March 15.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
        {
          text: 'Engineering needs a dedicated Slack channel with Flux\'s dev team. Jordan will set it up. We also need to align on the data residency requirements – they want EU data in EU.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
      ],
      extractedAt: new Date().toISOString(),
    });

    await add(agendaStore, { seriesId: series7Id, text: 'Flux AI – white-label vs co-branded', status: 'open', createdAt: new Date(), closedAt: null });

    await add(actionsStore, { seriesId: series7Id, instanceId: inst7Id, text: 'Jordan to set up Slack channel with Flux dev team', assignee: null, dueDate: null, status: 'closed', createdAt: new Date(), closedAt: new Date() });
    await add(actionsStore, { seriesId: series7Id, instanceId: inst7Id, text: 'Align on data residency – EU data in EU for Flux integration', assignee: null, dueDate: null, status: 'open', createdAt: new Date(), closedAt: null });

    // --- Design vs PM Conflict Resolution ---
    const series8Id = await add(seriesStore, {
      name: 'Design vs PM Conflict Resolution',
      type: 'adhoc',
      createdAt: new Date(),
    });

    const inst8Id = await add(instancesStore, {
      seriesId: series8Id,
      date: yesterday,
      notes: [
        {
          text: 'Tension between design and PM on the onboarding flow. Design wants a 5-step wizard; PM wants a single-page form. We agreed to A/B test both and let data decide. Two-week experiment.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
        {
          text: 'Marcus and Maya will co-present the results to the team. I will moderate the retro to ensure we focus on outcomes, not blame.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
      ],
      extractedAt: new Date().toISOString(),
    });

    await add(agendaStore, { seriesId: series8Id, text: 'Onboarding flow – design vs PM', status: 'closed', createdAt: new Date(), closedAt: new Date() });

    await add(actionsStore, { seriesId: series8Id, instanceId: inst8Id, text: 'Marcus and Maya to co-present A/B test results to team', assignee: null, dueDate: null, status: 'open', createdAt: new Date(), closedAt: null });

    // --- Platform Unblock Session ---
    const series9Id = await add(seriesStore, {
      name: 'Platform Unblock Session',
      type: 'adhoc',
      createdAt: new Date(),
    });

    const inst9Id = await add(instancesStore, {
      seriesId: series9Id,
      date: yesterday,
      notes: [
        {
          text: 'Platform team was blocked on the CDN migration. The DNS cutover requires a maintenance window. I approved the Saturday 2am PT slot. Jordan to send the customer comms.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
        {
          text: 'The API gateway upgrade is unblocked – we got the security exception from CISO. Elena can proceed with the rollout. Target: end of week.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
      ],
      extractedAt: new Date().toISOString(),
    });

    await add(agendaStore, { seriesId: series9Id, text: 'CDN migration maintenance window', status: 'closed', createdAt: new Date(), closedAt: new Date() });

    await add(actionsStore, { seriesId: series9Id, instanceId: inst9Id, text: 'Jordan to send customer comms for CDN maintenance window', assignee: null, dueDate: null, status: 'open', createdAt: new Date(), closedAt: null });
    await add(actionsStore, { seriesId: series9Id, instanceId: inst9Id, text: 'Elena to proceed with API gateway rollout by end of week', assignee: null, dueDate: null, status: 'open', createdAt: new Date(), closedAt: null });

    // --- Q2 Priorities Alignment ---
    const series10Id = await add(seriesStore, {
      name: 'Q2 Priorities Alignment',
      type: 'adhoc',
      createdAt: new Date(),
    });

    const inst10Id = await add(instancesStore, {
      seriesId: series10Id,
      date: twoDaysAgo,
      notes: [
        {
          text: 'Q2 priorities: 1) Flux AI launch, 2) Enterprise SSO, 3) Search v2 GA. We are deprioritizing the mobile redesign and the partner API – moving those to Q3.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
        {
          text: 'Need to communicate the reprioritization to the teams. I will draft the memo and share in the all-hands. Stakeholders to be informed by EOD Friday.',
          createdAt: new Date().toISOString(),
          actionStatus: 'action_completed',
          updatedAt: new Date().toISOString(),
        },
      ],
      extractedAt: new Date().toISOString(),
    });

    await add(agendaStore, { seriesId: series10Id, text: 'Q2 prioritization – what moves to Q3', status: 'closed', createdAt: new Date(), closedAt: new Date() });

    await add(actionsStore, { seriesId: series10Id, instanceId: inst10Id, text: 'Draft reprioritization memo and share in all-hands', assignee: null, dueDate: null, status: 'closed', createdAt: new Date(), closedAt: new Date() });
    await add(actionsStore, { seriesId: series10Id, instanceId: inst10Id, text: 'Inform stakeholders of Q2 reprioritization by EOD Friday', assignee: null, dueDate: null, status: 'open', createdAt: new Date(), closedAt: null });

    db.close();
    console.log('✅ Demo data seeded! Reload the extension popup/sidepanel to see it.');
    console.log('Meetings: 3x 1:1s (Jordan, Maya, David), Weekly Product Review, Staff Sync, Board Prep, Flux AI Kickoff, Design vs PM Conflict, Platform Unblock, Q2 Priorities');
    console.log('During recording: Add a new note to any meeting to demo AI extraction.');
  };

  function add(store, obj) {
    return new Promise((resolve, reject) => {
      const req = store.add(obj);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function clearStore(store) {
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
})();
