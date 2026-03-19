/**
 * ライター（投稿生成AI）
 * ネタ・人格・パターンから投稿を自動生成
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * ナレッジファイルを読み込み
 * @param {string} filename - ファイル名
 * @returns {object} JSON内容
 */
function loadKnowledge(filename) {
  const filePath = path.join(__dirname, '..', 'knowledge', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * 状態ファイルを読み込み
 * @param {string} filename - ファイル名
 * @returns {object} JSON内容
 */
function loadState(filename) {
  const filePath = path.join(__dirname, '..', 'state', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * 使用可能な投稿パターンを選択（直近3件で使ってないもの）
 * @param {Array} allPatterns - 全パターン
 * @param {Array} postHistory - 投稿履歴
 * @param {number} avoidLastN - 直近N件を避ける
 * @returns {Array} 使用可能なパターン
 */
function getAvailablePatterns(allPatterns, postHistory, avoidLastN = 3) {
  const recentPatterns = postHistory
    .slice(-avoidLastN)
    .map(p => p.pattern)
    .filter(p => p);

  const available = allPatterns.filter(p => !recentPatterns.includes(p.id));

  return available.length > 0 ? available : allPatterns;
}

/**
 * ランダムに1つ選択
 * @param {Array} array - 配列
 * @returns {*} ランダムな要素
 */
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * 投稿を1本生成
 * @param {object} topic - ネタ
 * @param {object} persona - アカウント人格
 * @param {object} pattern - 投稿パターン
 * @param {Array} hooks - 1行目サンプル
 * @returns {Promise<object>} 生成された投稿
 */
async function generatePost(topic, persona, pattern, hooks) {
  const hookExamples = hooks.hooks.slice(0, 10).join('\n');

  const prompt = `
あなたは${persona.genre}ジャンルのThreadsアカウント運営者です。

【アカウント人格】
- ジャンル: ${persona.genre}
- トーン: ${persona.tone}
- ターゲット: ${persona.target}
- 専門性: ${persona.expertise}
- バックグラウンド: ${persona.character.background}
- 文体: ${persona.voice.style}
- 禁止ワード: ${persona.ng_words.join(', ')}

【投稿パターン】
名前: ${pattern.name}
説明: ${pattern.description}
構造: ${pattern.structure}
例: ${pattern.example}

【ネタ】
テーマ: ${topic.theme}
内容: ${topic.content}
キーワード: ${topic.keywords.join(', ')}

【バズった1行目のサンプル】
${hookExamples}

【指示】
上記のネタとパターンを使って、Threads投稿を1本作成してください。

要件:
1. 1行目は絶対にインパクト重視（上記サンプル参考）
2. 文体・トーンはアカウント人格に完全一致
3. 禁止ワードは絶対使わない
4. 投稿パターンの構造に従う
5. 文字数: 100-300文字程度
6. 改行は適度に入れる（読みやすさ重視）
7. 具体例・数字があるとベター

【出力形式】
投稿本文のみを出力してください。説明や前置きは不要です。
`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const postText = message.content[0].text.trim();

    return {
      text: postText,
      pattern: pattern.id,
      pattern_name: pattern.name,
      topic: topic.theme,
      keywords: topic.keywords,
      generated_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('投稿生成エラー:', error.message);
    return null;
  }
}

/**
 * 投稿を書き直し（品質スコアが低い場合）
 * @param {object} post - 元の投稿
 * @param {object} scoreResult - 品質スコア結果
 * @param {object} persona - アカウント人格
 * @param {object} pattern - 投稿パターン
 * @returns {Promise<object>} 改善された投稿
 */
async function rewritePost(post, scoreResult, persona, pattern) {
  const prompt = `
以下の投稿を改善してください。

【元の投稿】
${post.text}

【品質スコア】
平均: ${scoreResult.average}/10.0（合格ライン: 7.0）

【フィードバック】
${scoreResult.feedback}

【改善提案】
${scoreResult.suggestions.join('\n')}

【アカウント人格】
- トーン: ${persona.tone}
- ターゲット: ${persona.target}

【指示】
上記のフィードバックを反映して、投稿を書き直してください。
平均スコア7.0以上を目指してください。

【出力形式】
改善後の投稿本文のみを出力してください。
`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const rewrittenText = message.content[0].text.trim();

    return {
      ...post,
      text: rewrittenText,
      rewritten: true,
      rewrite_reason: scoreResult.feedback
    };

  } catch (error) {
    console.error('書き直しエラー:', error.message);
    return post;
  }
}

/**
 * バッチで複数投稿を生成
 * @param {number} count - 生成数
 * @returns {Promise<Array>} 生成された投稿の配列
 */
async function generateBatch(count = 5) {
  console.log(`\n📝 投稿を${count}本生成します...\n`);

  const persona = loadKnowledge('persona.json');
  const patterns = loadKnowledge('post_patterns.json');
  const hooks = loadKnowledge('hooks.json');
  const topics = loadKnowledge('topics.json');
  const postHistory = loadState('post_history.json');

  const allPatterns = patterns.patterns;
  const allTopics = topics.topics;

  const posts = [];

  for (let i = 0; i < count; i++) {
    console.log(`\n生成中 [${i + 1}/${count}]`);

    // ランダムにネタとパターンを選択
    const topic = randomChoice(allTopics);
    const availablePatterns = getAvailablePatterns(allPatterns, postHistory.posts, 3);
    const pattern = randomChoice(availablePatterns);

    console.log(`  テーマ: ${topic.theme}`);
    console.log(`  パターン: ${pattern.name}`);

    const post = await generatePost(topic, persona, pattern, hooks);

    if (post) {
      posts.push(post);
      console.log(`  ✅ 生成完了: "${post.text.substring(0, 40)}..."`);
    } else {
      console.log(`  ❌ 生成失敗`);
    }

    // API制限対策: 2秒待機
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n✨ 合計${posts.length}本の投稿を生成しました\n`);

  return posts;
}

module.exports = {
  generatePost,
  rewritePost,
  generateBatch,
  loadKnowledge,
  loadState
};
