# Onboarding Skill

## Trigger

This skill activates on Jimmy's first run, or when the user explicitly asks to go through the onboarding/setup process.

## Steps

### 1. Welcome the User

Greet the user warmly. Introduce Jimmy as their AI-powered team management system. Keep it brief and friendly.

Example: "Welcome to Jimmy! I'm here to help you build and manage your AI-powered team. Let's get you set up."

### 2. Learn About Their Projects

Ask the user:
- What projects are they working on?
- What kind of tasks do they want to automate?
- What is their primary use case? (development, content creation, research, operations, etc.)

Listen carefully — this information shapes the recommendations that follow.

### 3. Ask About Preferred Engine

Ask which AI engine they prefer:
- **Claude** — Anthropic's Claude, good for nuanced reasoning, writing, and code
- **Codex** — OpenAI's Codex, good for code generation and technical tasks

Explain that they can use both — different employees can run on different engines. But they need a default.

### 4. Check for OpenClaw Migration

Check if the directory `~/.openclaw/` exists.

#### If OpenClaw Exists: Offer Migration

Tell the user: "I detected an existing OpenClaw installation. Would you like to migrate your setup to Jimmy?"

If the user agrees, perform a full analysis:

1. **Read OpenClaw configuration**: Read `~/.openclaw/openclaw.json` to understand their current setup.
2. **Scan cron jobs**: Read `~/.openclaw/cron/jobs.json` to find scheduled tasks.
3. **Scan skills**: List all directories under `~/.openclaw/skills/` and read each SKILL.md.
4. **Scan memory**: Read files under `~/.openclaw/memory/` to find stored context.
5. **Scan knowledge**: Read files under `~/.openclaw/knowledge/` to find reference documents.

Present a summary of what was found:
- Number of skills and their names
- Number of cron jobs and their schedules
- Knowledge base entries
- Memory entries

Recommend what to migrate, with reasoning for each item. For example:
- "You have 3 skills — all look compatible and I recommend migrating them."
- "You have 2 cron jobs — the daily-report job uses a format that needs conversion."
- "Your knowledge base has 5 entries — all can be migrated as-is."

Let the user pick what to migrate. Do not migrate anything without their approval.

Execute the migration for approved items:
- **Skills**: Copy SKILL.md files to `~/.jimmy/skills/<name>/SKILL.md`. Adapt any file path references from `~/.openclaw/` to `~/.jimmy/`.
- **Cron jobs**: Convert job objects to Jimmy's cron format and add them to `~/.jimmy/cron/jobs.json`. Adapt any OpenClaw-specific fields.
- **Knowledge**: Copy knowledge files to `~/.jimmy/knowledge/`.
- **Memory**: Copy memory files to `~/.jimmy/memory/`.

Report what was migrated successfully and flag anything that needs manual attention.

#### If No OpenClaw: Fresh Setup

Suggest starting with a simple organization structure based on what the user told you about their projects.

### 5. Scaffold Initial Organization

Based on the user's projects and needs, suggest an initial org structure. For example:

- A solo developer might want: one `engineering` department with a `dev-assistant` employee
- A content creator might want: `content` and `research` departments
- A startup founder might want: `engineering`, `marketing`, and `operations`

For each suggested department:
1. Create the department directory under `org/`
2. Create `department.yaml` with name, displayName, and description
3. Create an empty `board.json`

For each suggested employee:
1. Create the persona YAML with appropriate name, rank, engine, model, and persona
2. Tailor the persona description to the user's specific projects and needs

Always confirm the proposed structure with the user before creating anything.

### 6. Suggest Initial Cron Jobs

Based on the user's projects, suggest useful recurring jobs. Examples:
- Daily standup summary (review boards, summarize progress)
- Weekly report generation
- Regular code review reminders
- Content calendar checks

For each suggestion, explain what it does and why it might be useful. Only create the jobs the user approves.

### 7. Wrap Up

Present a summary of everything that was set up:
- Departments created and their employees
- Cron jobs scheduled
- Skills available
- Any migrated OpenClaw data

Suggest next steps:
- "Try delegating a task to one of your employees"
- "Ask me to create a custom skill for something you do often"
- "Set up a Slack connector to get updates in your workspace"

## Error Handling

- If `~/.jimmy/` directory structure is incomplete, create missing directories as needed (org/, cron/, skills/, tmp/, logs/).
- If the user seems overwhelmed, simplify — suggest just one department and one employee to start.
- If OpenClaw migration fails for specific items, continue with the rest and report failures at the end.
- If the user wants to skip onboarding, respect that and exit gracefully.
