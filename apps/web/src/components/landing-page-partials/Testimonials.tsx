import { useTranslation } from 'react-i18next';
import { Marquee } from '@refly-packages/ai-workspace-common/components/magicui/marquee';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { useTweet } from 'react-tweet';
import { IconX } from '@refly-packages/ai-workspace-common/components/common/icon';

interface TweetData {
  id: string;
  contentZh?: string;
}

const TWEET_IDS_FIRST_ROW: TweetData[] = [
  { id: '1882797477121925273' },
  { id: '1882789803449876645' },
  { id: '1879195537259294991' },
  { id: '1882730661271994673' },
  { id: '1882778663164461111' },
  { id: '1868591313610060206' },
];

const TWEET_IDS_SECOND_ROW: TweetData[] = [
  { id: '1889491864840974509' },
  { id: '1877350794896486572' },
  { id: '1882874005788770575' },
  { id: '1882742355515908538' },
  { id: '1884418437193052270' },
  { id: '1887614494794555857' },
];

const TWEET_IDS_THIRD_ROW: TweetData[] = [
  { id: '1883034913466925505' },
  { id: '1869561187584860352' },
  { id: '1883833351821492413' },
  { id: '1882968963644305772' },
  { id: '1882819143860113520' },
  { id: '1882806694377631761' },
];

const truncate = (str: string | null, length: number) => {
  if (!str || str.length <= length) return str;
  return `${str.slice(0, length - 3)}...`;
};

const ReviewCard = ({ id }: TweetData) => {
  const { data: tweet } = useTweet(id);

  if (!tweet) return null;

  const content = truncate(tweet.text, 280);

  return (
    <figure
      className={cn(
        'relative h-full w-64 cursor-pointer overflow-hidden rounded-xl border p-4',
        'border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]',
        'dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]',
      )}
    >
      <div className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            className="rounded-full"
            width="32"
            height="32"
            alt={tweet.user.screen_name}
            src={tweet.user.profile_image_url_https}
          />
          <div className="flex flex-col">
            <figcaption className="text-sm font-medium dark:text-white">
              {tweet.user.name}
            </figcaption>
            <p className="text-xs font-medium dark:text-white/40">@{tweet.user.screen_name}</p>
          </div>
        </div>
        <a
          href={`https://twitter.com/${tweet.user.screen_name}/status/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-600 transition-colors hover:text-gray-800"
        >
          <IconX className="text-xl" />
        </a>
      </div>
      <blockquote className="mt-2 text-sm">{content}</blockquote>
    </figure>
  );
};

export default function Testimonials() {
  const { t } = useTranslation();

  const firstRow = TWEET_IDS_FIRST_ROW;
  const secondRow = TWEET_IDS_SECOND_ROW;
  const thirdRow = TWEET_IDS_THIRD_ROW;

  return (
    <section className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="text-center">
        <span
          className="mb-8 inline-flex items-center justify-center rounded-lg border border-solid border-black/10 bg-white px-6 py-2 font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-sm"
          style={{
            boxShadow:
              '0 3px 20px 0 rgba(0,0,0,0.10), 0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(227,227,227,0.50)',
          }}
        >
          <IconX className="mr-2" />
          <span>{t('landingPage.testimonials.tag')}</span>
        </span>
        <h2 className="mt-4 font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-3xl md:text-4xl">
          {t('landingPage.testimonials.title')}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          {t('landingPage.testimonials.description')}
        </p>
      </div>

      <div className="relative mt-16 flex w-full flex-col items-center justify-center overflow-hidden">
        <Marquee pauseOnHover className="[--duration:20s]">
          {firstRow.map((tweet) => (
            <ReviewCard key={tweet.id} {...tweet} />
          ))}
        </Marquee>
        <Marquee reverse pauseOnHover className="[--duration:20s]">
          {secondRow.map((tweet) => (
            <ReviewCard key={tweet.id} {...tweet} />
          ))}
        </Marquee>
        <Marquee pauseOnHover className="[--duration:20s]">
          {thirdRow.map((tweet) => (
            <ReviewCard key={tweet.id} {...tweet} />
          ))}
        </Marquee>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-background" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-background" />
      </div>
    </section>
  );
}
