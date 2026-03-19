/**
 * ポスター（投稿実行担当）
 * キューから投稿を取得してThreadsに投稿
 */

const fs = require('fs');
const path = require('path');
const threadsApi = require('../utils/threads_api');
require('dotenv').config();

const DRY_RUN = process.env.DRY_RUN === 'true';

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
 * 状態ファイルを保存
 * @param {string} filename - ファイル名
 * @param {object} data - 保存するデータ
 */
function saveState(filename, data) {
  const filePath = path.join(__dirname, '..', 'state', filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * キューから1件取得
 * @returns {object|null} 投稿データ
 */
function dequeue() {
  const queue = loadState('post_queue.json');

  if (queue.queue.length === 0) {
    return null;
  }

  const post = queue.queue.shift();
  queue.last_updated = new Date().toISOString();

  saveState('post_queue.json', queue);

  return post;
}

/**
 * 投稿履歴に追加
 * @param {object} post - 投稿データ
 * @param {object} result - 投稿結果
 */
function addToHistory(post, result) {
  const history = loadState('post_history.json');

  history.posts.push({
    ...post,
    post_id: result.post_id || null,
    posted_at: new Date().toISOString(),
    success: result.success,
    error: result.error || null
  });

  history.total_count = history.posts.length;
  history.last_posted = new Date().toISOString();

  saveState('post_history.json', history);
}

/**
 * 最後の投稿からの経過時間をチェック（時間）
 * @returns {number|null} 経過時間（時間）、履歴がない場合はnull
 */
function getHoursSinceLastPost() {
  const history = loadState('post_history.json');

  if (!history.last_posted) {
    return null;
  }

  const lastPosted = new Date(history.last_posted);
  const now = new Date();
  const diffMs = now - lastPosted;
  const diffHours = diffMs / (1000 * 60 * 60);

  return diffHours;
}

/**
 * 投稿を実行
 * @param {object} post - 投稿データ
 * @returns {Promise<object>} 投稿結果
 */
async function executePost(post) {
  // DRY_RUNモードの場合はプレビューのみ
  if (DRY_RUN) {
    console.log('\n🔍 DRY_RUNモード: 実際の投稿はされません\n');
    console.log('【投稿プレビュー】');
    console.log('─'.repeat(50));
    console.log(post.text);
    console.log('─'.repeat(50));
    console.log(`パターン: ${post.pattern_name || post.pattern}`);
    console.log(`テーマ: ${post.topic}`);
    console.log(`生成日時: ${post.generated_at}`);
    console.log('');

    return {
      success: true,
      post_id: 'dry_run_' + Date.now(),
      dry_run: true
    };
  }

  // 実際に投稿
  console.log('\n🚀 投稿を実行します...\n');

  try {
    const result = await threadsApi.createPost(post.text);

    if (result.success) {
      console.log('✅ 投稿成功！');
      console.log(`投稿ID: ${result.post_id}`);
    } else {
      console.log('❌ 投稿失敗');
      console.log(`エラー: ${result.error}`);
    }

    return result;

  } catch (error) {
    console.error('投稿エラー:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * コメント追加（コメント誘導型・ツリー展開型用）
 * @param {string} postId - 親投稿ID
 * @param {string} commentText - コメント本文
 * @returns {Promise<object>} 投稿結果
 */
async function addComment(postId, commentText) {
  if (DRY_RUN) {
    console.log('\n💬 コメント追加（DRY_RUN）');
    console.log(`親投稿ID: ${postId}`);
    console.log(`コメント: ${commentText}`);
    return {
      success: true,
      post_id: 'dry_run_comment_' + Date.now(),
      dry_run: true
    };
  }

  try {
    const result = await threadsApi.addComment(postId, commentText);

    if (result.success) {
      console.log('✅ コメント追加成功');
    } else {
      console.log('❌ コメント追加失敗:', result.error);
    }

    return result;

  } catch (error) {
    console.error('コメント追加エラー:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 投稿間隔チェック（最低1時間空ける）
 * @param {number} minHours - 最低間隔（時間）
 * @returns {boolean} true = OK, false = NG
 */
function checkPostingInterval(minHours = 1) {
  const hoursSince = getHoursSinceLastPost();

  if (hoursSince === null) {
    return true; // 初回投稿
  }

  if (hoursSince < minHours) {
    console.log(`⚠️ 投稿間隔が短すぎます`);
    console.log(`最後の投稿から ${hoursSince.toFixed(1)}時間（最低${minHours}時間必要）`);
    return false;
  }

  return true;
}

/**
 * キューの先頭を投稿
 * @param {boolean} forcePost - 投稿間隔を無視して強制実行
 * @returns {Promise<object>} 結果
 */
async function postNext(forcePost = false) {
  console.log('\n📮 キューから投稿を取得...\n');

  // キューから取得
  const post = dequeue();

  if (!post) {
    console.log('❌ キューが空です');
    return {
      success: false,
      error: 'Queue is empty'
    };
  }

  console.log(`取得: "${post.text.substring(0, 40)}..."`);

  // 投稿間隔チェック
  if (!forcePost && !checkPostingInterval(1)) {
    console.log('\n⏸️ 投稿をスキップします（間隔不足）\n');

    // キューに戻す
    const queue = loadState('post_queue.json');
    queue.queue.unshift(post);
    saveState('post_queue.json', queue);

    return {
      success: false,
      error: 'Posting interval too short'
    };
  }

  // 投稿実行
  const result = await executePost(post);

  // 履歴に追加
  addToHistory(post, result);

  console.log('\n✨ 完了\n');

  return result;
}

module.exports = {
  executePost,
  addComment,
  postNext,
  dequeue,
  addToHistory,
  checkPostingInterval,
  getHoursSinceLastPost
};
