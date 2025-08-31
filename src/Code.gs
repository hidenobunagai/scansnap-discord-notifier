/**
 * Google Drive "ScanSnap" folder watcher -> Discord notifier
 * - Polls the target folder for new files since the last check
 * - Posts a message to a Discord channel via Webhook
 *
 * Setup flow:
 * 1) Set Script Properties: FOLDER_ID and DISCORD_WEBHOOK_URL.
 * 2) Run setConfig() once to initialize baseline and install a 5-min trigger.
 * 3) New files added after initialization will be announced to Discord.
 */

const PROP_KEYS = {
  FOLDER_ID: 'FOLDER_ID',
  WEBHOOK: 'DISCORD_WEBHOOK_URL',
  LAST_CHECK: 'LAST_CHECK',
  PROCESSED_IDS: 'PROCESSED_IDS',
};

/**
 * One-time configuration.
 * - Use Script Properties for Drive folder ID and Discord Webhook URL, then run this.
 * - Initializes the baseline timestamp to "now" so existing files are not announced.
 * - Installs the time-driven trigger.
 */
function setConfig() {
  const props = PropertiesService.getScriptProperties();

  // Read required values from Script Properties (do not hardcode in code)
  const folderId = props.getProperty(PROP_KEYS.FOLDER_ID);
  const webhook = props.getProperty(PROP_KEYS.WEBHOOK);
  if (!folderId || !webhook) {
    throw new Error('Script Properties の FOLDER_ID / DISCORD_WEBHOOK_URL が未設定です。');
  }

  const now = new Date().toISOString();

  // Initialize baseline and processed list; keep existing FOLDER_ID / WEBHOOK as-is
  // Important: do not delete other script properties (like FOLDER_ID / WEBHOOK)
  // The second argument of setProperties(deleteAllOthers) must be false/omitted
  props.setProperties(
    {
      [PROP_KEYS.LAST_CHECK]: now,
      [PROP_KEYS.PROCESSED_IDS]: JSON.stringify([]),
    },
    false,
  );

  installTrigger();
  Logger.log('Configuration verified from Script Properties. Baseline set to %s. Trigger installed.', now);
}

/**
 * Ensures a single 5-min time-driven trigger exists for checkForNewFiles.
 */
function installTrigger() {
  const handler = 'checkForNewFiles';
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(t);
    }
  }
  ScriptApp.newTrigger(handler).timeBased().everyMinutes(5).create();
}

/**
 * Main job: finds new files added since the last run and posts to Discord.
 * Uses Advanced Drive Service (Drive v3) with metadata.readonly scope.
 */
function checkForNewFiles() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty(PROP_KEYS.FOLDER_ID);
  const webhook = props.getProperty(PROP_KEYS.WEBHOOK);
  if (!folderId || !webhook) {
    throw new Error('Missing configuration. Run setConfig() to initialize.');
  }

  let lastCheck = props.getProperty(PROP_KEYS.LAST_CHECK);
  if (!lastCheck) {
    lastCheck = new Date().toISOString();
    props.setProperty(PROP_KEYS.LAST_CHECK, lastCheck);
    return; // Initialize baseline silently
  }

  let processed = [];
  const raw = props.getProperty(PROP_KEYS.PROCESSED_IDS);
  if (raw) {
    try {
      processed = JSON.parse(raw) || [];
    } catch (e) {
      processed = [];
    }
  }

  const query = `('${folderId}' in parents) and trashed = false and createdTime > '${lastCheck}'`;
  const newFiles = listAllFiles(query);

  // Post in chronological order
  for (const f of newFiles) {
    if (processed.indexOf(f.id) !== -1) continue;
    postToDiscord(webhook, f);
    processed.push(f.id);
    if (processed.length > 200) {
      processed = processed.slice(-200);
    }
    // Small delay to be gentle with Discord rate limits
    Utilities.sleep(200);
  }

  const newLast = newFiles.length
    ? newFiles[newFiles.length - 1].createdTime
    : new Date().toISOString();
  props.setProperties(
    {
      [PROP_KEYS.LAST_CHECK]: newLast,
      [PROP_KEYS.PROCESSED_IDS]: JSON.stringify(processed),
    },
    false,
  );
}

/**
 * Helper: list files with paging, ordered by createdTime asc.
 */
function listAllFiles(q) {
  const files = [];
  let pageToken;
  do {
    const resp = Drive.Files.list({
      q,
      orderBy: 'createdTime asc',
      pageSize: 100,
      fields: 'nextPageToken, files(id,name,createdTime,webViewLink,mimeType,size,iconLink)',
      pageToken,
    });
    if (resp && resp.files && resp.files.length) {
      files.push.apply(files, resp.files);
    }
    pageToken = resp.nextPageToken;
  } while (pageToken);
  return files;
}

/**
 * Posts a simple message to Discord via webhook.
 */
function postToDiscord(webhookUrl, file) {
  const createdJst = Utilities.formatDate(
    new Date(file.createdTime),
    'Asia/Tokyo',
    'yyyy-MM-dd HH:mm:ss',
  );
  const content = `📄 新しいファイル: ${file.name}\n🕒 ${createdJst} JST\n🔗 ${file.webViewLink}`;
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ content }),
    muteHttpExceptions: true,
  };
  const resp = UrlFetchApp.fetch(webhookUrl, options);
  const code = resp.getResponseCode();
  if (code >= 300) {
    throw new Error(
      `Discord webhook error ${code}: ${resp.getContentText()}`,
    );
  }
}

/**
 * Manual runner to test current configuration.
 */
function manualCheck() {
  checkForNewFiles();
}

/**
 * Quick helper to print guidance in the logs.
 */
function help() {
  Logger.log('Set Script Properties: FOLDER_ID / DISCORD_WEBHOOK_URL.');
  Logger.log('Then run setConfig() once to initialize and install trigger.');
  Logger.log('Use manualCheck() to test.');
}


