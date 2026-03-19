const express = require('express');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Data Helpers ──────────────────────────────────────────
function loadJSON(filename, defaultValue) {
  const filePath = path.join(DATA_DIR, filename);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
}

function saveJSON(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getRepos() {
  return loadJSON('repos.json', []);
}

function saveRepos(repos) {
  saveJSON('repos.json', repos);
}

function getSettings() {
  return loadJSON('settings.json', {
    githubToken: '',
    checkInterval: 7, // days
    email: {
      enabled: false,
      smtp: { host: '', port: 465, secure: true, user: '', pass: '' },
      from: '',
      to: ''
    }
  });
}

function saveSettings(settings) {
  saveJSON('settings.json', settings);
}

function getHistory() {
  return loadJSON('history.json', []);
}

function addHistory(entry) {
  const history = getHistory();
  history.unshift({ ...entry, detectedAt: new Date().toISOString() });
  // Keep last 200 entries
  if (history.length > 200) history.length = 200;
  saveJSON('history.json', history);
}

// ─── GitHub API ──────────────────────────────────────────
async function fetchLatestRelease(owner, repo, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'GitHub-Release-Monitor'
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  const response = await fetch(url, { headers });

  if (response.status === 404) {
    return null; // No releases
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return {
    tagName: data.tag_name,
    name: data.name || data.tag_name,
    body: data.body || '',
    publishedAt: data.published_at,
    htmlUrl: data.html_url,
    author: data.author ? data.author.login : 'unknown'
  };
}

// ─── Email ──────────────────────────────────────────
async function sendEmailNotification(repo, release, settings) {
  if (!settings.email.enabled) return;

  const { smtp, from, to } = settings.email;
  if (!smtp.host || !from || !to) return;

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass }
  });

  const bodyPreview = release.body
    ? release.body.substring(0, 500) + (release.body.length > 500 ? '...' : '')
    : '无 Release Notes';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 24px 32px;">
        <h1 style="margin: 0; font-size: 20px; color: white;">🚀 新版本发布</h1>
      </div>
      <div style="padding: 24px 32px;">
        <table style="width: 100%; border-collapse: collapse; color: #e0e0e0;">
          <tr><td style="padding: 8px 0; color: #888;">仓库</td><td style="padding: 8px 0; font-weight: 600;">${repo.fullName}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">版本</td><td style="padding: 8px 0; font-weight: 600; color: #667eea;">${release.tagName}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">名称</td><td style="padding: 8px 0;">${release.name}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">发布时间</td><td style="padding: 8px 0;">${new Date(release.publishedAt).toLocaleString('zh-CN')}</td></tr>
          <tr><td style="padding: 8px 0; color: #888;">发布者</td><td style="padding: 8px 0;">${release.author}</td></tr>
        </table>
        <div style="margin-top: 16px; padding: 16px; background: #16213e; border-radius: 8px; border-left: 3px solid #667eea;">
          <p style="margin: 0 0 8px; color: #888; font-size: 13px;">Release Notes</p>
          <pre style="margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 13px; color: #ccc;">${bodyPreview}</pre>
        </div>
        <div style="margin-top: 24px; text-align: center;">
          <a href="${release.htmlUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: 600;">查看 Release →</a>
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from,
    to,
    subject: `[GitHub Monitor] ${repo.fullName} 发布新版本 ${release.tagName}`,
    html
  });
}

// ─── Check for Updates ──────────────────────────────────────────
async function checkAllRepos() {
  const repos = getRepos();
  const settings = getSettings();
  let updatesFound = 0;

  console.log(`[${new Date().toLocaleString('zh-CN')}] 开始检查 ${repos.length} 个仓库...`);

  for (const repo of repos) {
    try {
      const [owner, name] = repo.fullName.split('/');
      const release = await fetchLatestRelease(owner, name, settings.githubToken);

      if (release) {
        const isNew = repo.lastRelease?.tagName !== release.tagName;
        repo.lastRelease = release;
        repo.lastChecked = new Date().toISOString();
        repo.error = null;

        if (isNew && repo.lastRelease) {
          updatesFound++;
          addHistory({
            repoFullName: repo.fullName,
            tagName: release.tagName,
            name: release.name,
            publishedAt: release.publishedAt,
            htmlUrl: release.htmlUrl
          });

          // Send email notification
          try {
            await sendEmailNotification(repo, release, settings);
          } catch (emailErr) {
            console.error(`  邮件发送失败 (${repo.fullName}):`, emailErr.message);
          }
        }

        console.log(`  ✅ ${repo.fullName}: ${release.tagName}${isNew ? ' [NEW!]' : ''}`);
      } else {
        repo.lastChecked = new Date().toISOString();
        repo.error = null;
        console.log(`  ⚪ ${repo.fullName}: 暂无 Release`);
      }
    } catch (err) {
      repo.lastChecked = new Date().toISOString();
      repo.error = err.message;
      console.error(`  ❌ ${repo.fullName}: ${err.message}`);
    }
  }

  saveRepos(repos);
  console.log(`检查完成，发现 ${updatesFound} 个更新\n`);
  return updatesFound;
}

// ─── Cron Scheduler ──────────────────────────────────────────
let cronJob = null;

function setupCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }

  const settings = getSettings();
  const days = settings.checkInterval || 7;

  // Run at 9:00 AM every N days
  cronJob = cron.schedule(`0 9 */${days} * *`, () => {
    checkAllRepos();
  });

  console.log(`⏰ 定时任务已设置：每 ${days} 天检查一次（每日 9:00）`);
}

// ─── API Routes ──────────────────────────────────────────

// Get all repos
app.get('/api/repos', (req, res) => {
  res.json(getRepos());
});

// Add repo
app.post('/api/repos', async (req, res) => {
  const { fullName } = req.body;

  if (!fullName || !fullName.includes('/')) {
    return res.status(400).json({ error: '请输入有效的仓库名称，格式：owner/repo' });
  }

  const repos = getRepos();
  if (repos.find(r => r.fullName.toLowerCase() === fullName.toLowerCase())) {
    return res.status(400).json({ error: '该仓库已在监控列表中' });
  }

  const settings = getSettings();
  const [owner, name] = fullName.split('/');

  // Validate repo exists & fetch current release
  try {
    const release = await fetchLatestRelease(owner, name, settings.githubToken);
    const repo = {
      id: Date.now().toString(),
      fullName: fullName.trim(),
      addedAt: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
      lastRelease: release,
      error: null
    };

    repos.push(repo);
    saveRepos(repos);
    res.json(repo);
  } catch (err) {
    // Still add it, but mark with error
    const repo = {
      id: Date.now().toString(),
      fullName: fullName.trim(),
      addedAt: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
      lastRelease: null,
      error: err.message
    };

    repos.push(repo);
    saveRepos(repos);
    res.json(repo);
  }
});

// Delete repo
app.delete('/api/repos/:id', (req, res) => {
  let repos = getRepos();
  repos = repos.filter(r => r.id !== req.params.id);
  saveRepos(repos);
  res.json({ success: true });
});

// Manual check
app.post('/api/check', async (req, res) => {
  try {
    const updates = await checkAllRepos();
    res.json({ success: true, updates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get settings
app.get('/api/settings', (req, res) => {
  const settings = getSettings();
  // Mask password
  const masked = JSON.parse(JSON.stringify(settings));
  if (masked.email?.smtp?.pass) {
    masked.email.smtp.pass = '********';
  }
  if (masked.githubToken) {
    masked.githubToken = masked.githubToken.substring(0, 8) + '********';
  }
  res.json(masked);
});

// Update settings
app.post('/api/settings', (req, res) => {
  const current = getSettings();
  const incoming = req.body;

  // Don't overwrite with masked values
  if (incoming.email?.smtp?.pass === '********') {
    incoming.email.smtp.pass = current.email.smtp.pass;
  }
  if (incoming.githubToken?.endsWith('********')) {
    incoming.githubToken = current.githubToken;
  }

  saveSettings(incoming);
  setupCron(); // Reconfigure cron with new interval
  res.json({ success: true });
});

// Test email
app.post('/api/test-email', async (req, res) => {
  const settings = getSettings();

  if (!settings.email.enabled) {
    return res.status(400).json({ error: '请先启用邮件通知' });
  }

  const { smtp, from, to } = settings.email;
  if (!smtp.host || !from || !to) {
    return res.status(400).json({ error: '请完善邮件配置信息' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass }
    });

    await transporter.sendMail({
      from,
      to,
      subject: '[GitHub Monitor] 测试邮件',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 400px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 24px 32px;">
            <h1 style="margin: 0; font-size: 20px; color: white;">✅ 测试邮件</h1>
          </div>
          <div style="padding: 24px 32px;">
            <p>恭喜！邮件通知配置正确，GitHub Release Monitor 可以正常发送邮件。</p>
            <p style="color: #888; font-size: 13px;">发送时间：${new Date().toLocaleString('zh-CN')}</p>
          </div>
        </div>
      `
    });

    res.json({ success: true, message: '测试邮件已发送' });
  } catch (err) {
    res.status(500).json({ error: `邮件发送失败：${err.message}` });
  }
});

// Get history
app.get('/api/history', (req, res) => {
  res.json(getHistory());
});

// ─── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🔍 GitHub Release Monitor 已启动`);
  console.log(`📡 访问 http://localhost:${PORT}\n`);
  setupCron();

  // Initial check on startup if there are repos
  const repos = getRepos();
  if (repos.length > 0) {
    setTimeout(() => checkAllRepos(), 3000);
  }
});
