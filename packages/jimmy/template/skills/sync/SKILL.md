---
name: sync
description: Sync the latest conversation with an employee into your context
---

# Sync Skill

## Trigger

This skill activates when the user sends `/sync @employee-name`. It pulls in the most recent conversation with the specified employee so you can respond with full awareness of what was discussed.

## How It Works

1. The user types `/sync @employee-name` in chat
2. The **gateway** (not you) detects the command and:
   - Finds the most recent session where `employee` matches the target name
   - Excludes child sessions of the current session (avoids circular references)
   - Fetches all messages from that session
   - Injects them into your system prompt as a "Synced conversation" section
3. You receive the message with the synced conversation already in your context
4. You respond naturally, as if you were briefed on what happened

## Your Behavior

When you see a `/sync` message and a "Synced conversation with @employee-name" section in your context:

1. **Acknowledge** the sync briefly — e.g., "Here's what I see from the conversation with @employee-name..."
2. **Summarize** the key points — what was discussed, what decisions were made, what work was done
3. **Highlight** any action items, blockers, or open questions
4. **Offer** to take next steps — continue the work, relay instructions, or loop in other employees

## Edge Cases

- **No conversation found**: If the gateway couldn't find a recent session for that employee, the synced conversation section won't appear. Let the user know: "I don't see any recent conversations with @employee-name."
- **Truncated conversation**: Long conversations are truncated to fit the context budget (~4K chars). If you see a truncation notice, mention it and suggest the user check the full session directly.
- **Employee not found**: If the employee name doesn't match anyone in the org, no sync happens. Suggest the user check the name with the org roster.

## Examples

User: `/sync @jimmy-dev`
You: "I just synced the latest conversation with @jimmy-dev. Here's what happened: [summary]. Want me to follow up on anything?"

User: `/sync @content-writer`
You: "Looking at the recent chat with @content-writer — they finished the blog draft and are waiting for review. Should I ask them to make revisions, or is it ready to publish?"
