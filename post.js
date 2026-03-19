/**
 * 投稿実行メインスクリプト
 * キューから取得 → 投稿間隔チェック → Threads投稿
 */

const fs = require('fs');
const path = require('path');
const poster = require('./agents/poster');
const config = require('./config.json');

/**
 * 状態ファイルを読み込み
 */
function loadState(filename) {
  const filePath = path.join(__dirname, 'state', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * メイン処理
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  Threads投稿実行システム');
  console.log('='.repeat(60) + '\n');

  const minInterval = config.posting.min_interval_hours || 1;

  console.log(`設定:`);
  console.log(`  最低投稿間隔: ${minInterval}時間`);
  console.log(`  DRY_RUN: ${process.env.DRY_RUN === 'true' ? 'true（テストモード）' : 'false（本番モード）'}`);
  console.log('');

  // キューの確認
  const queue = loadState('post_queue.json');
  console.log(`現在のキュー数: ${queue.queue.length}件\n`);

  if (queue.queue.length === 0) {
    console.log('❌ キューが空です');
    console.log('\n次のコマンドで投稿を生成してください:');
    console.log('  node generate.js\n');
    return;
  }

  // 最後の投稿からの経過時間
  const hoursSince = poster.getHoursSinceLastPost();

  if (hoursSince !== null) {
    console.log(`最後の投稿から ${hoursSince.toFixed(1)}時間経過\n`);
  } else {
    console.log('初回投稿です\n');
  }

  // 投稿実行
  console.log('━'.repeat(60));
  console.log('投稿実行');
  console.log('━'.repeat(60));

  const result = await poster.postNext();

  if (result.success) {
    console.log('━'.repeat(60));
    console.log('✅ 投稿が完了しました！');
    console.log('━'.repeat(60));

    if (result.dry_run) {
      console.log('\n⚠️ DRY_RUNモードのため、実際には投稿されていません');
      console.log('\n本番投稿するには .env ファイルで DRY_RUN=false に設定してください\n');
    } else {
      console.log(`\n投稿ID: ${result.post_id}`);
      console.log('\n投稿が成功しました！Threadsで確認してください。\n');
    }

    // 残りのキュー
    const updatedQueue = loadState('post_queue.json');
    console.log(`残りのキュー数: ${updatedQueue.queue.length}件\n`);

    if (updatedQueue.queue.length > 0) {
      console.log('次の投稿まで最低1時間待つ必要があります。');
      console.log('再度実行するには:');
      console.log('  node post.js\n');
    }

  } else {
    console.log('━'.repeat(60));
    console.log('❌ 投稿に失敗しました');
    console.log('━'.repeat(60));
    console.log(`\nエラー: ${result.error}\n`);

    if (result.error === 'Posting interval too short') {
      console.log(`最後の投稿から${minInterval}時間以上経過してから再実行してください。`);
      console.log('\n強制実行する場合（テスト用）:');
      console.log('  node post.js --force\n');
    }
  }
}

// コマンドライン引数の処理
const args = process.argv.slice(2);
const forcePost = args.includes('--force') || args.includes('-f');

if (forcePost) {
  console.log('\n⚠️ 強制実行モード: 投稿間隔チェックをスキップします\n');
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
