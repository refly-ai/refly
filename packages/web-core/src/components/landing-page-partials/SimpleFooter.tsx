import React from 'react';
import { Link } from 'react-router-dom';
import {
  IconX,
  IconGithub,
  IconDiscord,
  IconEmail,
} from '@refly-packages/ai-workspace-common/components/common/icon';

const SimpleFooter = React.memo(() => {
  return (
    <footer className="w-full bg-white px-6 py-4 dark:bg-gray-900/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Copyright Info */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} Powerformer, Inc. All rights reserved.
        </div>

        {/* Social Media Links */}
        <div className="flex items-center gap-2">
          <Link
            to="https://twitter.com/reflyai"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md p-2 text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Twitter"
          >
            <IconX className="h-4 w-4" />
          </Link>
          <Link
            to="https://github.com/refly-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md p-2 text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="GitHub"
          >
            <IconGithub className="h-4 w-4" />
          </Link>
          <Link
            to="https://discord.gg/YVuYFjFvRC"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md p-2 text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Discord"
          >
            <IconDiscord className="h-4 w-4" />
          </Link>
          <Link
            to="mailto:support@refly.ai"
            className="rounded-md p-2 text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Email"
          >
            <IconEmail className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </footer>
  );
});

SimpleFooter.displayName = 'SimpleFooter';

export default SimpleFooter;
