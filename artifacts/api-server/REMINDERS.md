# External roadmap reminders

## Channel and consent

Web Push uses the browser vendor's push service (Chrome/Edge, Firefox, Safari)
and needs no email account or paid messaging provider. A student chooses
**إشعارات المتصفح على هذا الجهاز**, explicitly checks the consent box and grants
the browser permission when saving. Saving from another device replaces the
previous device, not adds a second recipient. Only a server-timestamped consent
and browser subscription are retained, solely for this reminder.

Use the app in its own HTTPS tab, not an embedded preview. On iOS/iPadOS 16.4+
the app must be added to the Home Screen. Unsupported browsers retain the
in-app channel. Permission denial does not save or activate push delivery.

## Application server identity

`SESSION_SECRET` must be stable, high entropy and at least 32 characters.
It is already a project secret. VAPID P-256 signing keys are domain-separated
with HKDF from this secret. Only the public key is returned to authenticated
clients. No private key is written to the database, repository or logs.
Changing this secret invalidates existing browser subscriptions; students
must save the push settings again.

## Required scheduling setup before relying on live delivery

The existing Autoscale hosting can sleep when there are no visitors. Its
in-process timer alone **does not guarantee delivery when students are away**.
Do not consider live delivery enabled until one of these is configured:

1. Run the API continuously on an always-on host. It checks due reminders on
   startup and once per minute.
2. Keep the web/API hosting unchanged and schedule this independent command
   every 5 minutes:
   - Build: `pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build`
   - Run: `pnpm --filter @workspace/api-server run reminders:send`
   - Supply the same `DATABASE_URL` and `SESSION_SECRET` as the API for that
     environment, using the hosting provider's secrets tools.
   - Run against the same application database, not a separate empty database.

A scheduled run exits after a bounded batch of 50 reminders. Increase the
schedule frequency or batch size if volume requires it. Database row locks
prevent duplicate processing if scheduled and API passes overlap.

This change does not publish the app, switch the hosting plan or configure a
paid deployment. The app owner must choose and configure one of the above
options after merging. Development delivery runs while the API workflow runs.

## Delivery behavior and privacy

- First delivery is one week after saving; a successful send schedules the
  next one for a week later. Snooze moves that date to next week.
- At send time, verify the reminder is enabled, consent exists and the owned
  action item still exists and is not completed.
- Disabling or switching back to in-app deletes the saved push subscription
  and consent. Completing/deleting the selected task does the same.
- Invalid/expired subscriptions (404/410) revert to in-app reminders.
  Temporary errors retry after one hour. Private provider responses are not
  logged.
- The lock-screen text contains no task title or student details.
  Clicking opens `/roadmap#roadmap-task-<id>` in the subscribing app scope;
  the roadmap still requires sign-in.
- TTL is zero: offline notifications are not queued and delivered later
  after a task was completed, deleted or disabled. A push service accepting a
  send does not guarantee an OS notification (device settings still apply).
- A notification already delivered cannot be recalled by later opt-out.
