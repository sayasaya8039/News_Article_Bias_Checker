// ページ読み込み時に記事本文を抽出し、分析を実行
let lastUrl = location.href;

function runAnalysis() {
  chrome.runtime.sendMessage({ action: 'getConfig' }, (response) => {
    if (chrome.runtime.lastError) {
      console.log('[BiasChecker] 拡張機能との通信エラー');
      return;
    }

    if (!response?.hasApiKey) {
      console.log('[BiasChecker] APIキーが未設定です');
      return;
    }

    const articleText = extractArticleText();
    const currentUrl = location.href;
    
    if (articleText && articleText.length > 100) {
      console.log('[BiasChecker] 分析開始:', currentUrl);
      chrome.runtime.sendMessage({
        action: 'analyzeBias',
        text: articleText,
        url: currentUrl
      }, (result) => {
        if (chrome.runtime.lastError) {
          console.error('[BiasChecker] 分析エラー', chrome.runtime.lastError);
          return;
        }
        console.log('[BiasChecker] 分析結果:', result);
      });
    } else {
      // 記事がない場合は結果をクリア
      chrome.runtime.sendMessage({
        action: 'clearResult',
        url: currentUrl
      });
      console.log('[BiasChecker] 記事本文が見つかりませんでした');
    }
  });
}

// 初回読み込み
window.addEventListener('load', runAnalysis);

// URL変更を検知（SPA対応）
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    console.log('[BiasChecker] URL変更検知:', lastUrl);
    // 少し待ってからコンテンツを取得（ページ読み込み完了待ち）
    setTimeout(runAnalysis, 1000);
  }
}, 500);

// ページ表示時（戻る/進むボタン対応）
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    console.log('[BiasChecker] ページ復元検知');
    runAnalysis();
  }
});

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
