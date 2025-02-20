import { getTweet } from 'react-tweet/api';

export interface TweetData {
  id: string;
  name: string;
  username: string;
  avatar: string;
  content: string;
  contentZh?: string;
}

const TWEET_IDS = [
  '1668408059125702661',
  '1668408059125702661',
  '1668408059125702661',
  '1668408059125702661',
  '1668408059125702661',
  '1668408059125702661',
];

export const truncateText = (text: string, length: number) => {
  if (!text || text.length <= length) return text;
  return `${text.slice(0, length)}...`;
};

export const fetchTweetData = async (tweetId: string): Promise<TweetData | null> => {
  try {
    const tweet = await getTweet(tweetId);
    if (!tweet) return null;

    return {
      id: tweet.id_str,
      name: tweet.user.name,
      username: `@${tweet.user.screen_name}`,
      avatar: tweet.user.profile_image_url_https,
      content: truncateText(tweet.text, 100),
      // You can integrate with translation service here
      contentZh: truncateText(tweet.text, 100), // Placeholder for Chinese translation
    };
  } catch (error) {
    console.error('Error fetching tweet:', error);
    return null;
  }
};
export const getAllTweetData = async (): Promise<TweetData[]> => {
  const tweets = await Promise.all(TWEET_IDS.map((id) => fetchTweetData(id)));
  return tweets.filter((tweet): tweet is TweetData => tweet !== null);
};
