import { useTranslation } from 'react-i18next';
import { Tweet } from 'react-tweet';
import { AiOutlineTwitter } from 'react-icons/ai';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';

function Testimonials() {
  const { t, i18n } = useTranslation();
  const isZhCN = i18n.language === 'zh-CN';

  // Real tweet IDs showcasing positive feedback about Refly
  const tweetIds = [
    '1668408059125702661', // @devagrawal09
    '1668408059125702661', // @devagrawal09
    '1668408059125702661', // @devagrawal09
    '1668408059125702661', // @devagrawal09
    '1668408059125702661', // @devagrawal09
    '1668408059125702661', // @devagrawal09
  ];

  return (
    <section className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
      {/* Header */}
      <div className="text-center">
        <span
          className="mb-8 inline-flex items-center justify-center rounded-lg border border-solid border-black/10 bg-white px-6 py-2 font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-sm"
          style={{
            boxShadow:
              '0 3px 20px 0 rgba(0,0,0,0.10), 0 2px 4px 0 rgba(0,0,0,0.10), inset 0 -4px 0 0 rgba(227,227,227,0.50)',
          }}
        >
          <AiOutlineTwitter className="mr-2 text-[#1DA1F2]" />
          <span>{t('landingPage.testimonials.tag')}</span>
        </span>
        <h2 className="mt-4 font-['Alibaba_PuHuiTi_Bold',system-ui,-apple-system,sans-serif] text-3xl md:text-4xl">
          {isZhCN ? (
            <>
              用户
              <div className="mt-2">
                <span className="relative text-[#1DA1F2]">
                  真实反馈
                  <span className="absolute bottom-0 left-0 h-1 w-full bg-[#1DA1F2]" />
                </span>
              </div>
            </>
          ) : (
            <>
              What People Are
              <div className="mt-2">
                <span className="relative text-[#1DA1F2]">
                  Saying
                  <span className="absolute bottom-0 left-0 h-1 w-full bg-[#1DA1F2]" />
                </span>
              </div>
            </>
          )}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          {t('landingPage.testimonials.description')}
        </p>
      </div>

      {/* Tweet Grid */}
      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tweetIds.map((tweetId) => (
          <div
            key={tweetId}
            className={cn(
              'group relative overflow-hidden rounded-xl border border-black/5 bg-white p-4 transition-all duration-300',
              'hover:border-black/10 hover:shadow-lg hover:-translate-y-1',
            )}
          >
            <Tweet id={tweetId} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default Testimonials;
