import { getAuthHeaders } from '../db';

export interface GenerateArticleInput {
  words: Array<{ word: string; meaning: string }>;
  level?: string;
  topic?: string;
}

/**
 * 调用后端 /api/ai/generate-article 生成包含指定单词的英文文章
 */
export async function generateArticle(input: GenerateArticleInput): Promise<string> {
  const response = await fetch('/api/ai/generate-article', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(input),
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error ?? '生成文章失败');
  }

  const article = data.data?.article;
  if (!article) {
    throw new Error('服务返回了空文章');
  }

  return article;
}
