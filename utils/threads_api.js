/**
 * Threads API Wrapper
 * Instagram Graph API経由でThreadsに投稿する
 */

const axios = require('axios');
require('dotenv').config();

const THREADS_ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN;
const THREADS_USER_ID = process.env.THREADS_USER_ID;
const API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

/**
 * Threads投稿を作成
 * @param {string} text - 投稿本文
 * @param {string|null} replyToId - 返信先の投稿ID（ツリー展開用）
 * @returns {Promise<object>} 投稿結果
 */
async function createPost(text, replyToId = null) {
  if (!THREADS_ACCESS_TOKEN || !THREADS_USER_ID) {
    throw new Error('THREADS_ACCESS_TOKEN and THREADS_USER_ID must be set in .env');
  }

  try {
    // Step 1: メディアコンテナ作成
    const containerPayload = {
      media_type: 'TEXT',
      text: text,
      access_token: THREADS_ACCESS_TOKEN
    };

    if (replyToId) {
      containerPayload.reply_to_id = replyToId;
    }

    const containerResponse = await axios.post(
      `${BASE_URL}/${THREADS_USER_ID}/threads`,
      containerPayload
    );

    const creationId = containerResponse.data.id;

    // Step 2: 投稿を公開
    const publishResponse = await axios.post(
      `${BASE_URL}/${THREADS_USER_ID}/threads_publish`,
      {
        creation_id: creationId,
        access_token: THREADS_ACCESS_TOKEN
      }
    );

    return {
      success: true,
      post_id: publishResponse.data.id,
      creation_id: creationId
    };

  } catch (error) {
    console.error('Threads API Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
}

/**
 * 投稿にコメントを追加（コメント誘導型・ツリー展開型用）
 * @param {string} postId - 親投稿のID
 * @param {string} text - コメント本文
 * @returns {Promise<object>} コメント結果
 */
async function addComment(postId, text) {
  return await createPost(text, postId);
}

/**
 * 投稿のメトリクスを取得（フェッチャー用）
 * @param {string} postId - 投稿ID
 * @returns {Promise<object>} メトリクス
 */
async function getPostMetrics(postId) {
  if (!THREADS_ACCESS_TOKEN) {
    throw new Error('THREADS_ACCESS_TOKEN must be set in .env');
  }

  try {
    const response = await axios.get(
      `${BASE_URL}/${postId}`,
      {
        params: {
          fields: 'id,text,timestamp,username,permalink,is_reply,views,likes,replies,quotes,reposts',
          access_token: THREADS_ACCESS_TOKEN
        }
      }
    );

    return {
      success: true,
      metrics: {
        views: response.data.views || 0,
        likes: response.data.likes || 0,
        replies: response.data.replies || 0,
        quotes: response.data.quotes || 0,
        reposts: response.data.reposts || 0
      },
      post: response.data
    };

  } catch (error) {
    console.error('Threads Metrics Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
}

/**
 * ユーザー情報を取得
 * @returns {Promise<object>} ユーザー情報
 */
async function getUserInfo() {
  if (!THREADS_ACCESS_TOKEN || !THREADS_USER_ID) {
    throw new Error('THREADS_ACCESS_TOKEN and THREADS_USER_ID must be set in .env');
  }

  try {
    const response = await axios.get(
      `${BASE_URL}/${THREADS_USER_ID}`,
      {
        params: {
          fields: 'id,username,threads_profile_picture_url,threads_biography',
          access_token: THREADS_ACCESS_TOKEN
        }
      }
    );

    return {
      success: true,
      user: response.data
    };

  } catch (error) {
    console.error('Threads User Info Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
}

module.exports = {
  createPost,
  addComment,
  getPostMetrics,
  getUserInfo
};
