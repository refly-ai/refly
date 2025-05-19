import { Popover, PopoverContent, PopoverTrigger } from './popover';

import { Source } from '@refly/openapi-schema';

function ATag({ ...props }, sources: Source[]) {
  if (!props.href) return <></>;
  const source = sources[+props.href - 1];
  if (!source) {
    try {
      const num = Number(props.href);
      if (!Number.isNaN(num) && num > sources.length) {
        // console.log('source not found', props);
        return <></>;
      }
    } catch (_err) {}

    // Add security check for href
    const href = props.href.toLowerCase();
    if (href.startsWith('javascript:')) {
      return <span>{props.children}</span>;
    }

    return (
      <a
        href={props.href}
        target="_blank"
        rel="noopener noreferrer"
        className="no-underline text-[#00968F]"
      >
        {props.children}
      </a>
    );
  }
  return (
    <span className="inline-block w-4">
      <Popover>
        <PopoverTrigger asChild>
          <span
            title={source.metadata?.title}
            className="inline-block h-6 !w-6 origin-top-left scale-[60%] transform cursor-pointer rounded-full bg-zinc-300 text-center font-medium no-underline hover:bg-zinc-400 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            {props.href}
          </span>
        </PopoverTrigger>
        <PopoverContent
          align={'start'}
          className="flex flex-col gap-2 max-w-screen-md text-xs ring-4 shadow-transparent ring-zinc-50 dark:ring-gray-700 dark:bg-gray-800"
        >
          <div className="overflow-hidden font-medium whitespace-normal break-words">
            {source.title}
          </div>
          <div className="flex gap-4">
            <div className="flex-1 w-full">
              <div className="break-words line-clamp-4 text-zinc-500 whitespace-normal text-wrap overflow-y-auto">
                {source.pageContent}
              </div>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <div className="overflow-hidden flex-1">
              <div className="overflow-hidden text-blue-500 dark:text-gray-200 whitespace-normal break-words">
                <a
                  title={source?.title}
                  href={source?.url}
                  target="_blank"
                  className="no-underline text-[#00968F]"
                  rel="noreferrer"
                >
                  {source?.url}
                </a>
              </div>
            </div>
            <div className="flex relative flex-none items-center">
              <img
                className="w-3 h-3"
                alt={source?.url}
                src={`https://www.google.com/s2/favicons?domain=${source?.url}&sz=${16}`}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}

export default ATag;
