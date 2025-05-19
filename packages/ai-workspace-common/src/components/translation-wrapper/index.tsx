import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Spin } from 'antd';
import cn from 'classnames';
import './index.scss';
import { LoadingOutlined } from '@ant-design/icons';

// Enhance cache with pending promises to prevent duplicate requests
const translationCache: Record<string, string | Promise<string>> = {};
const getCacheKey = (text: string, source: string, target: string) => `${source}:${target}:${text}`;

interface TranslationWrapperProps {
  content: string;
  targetLanguage: string;
  originalLocale?: string;
  className?: string;
  enableTranslation?: boolean;
}

// 限制请求频率的延迟时间（毫秒）
const THROTTLE_DELAY = 200;

// Create a debounced queue processor
const debouncedProcessQueue = debounce(async () => {
  if (pendingTranslations.size === 0) return;

  // Process all pending translations in one batch
  const currentBatch = new Set(pendingTranslations);
  pendingTranslations.clear();

  for (const task of currentBatch) {
    await task();
    await new Promise((resolve) => setTimeout(resolve, THROTTLE_DELAY));
  }
}, 100);

// Track pending translations
const pendingTranslations = new Set<() => Promise<void>>();

export const TranslationWrapper: React.FC<TranslationWrapperProps> = ({
  content,
  targetLanguage,
  originalLocale,
  className,
  enableTranslation = true,
}) => {
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Memoize key computation and translation check
  const { shouldTranslate, cacheKey } = useMemo(
    () => ({
      shouldTranslate:
        enableTranslation &&
        targetLanguage !== 'auto' &&
        (!originalLocale || originalLocale !== targetLanguage),
      cacheKey: getCacheKey(content, originalLocale || 'auto', targetLanguage),
    }),
    [content, originalLocale, targetLanguage, enableTranslation],
  );

  const translateText = useCallback(
    async (text: string): Promise<string> => {
      try {
        const response = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${
            originalLocale || 'auto'
          }&tl=${targetLanguage}&q=${encodeURIComponent(text)}`,
        );
        const data = await response.json();
        return data[0][0][0];
      } catch (error) {
        console.error('Translation failed:', error);
        return text;
      }
    },
    [originalLocale, targetLanguage],
  );

  useEffect(() => {
    if (!shouldTranslate || !content) {
      setTranslatedContent(null);
      return;
    }

    let isMounted = true;

    const performTranslation = async () => {
      // Check if there's a cached result or pending promise
      let result = translationCache[cacheKey];

      if (!result) {
        // Create new translation promise
        setIsLoading(true);
        const translationPromise = translateText(content);
        translationCache[cacheKey] = translationPromise;

        result = await translationPromise;
        // Cache the final result
        translationCache[cacheKey] = result;
      } else if (result instanceof Promise) {
        // Wait for pending translation
        result = await result;
      }

      // Only update state if component is still mounted
      if (isMounted) {
        setTranslatedContent(result);
        setIsLoading(false);
      }
    };

    // Add translation task to pending queue
    pendingTranslations.add(performTranslation);
    debouncedProcessQueue();

    return () => {
      isMounted = false;
      pendingTranslations.delete(performTranslation);
    };
  }, [content, shouldTranslate, cacheKey, translateText]);

  // Early return for unchanged content
  if (!shouldTranslate || translatedContent === content) {
    return <span className={cn('dark:text-gray-500', className)}>{content}</span>;
  }

  return (
    <div className={`translation-wrapper ${className ?? ''}`}>
      <div className="translation-content">
        {isLoading ? (
          <>
            <span className="original-text">{content}</span>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 12, marginLeft: 4 }} spin />} />
          </>
        ) : (
          <span>{translatedContent ?? content}</span>
        )}
      </div>
    </div>
  );
};

// Utility function for debouncing
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
