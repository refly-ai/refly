import { FaGithub } from 'react-icons/fa6';
import { useEffect, useState } from 'react';

export const GithubStar = () => {
  const [starCount, setStarCount] = useState('4.3k');

  const handleClick = () => {
    window.open('https://github.com/refly-ai/refly', '_blank');
  };

  useEffect(() => {
    fetch('https://api.github.com/repos/refly-ai/refly')
      .then((res) => res.json())
      .then((data) => {
        const stars = data.stargazers_count;
        setStarCount(stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars.toString());
      })
      .catch(() => {});
  }, []);

  return (
    <div
      className="flex overflow-hidden gap-0.5 justify-center items-center self-stretch px-2 py-1 my-auto text-xs font-semibold leading-none text-center whitespace-nowrap bg-white rounded-xl border border-solid border-black border-opacity-10 text-zinc-900 cursor-pointer hover:bg-gray-100"
      onClick={handleClick}
    >
      <FaGithub className="object-contain shrink-0 self-stretch my-auto w-3 aspect-square fill-zinc-900" />
      <span className="leading-4 self-stretch my-auto text-zinc-900">{starCount}</span>
    </div>
  );
};
