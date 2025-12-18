document.addEventListener('DOMContentLoaded', async () => {
  const manifest = chrome.runtime.getManifest();
  document.getElementById('version').textContent = `v${manifest.version}`;

  // 現在のタブのURLを取得して表示を更新
  await checkAndUpdateDisplay();

  // 再分析ボタン
  document.getElementById('refresh-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    const biasDisplayEl = document.getElementById('bias-display');

    statusEl.style.display = 'flex';
    statusEl.className = 'status loading';
    statusEl.innerHTML = '<div class="spinner"></div><span>分析中...</span>';
    biasDisplayEl.style.display = 'none';

    const timeout = setTimeout(() => {
      showError('タイムアウト: API応答がありません');
    }, 30000);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        clearTimeout(timeout);
        showError('タブが見つかりません');
        return;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractArticleText
      });

      if (!results || !results[0] || !results[0].result) {
        clearTimeout(timeout);
        showError('記事を抽出できませんでした');
        return;
      }

      const text = results[0].result;

      if (text.length < 100) {
        clearTimeout(timeout);
        showError('記事本文が短すぎます');
        return;
      }

      chrome.runtime.sendMessage({
        action: 'analyzeBias',
        text: text,
        url: tab.url
      }, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          showError('通信エラー: ' + chrome.runtime.lastError.message);
          return;
        }
        
        if (response && response.error) {
          showError(response.message || 'API分析エラー');
          return;
        }
        
        if (response) {
          updateBiasDisplay();
        }
      });

    } catch (error) {
      clearTimeout(timeout);
      showError('エラー: ' + error.message);
    }
  });

  // 設定ボタン
  document.getElementById('options-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});

// 現在のタブURLと保存結果を比較
async function checkAndUpdateDisplay() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = tab?.url || '';
    
    chrome.storage.local.get(['biasResult'], (result) => {
      const bias = result.biasResult;
      
      // URLが異なる場合は「分析中」または「分析してください」を表示
      if (!bias || bias.url !== currentUrl) {
        const statusEl = document.getElementById('status');
        const biasDisplayEl = document.getElementById('bias-display');
        
        statusEl.style.display = 'block';
        statusEl.className = 'status';
        statusEl.textContent = '「再分析」を押してください';
        biasDisplayEl.style.display = 'none';
        return;
      }
      
      updateBiasDisplay();
    });
  } catch (e) {
    console.error('[BiasChecker] URL取得エラー:', e);
    updateBiasDisplay();
  }
}

function extractArticleText() {
  const selectors = [
    '.articledetail-body p',
    '.article-body p',
    '.main-text p',
    '.article_body p',
    '.ArticleText p',
    '.article-txt p',
    '.p-main-contents p',
    '.JSID_key_article_body p',
    '.body-text p',
    '.content--detail-body p',
    '.yjDirectSLinkTarget p',
    'article[class*="article"] p',
    'article[class*="content"] p',
    'article[class*="body"] p',
    '[class*="article-body"] p',
    '[class*="article-content"] p',
    '[class*="entry-content"] p',
    '[class*="post-content"] p',
    '[class*="news-body"] p',
    '[class*="story-body"] p',
    '[class*="article_body"] p',
    '[class*="articleBody"] p',
    '.article-text p',
    '.article_text p',
    'article p',
    'main article p',
    'main p',
    '.content p',
    '#content p'
  ];

  let paragraphs = [];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      paragraphs = Array.from(elements)
        .map(el => el.textContent.trim())
        .filter(text => {
          if (text.length < 30) return false;
          if (/^(広告|PR|スポンサー|関連記事|おすすめ|人気記事|ランキング)/i.test(text)) return false;
          if (/^(copyright|©|\[AD\]|プレスリリース)/i.test(text)) return false;
          return true;
        });

      if (paragraphs.length >= 3) break;
    }
  }

  if (paragraphs.length < 3) {
    const allParagraphs = document.querySelectorAll('p');
    paragraphs = Array.from(allParagraphs)
      .map(el => el.textContent.trim())
      .filter(text => text.length >= 50);
  }

  return paragraphs.join('\n');
}

function updateBiasDisplay() {
  chrome.storage.local.get(['biasResult'], (result) => {
    const statusEl = document.getElementById('status');
    const biasDisplayEl = document.getElementById('bias-display');

    if (!result.biasResult) {
      statusEl.style.display = 'block';
      statusEl.className = 'status';
      statusEl.textContent = 'ニュース記事を開いてください';
      biasDisplayEl.style.display = 'none';
      return;
    }

    const bias = result.biasResult;

    if (bias.cleared) {
      statusEl.style.display = 'block';
      statusEl.className = 'status';
      statusEl.textContent = bias.message || '記事が見つかりません';
      biasDisplayEl.style.display = 'none';
      return;
    }

    if (bias.error) {
      showError(bias.message || 'エラーが発生しました');
      return;
    }

    statusEl.style.display = 'none';
    biasDisplayEl.style.display = 'block';

    const leftPercent = Math.round(bias.left * 100);
    const centerPercent = Math.round(bias.center * 100);
    const rightPercent = Math.round(bias.right * 100);

    document.getElementById('left-score').textContent = leftPercent;
    document.getElementById('center-score').textContent = centerPercent;
    document.getElementById('right-score').textContent = rightPercent;

    document.getElementById('left-bar').style.width = `${leftPercent}%`;
    document.getElementById('center-bar').style.width = `${centerPercent}%`;
    document.getElementById('right-bar').style.width = `${rightPercent}%`;
  });
}

function showError(message) {
  const statusEl = document.getElementById('status');
  const biasDisplayEl = document.getElementById('bias-display');

  statusEl.style.display = 'block';
  statusEl.className = 'status error';
  statusEl.textContent = message;
  biasDisplayEl.style.display = 'none';
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.biasResult) {
    checkAndUpdateDisplay();
  }
});
