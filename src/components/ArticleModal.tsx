import { useState } from 'react';
import {
  Bookmark,
  Check,
  ExternalLink,
  FileText,
  Share2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type { Institution, NewsArticle } from '../types';
import {
  formatShortDate,
  generateArticleSummary,
  recordArticleShare,
  safeExternalHref,
  verificationLabel,
} from '../lib/api';

interface ArticleModalProps {
  article: NewsArticle;
  institution?: Institution;
  isBookmarked: boolean;
  onToggleBookmark: (articleId: string) => void;
  onShared: (articleId: string, newCount: number) => void;
  onClose: () => void;
}

export function ArticleModal({
  article,
  institution,
  isBookmarked,
  onToggleBookmark,
  onShared,
  onClose,
}: ArticleModalProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  const safeSource = safeExternalHref(article.sourceUrl);
  const safeAttachment = safeExternalHref(article.attachmentUrl);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/?article=${article.id}` : '';
  const shareText = encodeURIComponent(`${article.title} — ${institution?.name || 'DILECT'}`);
  const encodedUrl = encodeURIComponent(shareUrl);

  async function handleShare(channelUrl?: string) {
    try {
      const res = await recordArticleShare(article.id);
      onShared(article.id, res.sharesCount);
    } catch {
      // Non-blocking share counter update
    }
    if (channelUrl) {
      window.open(channelUrl, '_blank', 'noopener,noreferrer');
    } else if (navigator.clipboard && shareUrl) {
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleGenerateBrief() {
    if (brief || briefLoading) return;
    setBriefLoading(true);
    setBriefError(null);
    try {
      const result = await generateArticleSummary(article.id);
      setBrief(result.summary);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : 'Unable to prepare summary.');
    } finally {
      setBriefLoading(false);
    }
  }

  const paragraphs = article.body.split(/\n\s*\n/).filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-xs p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="article-modal-title"
      onClick={onClose}
    >
      <article
        className="relative w-full max-w-3xl bg-[#FBF9F5] dark:bg-[#14171D] text-[#1C1917] dark:text-[#F3F1EC] border border-stone-200 dark:border-stone-800 rounded-xl shadow-2xl overflow-hidden my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-stone-200 dark:border-stone-800">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
            <span className="font-semibold text-[#9A3412] dark:text-[#E07A5F]">
              {verificationLabel(article.verificationTier)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{institution?.name || 'Institutional Dispatch'}</span>
            <span aria-hidden="true">·</span>
            <span>{article.category}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0"
            aria-label="Close article"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 sm:px-10 py-8">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mb-3 font-data">
            <span>{formatShortDate(article.publishedAt)}</span>
            <span aria-hidden="true">·</span>
            <span>{article.campus}</span>
            <span aria-hidden="true">·</span>
            <span>{article.faculty}</span>
            <span aria-hidden="true">·</span>
            <span>{article.readTimeMinutes} min read</span>
          </div>

          <h2
            id="article-modal-title"
            className="font-editorial text-2xl sm:text-4xl font-semibold leading-tight text-stone-900 dark:text-stone-50 headline-balance"
          >
            {article.title}
          </h2>

          <p className="mt-4 text-base sm:text-lg text-stone-600 dark:text-stone-300 leading-relaxed">
            {article.deck}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 py-4 border-y border-stone-200 dark:border-stone-800 text-xs">
            <div className="text-stone-700 dark:text-stone-300">
              <span className="font-semibold">{article.authorName}</span>
              <span className="mx-2 text-stone-400">·</span>
              <span className="text-stone-500 dark:text-stone-400">{article.sourceName}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateBrief}
                disabled={briefLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{briefLoading ? 'Preparing...' : brief ? 'Brief Ready' : 'Executive Brief'}</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleBookmark(article.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                  isBookmarked
                    ? 'bg-[#1E3A8A] border-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:border-[#60A5FA] dark:text-stone-950'
                    : 'border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{isBookmarked ? 'Saved' : 'Save'}</span>
              </button>
            </div>
          </div>

          {brief && (
            <div className="mt-6 p-4 rounded-lg bg-[#F4F0E8] dark:bg-[#1B2028] border border-stone-200 dark:border-stone-700">
              <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
                Key Takeaways
              </div>
              <div className="text-sm text-stone-800 dark:text-stone-200 whitespace-pre-line leading-relaxed">
                {brief}
              </div>
            </div>
          )}

          {briefError && (
            <p className="mt-4 text-xs text-red-700 dark:text-red-400">{briefError}</p>
          )}

          <figure className="mt-6">
            {!imgFailed && article.imageUrl ? (
              <img
                src={article.imageUrl}
                alt={article.title}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full aspect-video object-cover rounded-lg border border-stone-200 dark:border-stone-800"
              />
            ) : (
              <div className="w-full aspect-video rounded-lg border border-stone-200 dark:border-stone-800 bg-gradient-to-br from-stone-200 to-stone-100 dark:from-stone-800 dark:to-stone-900 flex flex-col items-center justify-center p-6 text-center">
                <FileText className="w-8 h-8 text-stone-500 mb-2" />
                <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{article.title}</span>
              </div>
            )}
            {article.imageCaption && (
              <figcaption className="mt-2 text-xs italic font-editorial text-stone-500 dark:text-stone-400">
                {article.imageCaption}
              </figcaption>
            )}
          </figure>

          <div className="mt-7 max-w-prose space-y-4 text-[16px] leading-[1.75] text-stone-800 dark:text-stone-200">
            {paragraphs.map((para, idx) => (
              <p
                key={idx}
                className={
                  idx === 0
                    ? 'first-letter:text-5xl first-letter:font-editorial first-letter:font-semibold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-none'
                    : undefined
                }
              >
                {para}
              </p>
            ))}
          </div>

          <div className="mt-8 p-4 rounded-lg border border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-stone-900/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-900 dark:text-stone-100">
              <ShieldCheck className="w-4 h-4 text-[#14532D] dark:text-emerald-400" />
              <span>Source Verification & Provenance</span>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              {article.verificationTier === 'verified_official'
                ? 'Published directly by a verified institutional office or editorial desk on DILECT.'
                : article.verificationTier === 'imported_official'
                  ? 'Automatically collected from an authorized official institutional feed with original attribution preserved.'
                  : 'Submitted by an accredited campus contributor and reviewed by institutional editors.'}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
              {safeSource && (
                <a
                  href={safeSource}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[#1E3A8A] dark:text-[#60A5FA] hover:underline"
                >
                  <span>Original Source</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {safeAttachment && (
                <a
                  href={safeAttachment}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[#9A3412] dark:text-[#E07A5F] hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{article.attachmentLabel || 'Supporting Document'}</span>
                </a>
              )}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 font-data">
              <span>{article.viewsCount.toLocaleString()} views</span>
              <span aria-hidden="true">·</span>
              <span>{article.sharesCount.toLocaleString()} shares</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-stone-500 dark:text-stone-400 mr-1">
                <Share2 className="w-3.5 h-3.5" />
                <span>Share:</span>
              </span>
              <button
                type="button"
                onClick={() => handleShare(`https://wa.me/?text=${shareText}%20${encodedUrl}`)}
                className="px-2.5 py-1.5 rounded border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => handleShare(`https://twitter.com/intent/tweet?text=${shareText}&url=${encodedUrl}`)}
                className="px-2.5 py-1.5 rounded border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
              >
                X
              </button>
              <button
                type="button"
                onClick={() => handleShare(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`)}
                className="px-2.5 py-1.5 rounded border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
              >
                LinkedIn
              </button>
              <button
                type="button"
                onClick={() => handleShare(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`)}
                className="px-2.5 py-1.5 rounded border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
              >
                Facebook
              </button>
              <button
                type="button"
                onClick={() => handleShare()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : null}
                <span>{copied ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
