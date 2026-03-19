// ─── App State & API ──────────────────────────────────────────
const app = {
  repos: [],
  settings: {},
  history: [],

  async api(method, url, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  async loadRepos() {
    this.repos = await this.api('GET', '/api/repos');
  },

  async loadSettings() {
    this.settings = await this.api('GET', '/api/settings');
  },

  async loadHistory() {
    this.history = await this.api('GET', '/api/history');
  },

  async addRepo(fullName) {
    const repo = await this.api('POST', '/api/repos', { fullName });
    this.repos.push(repo);
    return repo;
  },

  async deleteRepo(id) {
    await this.api('DELETE', `/api/repos/${id}`);
    this.repos = this.repos.filter(r => r.id !== id);
  },

  async saveSettings(settings) {
    await this.api('POST', '/api/settings', settings);
    this.settings = settings;
  },

  async checkNow() {
    const btn = document.getElementById('btn-check-now');
    if (btn) {
      btn.classList.add('loading', 'spinning');
      btn.disabled = true;
    }
    try {
      const result = await this.api('POST', '/api/check');
      await this.loadRepos();
      await this.loadHistory();
      showToast(`检查完成，发现 ${result.updates} 个更新`, result.updates > 0 ? 'success' : 'info');
      router.render();
    } catch (err) {
      showToast('检查失败: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.classList.remove('loading', 'spinning');
        btn.disabled = false;
      }
    }
  },

  async testEmail() {
    try {
      const result = await this.api('POST', '/api/test-email');
      showToast(result.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};

// ─── Toast ──────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'} ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ─── Time Helpers ──────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  return `${months} 个月前`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─── Views ──────────────────────────────────────────

function renderDashboard() {
  const reposWithRelease = app.repos.filter(r => r.lastRelease);
  const reposWithError = app.repos.filter(r => r.error);
  const latestUpdate = app.repos.reduce((latest, r) => {
    if (r.lastRelease?.publishedAt) {
      const d = new Date(r.lastRelease.publishedAt);
      return d > latest ? d : latest;
    }
    return latest;
  }, new Date(0));

  return `
    <div class="page-header">
      <h2>仪表盘</h2>
      <p>实时监控 GitHub 仓库的 Release 发布状态</p>
    </div>

    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-icon purple">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value">${app.repos.length}</div>
          <div class="stat-label">监控仓库</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value">${reposWithRelease.length}</div>
          <div class="stat-label">有 Release</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value">${latestUpdate.getTime() > 0 ? timeAgo(latestUpdate.toISOString()) : '—'}</div>
          <div class="stat-label">最近更新</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon pink">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value">${reposWithError.length}</div>
          <div class="stat-label">错误</div>
        </div>
      </div>
    </div>

    ${app.repos.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
        </div>
        <h3>暂无监控仓库</h3>
        <p>前往「仓库管理」添加想要监控的 GitHub 仓库</p>
      </div>
    ` : `
      <div class="repo-grid">
        ${app.repos.map((repo, i) => `
          <div class="repo-card" style="animation-delay: ${i * 0.05}s">
            <div class="repo-card-header">
              <div class="repo-name">
                📦 <a href="https://github.com/${repo.fullName}" target="_blank" rel="noopener">${repo.fullName}</a>
              </div>
              ${repo.error ? `<span class="repo-status error">⚠ 错误</span>` :
                repo.lastRelease ? `<span class="repo-status ok">● 正常</span>` :
                `<span class="repo-status none">○ 无Release</span>`}
            </div>
            ${repo.lastRelease ? `
              <div class="repo-release">
                <div class="repo-release-tag">${repo.lastRelease.tagName}</div>
                <div class="repo-release-meta">
                  <span>📌 ${repo.lastRelease.name}</span>
                  <span>🕐 ${timeAgo(repo.lastRelease.publishedAt)}</span>
                  <span>👤 ${repo.lastRelease.author}</span>
                </div>
                ${repo.lastRelease.body ? `
                  <div class="repo-release-body">${escapeHtml(repo.lastRelease.body.substring(0, 300))}</div>
                ` : ''}
              </div>
            ` : `
              <div style="color: var(--text-muted); font-size: 13px; padding: 16px 0;">
                ${repo.error ? `错误: ${repo.error}` : '该仓库暂无 Release'}
              </div>
            `}
            <div class="repo-card-footer">
              <span>最后检查: ${timeAgo(repo.lastChecked)}</span>
              ${repo.lastRelease ? `<a href="${repo.lastRelease.htmlUrl}" target="_blank" rel="noopener" style="color: var(--accent-light); text-decoration: none; font-weight: 500;">查看 Release →</a>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;
}

function renderRepos() {
  return `
    <div class="page-header">
      <h2>仓库管理</h2>
      <p>添加或移除需要监控的 GitHub 仓库</p>
    </div>

    <div class="add-repo-section">
      <h3>➕ 添加仓库</h3>
      <div class="form-inline" style="margin-top: 12px;">
        <input type="text" id="input-repo" class="form-input" placeholder="输入仓库名称，如: facebook/react" onkeydown="if(event.key==='Enter') addRepoHandler()">
        <button class="btn btn-primary" onclick="addRepoHandler()">添加</button>
      </div>
    </div>

    ${app.repos.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <h3>列表为空</h3>
        <p>在上方输入 GitHub 仓库地址来添加监控</p>
      </div>
    ` : `
      <div>
        ${app.repos.map((repo, i) => {
          const initial = repo.fullName.split('/')[0][0].toUpperCase();
          const gradients = ['var(--gradient-1)', 'var(--gradient-2)', 'var(--gradient-3)', 'var(--gradient-4)'];
          return `
            <div class="repo-list-item" style="animation-delay: ${i * 0.05}s">
              <div class="repo-list-info">
                <div class="repo-avatar" style="background: ${gradients[i % 4]}">${initial}</div>
                <div class="repo-detail">
                  <h4>${repo.fullName}</h4>
                  <p>${repo.lastRelease ? `最新版本: ${repo.lastRelease.tagName} · ${timeAgo(repo.lastRelease.publishedAt)}` : '暂无 Release'}</p>
                </div>
              </div>
              <button class="btn btn-danger" onclick="deleteRepoHandler('${repo.id}', '${repo.fullName}')">删除</button>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

function renderHistory() {
  return `
    <div class="page-header">
      <h2>更新历史</h2>
      <p>所有检测到的新版本发布记录</p>
    </div>

    ${app.history.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <h3>暂无更新记录</h3>
        <p>当监控的仓库发布新版本时，会自动记录在这里</p>
      </div>
    ` : `
      <div class="card-section">
        ${app.history.map(item => `
          <div class="history-item">
            <div class="history-dot"></div>
            <div class="history-content">
              <h4>${item.repoFullName} → <span style="color: var(--accent-light)">${item.tagName}</span></h4>
              <p>${item.name || item.tagName}</p>
            </div>
            <div class="history-time">
              <div>${formatDate(item.detectedAt)}</div>
              <a href="${item.htmlUrl}" target="_blank" rel="noopener" style="color: var(--accent-light); text-decoration: none; font-size: 11px;">查看 →</a>
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;
}

function renderSettings() {
  const s = app.settings;
  const email = s.email || { enabled: false, smtp: { host: '', port: 465, secure: true, user: '', pass: '' }, from: '', to: '' };

  return `
    <div class="page-header">
      <h2>设置</h2>
      <p>配置 GitHub Token、检查间隔和邮件通知</p>
    </div>

    <div class="card-section">
      <div class="card-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        GitHub 配置
      </div>
      <div class="form-group">
        <label>Personal Access Token（可选，提高 API 限额）</label>
        <input type="password" id="set-github-token" class="form-input" placeholder="ghp_xxxxxxxxxxxx" value="${s.githubToken || ''}">
      </div>
      <div class="form-group">
        <label>检查间隔（天）</label>
        <input type="number" id="set-check-interval" class="form-input" min="1" max="30" value="${s.checkInterval || 7}" style="max-width: 200px;">
      </div>
    </div>

    <div class="card-section">
      <div class="card-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        邮件通知
      </div>

      <div class="form-group">
        <div class="toggle-wrapper">
          <label class="toggle">
            <input type="checkbox" id="set-email-enabled" ${email.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span style="font-size: 13px; font-weight: 500;">启用邮件通知</span>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>SMTP 服务器</label>
          <input type="text" id="set-smtp-host" class="form-input" placeholder="smtp.qq.com" value="${email.smtp?.host || ''}">
        </div>
        <div class="form-group">
          <label>端口</label>
          <input type="number" id="set-smtp-port" class="form-input" value="${email.smtp?.port || 465}" style="max-width: 120px;">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>SMTP 用户名</label>
          <input type="text" id="set-smtp-user" class="form-input" placeholder="your-email@qq.com" value="${email.smtp?.user || ''}">
        </div>
        <div class="form-group">
          <label>SMTP 密码 / 授权码</label>
          <input type="password" id="set-smtp-pass" class="form-input" placeholder="授权码" value="${email.smtp?.pass || ''}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>发件人地址</label>
          <input type="text" id="set-email-from" class="form-input" placeholder="monitor@example.com" value="${email.from || ''}">
        </div>
        <div class="form-group">
          <label>收件人地址</label>
          <input type="text" id="set-email-to" class="form-input" placeholder="you@example.com（多个用逗号分隔）" value="${email.to || ''}">
        </div>
      </div>
    </div>

    <div style="display: flex; gap: 12px; margin-top: 8px;">
      <button class="btn btn-primary" onclick="saveSettingsHandler()">💾 保存设置</button>
      <button class="btn btn-secondary" onclick="app.testEmail()">📧 发送测试邮件</button>
    </div>
  `;
}

// ─── Event Handlers ──────────────────────────────────────────

async function addRepoHandler() {
  const input = document.getElementById('input-repo');
  const name = input.value.trim();
  if (!name) return;

  try {
    await app.addRepo(name);
    input.value = '';
    showToast(`已添加 ${name}`, 'success');
    router.render();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteRepoHandler(id, name) {
  if (!confirm(`确定要删除 ${name} 吗？`)) return;
  try {
    await app.deleteRepo(id);
    showToast(`已删除 ${name}`, 'info');
    router.render();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveSettingsHandler() {
  const settings = {
    githubToken: document.getElementById('set-github-token').value,
    checkInterval: parseInt(document.getElementById('set-check-interval').value) || 30,
    email: {
      enabled: document.getElementById('set-email-enabled').checked,
      smtp: {
        host: document.getElementById('set-smtp-host').value,
        port: parseInt(document.getElementById('set-smtp-port').value) || 465,
        secure: true,
        user: document.getElementById('set-smtp-user').value,
        pass: document.getElementById('set-smtp-pass').value
      },
      from: document.getElementById('set-email-from').value,
      to: document.getElementById('set-email-to').value
    }
  };

  try {
    await app.saveSettings(settings);
    showToast('设置已保存', 'success');
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─── Router ──────────────────────────────────────────
const router = {
  routes: {
    '/': renderDashboard,
    '/repos': renderRepos,
    '/history': renderHistory,
    '/settings': renderSettings
  },

  render() {
    const hash = window.location.hash.replace('#', '') || '/';
    const view = this.routes[hash] || renderDashboard;
    document.getElementById('view-container').innerHTML = view();

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
      const route = item.getAttribute('data-route');
      const isActive = (hash === '/' && route === 'dashboard') ||
                       (hash === `/${route}`);
      item.classList.toggle('active', isActive);
    });
  }
};

// ─── Init ──────────────────────────────────────────
window.addEventListener('hashchange', () => router.render());

(async function init() {
  try {
    await Promise.all([
      app.loadRepos(),
      app.loadSettings(),
      app.loadHistory()
    ]);
  } catch (err) {
    console.error('初始化失败:', err);
  }
  router.render();
})();
