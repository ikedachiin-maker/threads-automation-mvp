/**
 * 品質スコア自動採点システム
 * 10項目で各10点満点、平均7.0以上で合格
 */

const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * 投稿の品質スコアを自動採点
 * @param {string} postText - 投稿本文
 * @param {object} persona - アカウント人格設定
 * @param {string} pattern - 使用した投稿パターン
 * @returns {Promise<object>} スコア結果
 */
async function scorePost(postText, persona, pattern) {
  const scoringPrompt = `
あなたは投稿品質を評価するプロの編集者です。以下の投稿を10項目で採点してください。

【投稿本文】
${postText}

【アカウント人格】
- ジャンル: ${persona.genre}
- トーン: ${persona.tone}
- ターゲット: ${persona.target}
- 専門性: ${persona.expertise}

【使用パターン】
${pattern}

【採点項目】（各10点満点）
1. フックの強さ - 1行目で読者を引き込めるか
2. 有益性 - 読者にとって実用的な価値があるか
3. 具体性 - 抽象論ではなく具体例・数字があるか
4. テンポ感 - リズムよく読めるか、冗長でないか
5. ペルソナ一致度 - アカウント人格と文体が一致しているか
6. 読みやすさ - 改行・文字数・句読点が適切か
7. アクション誘導 - コメント/いいね/共感を促す仕掛けがあるか
8. 独自性 - ありきたりではない、新鮮な視点があるか
9. 感情共鳴 - 共感・驚き・納得などの感情を呼ぶか
10. 完結性 - 言いたいことが完結しているか、消化不良でないか

【出力形式】
以下のJSON形式で回答してください：
\`\`\`json
{
  "scores": {
    "hook": 8,
    "value": 7,
    "specificity": 9,
    "tempo": 8,
    "persona_match": 9,
    "readability": 8,
    "action": 7,
    "uniqueness": 8,
    "emotion": 9,
    "completeness": 8
  },
  "average": 8.1,
  "pass": true,
  "feedback": "1行目のフックが強く、具体例も豊富。ペルソナとも一致している。ただしアクション誘導がやや弱いので、質問で終わるとさらに良い。",
  "suggestions": [
    "最後に質問を追加してコメントを誘導",
    "数字をもう1つ追加すると説得力UP"
  ]
}
\`\`\`
`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: scoringPrompt
        }
      ]
    });

    const responseText = message.content[0].text;

    // JSONを抽出
    const jsonMatch = responseText.match(/```json\n([\s\S]+?)\n```/);
    if (!jsonMatch) {
      throw new Error('Failed to parse scoring response');
    }

    const result = JSON.parse(jsonMatch[1]);

    return {
      success: true,
      ...result
    };

  } catch (error) {
    console.error('Quality Scoring Error:', error.message);
    return {
      success: false,
      error: error.message,
      average: 0,
      pass: false
    };
  }
}

/**
 * スコアが合格ラインを超えているかチェック
 * @param {number} average - 平均スコア
 * @param {number} threshold - 合格ライン（デフォルト7.0）
 * @returns {boolean}
 */
function isPassingScore(average, threshold = 7.0) {
  return average >= threshold;
}

/**
 * 複数の投稿をバッチ採点
 * @param {Array} posts - 投稿オブジェクトの配列
 * @param {object} persona - アカウント人格設定
 * @returns {Promise<Array>} 採点済み投稿の配列
 */
async function batchScore(posts, persona) {
  const results = [];

  for (const post of posts) {
    console.log(`\n採点中: "${post.text.substring(0, 30)}..."`);

    const score = await scorePost(post.text, persona, post.pattern);

    results.push({
      ...post,
      quality_score: score
    });

    console.log(`スコア: ${score.average}/10.0 ${score.pass ? '✅ 合格' : '❌ 不合格'}`);

    // API制限対策: 1秒待機
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

module.exports = {
  scorePost,
  isPassingScore,
  batchScore
};
