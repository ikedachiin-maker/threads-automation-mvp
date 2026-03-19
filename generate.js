/**
 * 投稿生成メインスクリプト
 * ライター → 品質採点 → 類似度チェック → キュー追加
 */

const fs = require('fs');
const path = require('path');
const writer = require('./agents/writer');
const qualityScorer = require('./utils/quality_scorer');
const similarity = require('./utils/similarity');
const config = require('./config.json');

/**
 * 状態ファイルを読み込み
 */
function loadState(filename) {
  const filePath = path.join(__dirname, 'state', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * 状態ファイルを保存
 */
function saveState(filename, data) {
  const filePath = path.join(__dirname, 'state', filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * キューに追加
 */
function enqueue(posts) {
  const queue = loadState('post_queue.json');

  queue.queue.push(...posts);
  queue.last_updated = new Date().toISOString();

  saveState('post_queue.json', queue);

  console.log(`\n✅ ${posts.length}件をキューに追加しました`);
  console.log(`現在のキュー数: ${queue.queue.length}件\n`);
}

/**
 * メイン処理
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  Threads投稿自動生成システム');
  console.log('='.repeat(60) + '\n');

  const batchSize = config.generation.batch_size || 5;
  const minScore = config.quality.min_score || 7.0;
  const maxRetries = config.quality.max_retries || 2;
  const similarityThreshold = config.similarity.threshold || 0.85;

  console.log(`設定:`);
  console.log(`  生成数: ${batchSize}本`);
  console.log(`  品質スコア合格ライン: ${minScore}/10.0`);
  console.log(`  最大書き直し回数: ${maxRetries}回`);
  console.log(`  類似度閾値: ${(similarityThreshold * 100).toFixed(0)}%`);
  console.log('');

  // Step 1: 投稿を生成
  console.log('━'.repeat(60));
  console.log('STEP 1: 投稿生成');
  console.log('━'.repeat(60));

  const generatedPosts = await writer.generateBatch(batchSize);

  if (generatedPosts.length === 0) {
    console.log('❌ 投稿生成に失敗しました');
    return;
  }

  // Step 2: 品質スコア採点
  console.log('\n' + '━'.repeat(60));
  console.log('STEP 2: 品質スコア採点');
  console.log('━'.repeat(60));

  const persona = writer.loadKnowledge('persona.json');
  const patterns = writer.loadKnowledge('post_patterns.json');

  const scoredPosts = [];

  for (const post of generatedPosts) {
    let currentPost = post;
    let retries = 0;
    let passed = false;

    while (retries <= maxRetries && !passed) {
      console.log(`\n採点中: "${currentPost.text.substring(0, 40)}..." (${retries > 0 ? `書き直し${retries}回目` : '初回'})`);

      const score = await qualityScorer.scorePost(
        currentPost.text,
        persona,
        currentPost.pattern_name || currentPost.pattern
      );

      const isPass = score.success && score.average >= minScore;

      console.log(`  スコア: ${score.average}/10.0 ${isPass ? '✅ 合格' : '❌ 不合格'}`);

      if (score.success && score.feedback) {
        console.log(`  フィードバック: ${score.feedback}`);
      }

      if (isPass) {
        currentPost.quality_score = score;
        scoredPosts.push(currentPost);
        passed = true;
      } else if (retries < maxRetries) {
        // 書き直し
        console.log(`  🔄 書き直します...`);
        const pattern = patterns.patterns.find(p => p.id === currentPost.pattern);
        currentPost = await writer.rewritePost(currentPost, score, persona, pattern);
        retries++;

        // API制限対策: 2秒待機
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log(`  ❌ ${maxRetries}回書き直しても合格できず、棄却します`);
        retries++;
      }

      // API制限対策: 1秒待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n品質チェック結果: ${scoredPosts.length}/${generatedPosts.length}本が合格\n`);

  if (scoredPosts.length === 0) {
    console.log('❌ 合格した投稿がありません');
    return;
  }

  // Step 3: 類似度チェック
  console.log('━'.repeat(60));
  console.log('STEP 3: 類似度チェック');
  console.log('━'.repeat(60) + '\n');

  const postHistory = loadState('post_history.json');

  const checkedPosts = similarity.batchCheckSimilarity(
    scoredPosts,
    postHistory.posts,
    similarityThreshold
  );

  const uniquePosts = checkedPosts.filter(p => p.similarity_check.pass);

  console.log(`\n類似度チェック結果: ${uniquePosts.length}/${scoredPosts.length}本がユニーク\n`);

  if (uniquePosts.length === 0) {
    console.log('❌ ユニークな投稿がありません（全て類似度オーバー）');
    return;
  }

  // Step 4: キューに追加
  console.log('━'.repeat(60));
  console.log('STEP 4: キューに追加');
  console.log('━'.repeat(60));

  enqueue(uniquePosts);

  // 統計表示
  console.log('━'.repeat(60));
  console.log('完了統計');
  console.log('━'.repeat(60));
  console.log(`生成数: ${generatedPosts.length}本`);
  console.log(`品質合格: ${scoredPosts.length}本`);
  console.log(`類似度合格: ${uniquePosts.length}本`);
  console.log(`キュー追加: ${uniquePosts.length}本`);
  console.log('━'.repeat(60) + '\n');

  console.log('✨ 投稿生成が完了しました！');
  console.log('\n次のコマンドで投稿を実行できます:');
  console.log('  node post.js\n');
}

// スクリプト実行
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { main };
