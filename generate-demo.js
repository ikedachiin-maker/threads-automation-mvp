/**
 * デモモード: APIキーなしで動作確認
 * 事前に用意したサンプル投稿を使用
 */

const fs = require('fs');
const path = require('path');

// デモ用のサンプル投稿
const DEMO_POSTS = [
  {
    text: "転職エージェントに騙されるな。\n\n手数料は年収の30%。\nだから高年収の求人ばっか勧めてくる。\n\nあなたに合ってるかどうかは二の次。",
    pattern: "short_complete",
    pattern_name: "短文完結型",
    topic: "エージェント活用",
    keywords: ["エージェント", "手数料", "仕組み"],
    generated_at: new Date().toISOString(),
    quality_score: {
      scores: {
        hook: 9,
        value: 8,
        specificity: 9,
        tempo: 8,
        persona_match: 9,
        readability: 8,
        action: 7,
        uniqueness: 8,
        emotion: 9,
        completeness: 8
      },
      average: 8.3,
      pass: true,
      feedback: "フックが強く、具体的な数字（30%）で説得力がある。転職ジャンルの人格とも一致。"
    },
    similarity_check: {
      pass: true,
      max_similarity: 0.0,
      similar_posts: []
    }
  },
  {
    text: "年収交渉で100万上げる方法、知りたい人いる？\n\n実は3つのステップだけ。\n\n1. 自分の市場価値を調べる\n2. 複数社から内定をもらう\n3. 一番高い金額を他社にぶつける\n\nこれだけで年収100万変わる。",
    pattern: "demand_check",
    pattern_name: "需要確認型",
    topic: "年収交渉",
    keywords: ["年収", "交渉", "オファー"],
    generated_at: new Date().toISOString(),
    quality_score: {
      scores: {
        hook: 8,
        value: 9,
        specificity: 9,
        tempo: 8,
        persona_match: 8,
        readability: 9,
        action: 9,
        uniqueness: 7,
        emotion: 8,
        completeness: 8
      },
      average: 8.3,
      pass: true,
      feedback: "需要確認型の構造が効果的。具体的な3ステップで実用性高い。"
    },
    similarity_check: {
      pass: true,
      max_similarity: 0.0,
      similar_posts: []
    }
  },
  {
    text: "面接で落ちる人の共通点3つ見つけた。\n\n①準備不足（企業研究してない）\n②自己分析できてない（強み言えない）\n③逆質問が弱い（給料の話しかしない）\n\nこれ、全部当てはまってたら99%落ちる。",
    pattern: "list",
    pattern_name: "リスト型",
    topic: "面接攻略",
    keywords: ["面接", "失敗", "準備不足"],
    generated_at: new Date().toISOString(),
    quality_score: {
      scores: {
        hook: 8,
        value: 9,
        specificity: 8,
        tempo: 9,
        persona_match: 8,
        readability: 9,
        action: 7,
        uniqueness: 7,
        emotion: 8,
        completeness: 8
      },
      average: 8.1,
      pass: true,
      feedback: "リスト形式で読みやすく、具体的。最後の「99%」で強調も効果的。"
    },
    similarity_check: {
      pass: true,
      max_similarity: 0.0,
      similar_posts: []
    }
  },
  {
    text: "「転職は3年我慢してから」\n\n嘘です。\n\nブラック企業なら1日でも早く辞めろ。\n時間の無駄だから。\n\n若い時間は戻ってこない。",
    pattern: "antithesis",
    pattern_name: "アンチテーゼ型",
    topic: "転職タイミング",
    keywords: ["退職", "タイミング", "3年"],
    generated_at: new Date().toISOString(),
    quality_score: {
      scores: {
        hook: 9,
        value: 8,
        specificity: 7,
        tempo: 9,
        persona_match: 9,
        readability: 9,
        action: 7,
        uniqueness: 8,
        emotion: 9,
        completeness: 8
      },
      average: 8.3,
      pass: true,
      feedback: "常識を覆す主張が強い。短文でテンポよく、感情に訴える。"
    },
    similarity_check: {
      pass: true,
      max_similarity: 0.0,
      similar_posts: []
    }
  },
  {
    text: "職務経歴書、テンプレ使ってる人99%落ちてます。\n\n理由:\n採用担当は1日100枚見てる。\nテンプレは一瞬で見抜かれる。\n\n差をつけるなら:\n・具体的な数字を入れる\n・成果を定量化する\n・あなたしか書けないエピソード入れる\n\nこれだけで書類通過率3倍変わる。",
    pattern: "warning",
    pattern_name: "警告型",
    topic: "転職準備",
    keywords: ["職務経歴書", "書き方", "成果"],
    generated_at: new Date().toISOString(),
    quality_score: {
      scores: {
        hook: 9,
        value: 9,
        specificity: 9,
        tempo: 8,
        persona_match: 8,
        readability: 8,
        action: 8,
        uniqueness: 8,
        emotion: 8,
        completeness: 8
      },
      average: 8.3,
      pass: true,
      feedback: "警告型として効果的。具体的な改善策も提示されていて有益性高い。"
    },
    similarity_check: {
      pass: true,
      max_similarity: 0.0,
      similar_posts: []
    }
  }
];

function loadState(filename) {
  const filePath = path.join(__dirname, 'state', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveState(filename, data) {
  const filePath = path.join(__dirname, 'state', filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function enqueue(posts) {
  const queue = loadState('post_queue.json');
  queue.queue.push(...posts);
  queue.last_updated = new Date().toISOString();
  saveState('post_queue.json', queue);
  console.log(`\n✅ ${posts.length}件をキューに追加しました`);
  console.log(`現在のキュー数: ${queue.queue.length}件\n`);
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  デモモード: サンプル投稿を使用');
  console.log('='.repeat(60) + '\n');

  console.log('⚠️ APIキー不要のデモモードで実行します\n');

  console.log('━'.repeat(60));
  console.log('サンプル投稿（5本）');
  console.log('━'.repeat(60) + '\n');

  DEMO_POSTS.forEach((post, i) => {
    console.log(`[${i + 1}] ${post.pattern_name}`);
    console.log(`テーマ: ${post.topic}`);
    console.log(`品質スコア: ${post.quality_score.average}/10.0 ✅`);
    console.log(`類似度チェック: ✅ パス`);
    console.log('─'.repeat(40));
    console.log(post.text);
    console.log('─'.repeat(40));
    console.log('');
  });

  console.log('━'.repeat(60));
  console.log('キューに追加');
  console.log('━'.repeat(60));

  enqueue(DEMO_POSTS);

  console.log('✨ デモ投稿の生成が完了しました！');
  console.log('\n次のコマンドで投稿を実行できます:');
  console.log('  node post.js\n');
}

if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ エラーが発生しました:', error.message);
    process.exit(1);
  });
}

module.exports = { main, DEMO_POSTS };
