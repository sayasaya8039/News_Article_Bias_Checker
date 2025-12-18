// 設定を読み込む
let config = {
  apiProvider: 'openai',
  openaiApiKey: '',
  geminiApiKey: '',
  claudeApiKey: ''
};
let configLoaded = false;

// 初期設定読み込み
chrome.storage.local.get({
  apiProvider: 'openai',
  openaiApiKey: '',
  geminiApiKey: '',
  claudeApiKey: ''
}, function(items) {
  config = items;
  configLoaded = true;
  console.log('[BiasChecker] 設定読み込み完了:', {
    provider: config.apiProvider,
    hasOpenAI: !!config.openaiApiKey,
    hasGemini: !!config.geminiApiKey,
    hasClaude: !!config.claudeApiKey
  });
});

// 設定が変更されたら更新
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    for (let [key, {newValue}] of Object.entries(changes)) {
      config[key] = newValue;
    }
    console.log('[BiasChecker] 設定更新:', config.apiProvider);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[BiasChecker] メッセージ受信:', request.action);

  if (request.action === 'analyzeBias') {
    const doAnalysis = () => {
      if (!configLoaded) {
        setTimeout(doAnalysis, 100);
        return;
      }
      
      console.log('[BiasChecker] 分析開始, テキスト長:', request.text?.length);
      
      fetchAPIForBias(request.text)
        .then(result => {
          console.log('[BiasChecker] 分析成功:', result);
          result.url = request.url || '';
          result.timestamp = Date.now();
          chrome.storage.local.set({ biasResult: result }, () => {
            sendResponse(result);
          });
        })
        .catch(error => {
          console.error('[BiasChecker] 分析エラー:', error);
          const errorResult = {
            error: true,
            message: error.message || 'APIエラーが発生しました',
            url: request.url || ''
          };
          chrome.storage.local.set({ biasResult: errorResult }, () => {
            sendResponse(errorResult);
          });
        });
    };
    
    doAnalysis();
    return true;
  }

  if (request.action === 'clearResult') {
    chrome.storage.local.set({ 
      biasResult: { 
        cleared: true, 
        url: request.url || '',
        message: '記事が見つかりません'
      } 
    });
    sendResponse({ cleared: true });
    return true;
  }

  if (request.action === 'getConfig') {
    const response = {
      hasApiKey: !!(config.openaiApiKey || config.geminiApiKey || config.claudeApiKey),
      provider: config.apiProvider,
      configLoaded: configLoaded
    };
    console.log('[BiasChecker] 設定応答:', response);
    sendResponse(response);
    return true;
  }
  
  return false;
});

async function fetchAPIForBias(text) {
  if (!text || text.length < 50) {
    throw new Error('テキストが短すぎます');
  }

  const selectedApi = config.apiProvider;
  console.log('[BiasChecker] 使用API:', selectedApi);

  switch(selectedApi) {
    case 'openai':
      if (!config.openaiApiKey) throw new Error('OpenAI APIキーが未設定です');
      return await callOpenAIAPI(text, config.openaiApiKey);
    case 'gemini':
      if (!config.geminiApiKey) throw new Error('Gemini APIキーが未設定です');
      return await callGeminiAPI(text, config.geminiApiKey);
    case 'claude':
      if (!config.claudeApiKey) throw new Error('Claude APIキーが未設定です');
      return await callClaudeAPI(text, config.claudeApiKey);
    default:
      throw new Error('未対応のAPI: ' + selectedApi);
  }
}

const BIAS_PROMPT = `あなたは日本のメディアバイアス分析の専門家です。以下のニュース記事を分析し、政治的傾向を判定してください。

【日本における政治的バイアスの判定基準】

■ 左派・リベラル傾向の特徴:
- 憲法9条改正に反対、護憲的立場
- 政権・与党（自民党）に批判的
- 防衛費増額・安全保障強化に懐疑的
- 原発再稼働に反対
- 多文化共生・移民受入れに肯定的
- ジェンダー平等・LGBT権利を重視
- 歴史問題で謝罪・反省を重視
- 社会福祉・再分配を重視
- 労働者・弱者の視点を強調

■ 右派・保守傾向の特徴:
- 憲法改正に積極的
- 政権・与党（自民党）を支持・擁護
- 防衛力強化・日米同盟重視
- 原発再稼働を支持
- 移民政策に慎重・国境管理重視
- 伝統的家族観を重視
- 歴史問題で自国の立場を強調
- 経済成長・規制緩和を重視
- 国益・愛国心を強調

■ 中立の特徴:
- 複数の立場を公平に紹介
- 事実報道に徹し、意見を控える
- 賛否両論を併記

【重要】
- 「中立」は本当にバランスが取れている場合のみ高くしてください
- 多くの記事は何らかの傾向を持っています
- 微妙な言葉遣いや論調からもバイアスを読み取ってください

以下のJSON形式のみで回答（説明不要）:
{"left": 0.0-1.0, "center": 0.0-1.0, "right": 0.0-1.0}

合計は1.0にしてください。

本文:
`;

async function callOpenAIAPI(text, apiKey) {
  console.log('[BiasChecker] OpenAI API呼び出し');
  const truncatedText = text.substring(0, 4000);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: BIAS_PROMPT + truncatedText }],
      temperature: 0,
      max_tokens: 100
    })
  });

  console.log('[BiasChecker] OpenAI応答ステータス:', response.status);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'OpenAI APIエラー: ' + response.status);
  }

  const data = await response.json();
  const resultText = data.choices[0].message.content.trim();
  console.log('[BiasChecker] OpenAI応答:', resultText);
  return parseJSONResponse(resultText, 'OpenAI');
}

async function callGeminiAPI(text, apiKey) {
  console.log('[BiasChecker] Gemini API呼び出し');
  const truncatedText = text.substring(0, 4000);

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: BIAS_PROMPT + truncatedText }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 100 }
    })
  });

  console.log('[BiasChecker] Gemini応答ステータス:', response.status);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Gemini APIエラー: ' + response.status);
  }

  const data = await response.json();
  if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
    throw new Error('Geminiからの応答が不正です');
  }

  const resultText = data.candidates[0].content.parts[0].text.trim();
  console.log('[BiasChecker] Gemini応答:', resultText);
  return parseJSONResponse(resultText, 'Gemini');
}

async function callClaudeAPI(text, apiKey) {
  console.log('[BiasChecker] Claude API呼び出し');
  const truncatedText = text.substring(0, 4000);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      messages: [{ role: 'user', content: BIAS_PROMPT + truncatedText }]
    })
  });

  console.log('[BiasChecker] Claude応答ステータス:', response.status);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Claude APIエラー: ' + response.status);
  }

  const data = await response.json();
  if (!data.content || !data.content[0]?.text) {
    throw new Error('Claudeからの応答が不正です');
  }

  const resultText = data.content[0].text.trim();
  console.log('[BiasChecker] Claude応答:', resultText);
  return parseJSONResponse(resultText, 'Claude');
}

function parseJSONResponse(resultText, apiName) {
  const jsonMatch = resultText.match(/{[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error(apiName + 'からの応答を解析できません');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const result = {
      left: Math.max(0, Math.min(1, parsed.left || 0)),
      center: Math.max(0, Math.min(1, parsed.center || 0)),
      right: Math.max(0, Math.min(1, parsed.right || 0))
    };

    const total = result.left + result.center + result.right;
    if (total > 0) {
      result.left /= total;
      result.center /= total;
      result.right /= total;
    }
    return result;
  } catch (e) {
    throw new Error(apiName + 'からの応答形式が不正です');
  }
}
