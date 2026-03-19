/**
 * 類似度チェックシステム
 * コサイン類似度で過去投稿と比較、0.85以上は棄却
 */

/**
 * テキストをトークン化（簡易版TF-IDF）
 * @param {string} text - テキスト
 * @returns {object} 単語頻度マップ
 */
function tokenize(text) {
  // 記号・改行を削除して小文字化
  const cleaned = text
    .toLowerCase()
    .replace(/[。、！？\n\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').filter(w => w.length > 0);

  // 単語頻度カウント
  const freq = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }

  return freq;
}

/**
 * コサイン類似度を計算
 * @param {object} vecA - ベクトルA（単語頻度マップ）
 * @param {object} vecB - ベクトルB（単語頻度マップ）
 * @returns {number} 類似度（0.0〜1.0）
 */
function cosineSimilarity(vecA, vecB) {
  const allWords = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const word of allWords) {
    const a = vecA[word] || 0;
    const b = vecB[word] || 0;

    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 新しい投稿が過去投稿と類似しすぎていないかチェック
 * @param {string} newPostText - 新しい投稿本文
 * @param {Array} postHistory - 過去投稿の配列
 * @param {number} threshold - 類似度閾値（デフォルト0.85）
 * @param {number} checkLastN - 直近N件をチェック（デフォルト100）
 * @returns {object} チェック結果
 */
function checkSimilarity(newPostText, postHistory, threshold = 0.85, checkLastN = 100) {
  if (!postHistory || postHistory.length === 0) {
    return {
      pass: true,
      max_similarity: 0,
      similar_posts: []
    };
  }

  const newVec = tokenize(newPostText);
  const recentPosts = postHistory.slice(-checkLastN);

  const similarities = recentPosts.map(post => {
    const oldVec = tokenize(post.text);
    const similarity = cosineSimilarity(newVec, oldVec);

    return {
      post_id: post.id || post.post_id,
      text: post.text.substring(0, 50) + '...',
      similarity: similarity
    };
  });

  // 類似度でソート
  similarities.sort((a, b) => b.similarity - a.similarity);

  const maxSimilarity = similarities[0]?.similarity || 0;
  const tooSimilar = similarities.filter(s => s.similarity >= threshold);

  return {
    pass: tooSimilar.length === 0,
    max_similarity: maxSimilarity,
    similar_posts: tooSimilar.slice(0, 3), // 上位3件
    threshold: threshold
  };
}

/**
 * バッチで複数投稿の類似度チェック
 * @param {Array} newPosts - 新しい投稿の配列
 * @param {Array} postHistory - 過去投稿の配列
 * @param {number} threshold - 類似度閾値
 * @returns {Array} チェック結果付き投稿の配列
 */
function batchCheckSimilarity(newPosts, postHistory, threshold = 0.85) {
  const results = [];

  for (const post of newPosts) {
    const check = checkSimilarity(post.text, postHistory, threshold);

    results.push({
      ...post,
      similarity_check: check
    });

    if (check.pass) {
      console.log(`✅ 類似度OK: ${post.text.substring(0, 30)}... (最大: ${(check.max_similarity * 100).toFixed(1)}%)`);
    } else {
      console.log(`❌ 類似度NG: ${post.text.substring(0, 30)}... (${(check.max_similarity * 100).toFixed(1)}% ≥ ${threshold * 100}%)`);
      console.log(`   類似投稿: "${check.similar_posts[0]?.text}"`);
    }
  }

  return results;
}

/**
 * 投稿パターンの連続使用をチェック
 * @param {string} newPattern - 新しい投稿のパターンID
 * @param {Array} postHistory - 過去投稿の配列
 * @param {number} avoidLastN - 直近N件で同じパターン禁止（デフォルト3）
 * @returns {boolean} true = OK, false = NG
 */
function checkPatternDiversity(newPattern, postHistory, avoidLastN = 3) {
  if (!postHistory || postHistory.length === 0) {
    return true;
  }

  const recentPatterns = postHistory
    .slice(-avoidLastN)
    .map(p => p.pattern)
    .filter(p => p);

  const isDuplicate = recentPatterns.includes(newPattern);

  if (isDuplicate) {
    console.log(`⚠️ パターン重複: "${newPattern}" は直近${avoidLastN}件で使用済み`);
  }

  return !isDuplicate;
}

module.exports = {
  tokenize,
  cosineSimilarity,
  checkSimilarity,
  batchCheckSimilarity,
  checkPatternDiversity
};
