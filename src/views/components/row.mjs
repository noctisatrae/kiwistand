import htm from "htm";
import vhtml from "vhtml";
import {
  differenceInHours,
  formatDistanceToNowStrict as originalFormatDistance,
} from "date-fns";
import { URL } from "url";
import DOMPurify from "isomorphic-dompurify";
import ethers from "ethers";
import slugify from "slugify";
slugify.extend({ "′": "", "'": "", "'": "" });

import { commentCounts } from "../../store.mjs";
import ShareIcon from "./shareicon.mjs";
import CopyIcon from "./copyicon.mjs";
import FCIcon from "./farcastericon.mjs";
import theme from "../../theme.mjs";
import { countOutbounds } from "../../cache.mjs";
import log from "../../logger.mjs";

const html = htm.bind(vhtml);

export const iconSVG = html`
  <svg
    style="width: 35px;"
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M99.84 52.0801L55.04 96.8001L68.44 110.04L90.36 88.0401L90.3747 148H109.8V88.0401L131.84 110.04L144.96 96.8001L100.24 52.0801H99.84Z"
    />
  </svg>
`;

const expandSVG = html`
  <svg
    style="color:black; height: 1rem;"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <line
      x1="216"
      y1="128"
      x2="40"
      y2="128"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="128"
      y1="96"
      x2="128"
      y2="16"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <polyline
      points="96 48 128 16 160 48"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <line
      x1="128"
      y1="160"
      x2="128"
      y2="240"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <polyline
      points="160 208 128 240 96 208"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;

const formatDistanceToNowStrict = (date) => {
  return originalFormatDistance(date)
    .replace(/ years?/, "y")
    .replace(/ months?/, "mo")
    .replace(/ weeks?/, "w")
    .replace(/ days?/, "d")
    .replace(/ hours?/, "h")
    .replace(/ minutes?/, "m")
    .replace(/ seconds?/, "s");
};

const ShuffleSVG = html`<svg
  style="width: 24px; color: black;"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 256 256"
>
  <rect width="256" height="256" fill="none" />
  <path
    d="M32,72H55.06a64,64,0,0,1,52.08,26.8l41.72,58.4A64,64,0,0,0,200.94,184H232"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
  <polyline
    points="208 48 232 72 208 96"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
  <polyline
    points="208 160 232 184 208 208"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
  <path
    d="M147.66,100.47l1.2-1.67A64,64,0,0,1,200.94,72H232"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
  <path
    d="M32,184H55.06a64,64,0,0,0,52.08-26.8l1.2-1.67"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="16"
  />
</svg>`;

export function extractDomain(link) {
  const parsedUrl = new URL(link);
  const parts = parsedUrl.hostname.split(".");
  const tld = parts.slice(-2).join(".");
  return tld;
}

export function addOrUpdateReferrer(link, address) {
  if (!address) return link;

  const url = new URL(link);
  if (url.hostname.endsWith("mirror.xyz")) {
    url.searchParams.set("referrerAddress", address);
  } else if (
    url.hostname.endsWith("paragraph.xyz") ||
    url.hostname.endsWith("zora.co") ||
    url.hostname.endsWith("manifold.xyz")
  ) {
    url.searchParams.set("referrer", address);
  } else if (url.hostname.endsWith("foundation.app")) {
    url.searchParams.set("ref", address);
  }
  return url.toString();
}

const truncateLongWords = (text, maxLength = 20) => {
  const words = text.split(" ");
  const truncatedWords = words.map((word) =>
    word.length > maxLength ? `${word.substring(0, maxLength)}...` : word,
  );
  return truncatedWords.join(" ");
};

export function truncateComment(comment, maxLength = 180) {
  const emptyLineIndex = comment.indexOf("\n\n");
  if (emptyLineIndex !== -1 && emptyLineIndex < maxLength)
    return truncateLongWords(comment.slice(0, emptyLineIndex)) + "\n...";

  const lastLinkStart = comment.lastIndexOf("https://", maxLength);
  if (lastLinkStart !== -1 && lastLinkStart < maxLength) {
    const breakPoint = comment.lastIndexOf(" ", lastLinkStart);
    const truncated =
      breakPoint !== -1
        ? comment.slice(0, breakPoint) + "..."
        : comment.slice(0, lastLinkStart) + "...";
    return truncateLongWords(truncated);
  }

  if (comment.length <= maxLength) return truncateLongWords(comment);
  return truncateLongWords(
    comment.slice(0, comment.lastIndexOf(" ", maxLength)) + "...",
  );
}

// NOTE: Some sites have awful OG images that we don't want to show. Notion for
// example always have the same generic ogImages, but many people often share
// Notion documents.
const blockedOGImageDomains = [
  "notion.site",
  "abs.xyz",
  "github.com",
  "https://www.railway.xyz/",
  "t.me",
  "soliditylang.org",
  "hey.xyz",
];
const knownBadOgImages = [
  "https://paragraph.xyz/share/share_img.jpg",
  "https://s.turbifycdn.com/aah/paulgraham/essays-5.gif",
];

const row = (
  start = 0,
  path,
  style = "",
  interactive,
  hideCast,
  period,
  recentJoiners,
  invert = false,
  // NOTE: query is currently only used when we want to mark a comment preview
  // as visited, and so since comment previews are only active on / and /new, we
  // don't have to properly set query anywhere else.
  query = "",
) => {
  const size = 12;
  return (story, i) => {
    try {
      // NOTE: Normally it can't happen, but when we deploy a new ad contract
      // then story can indeed be empty, and so this made several functions in
      // the row component panic, which is why we now check before we continue
      // the rendering.
      new URL(story.href);
    } catch (err) {
      log(`Fault during row render for story href: ${story.href}`);
      return;
    }

    const submissionId = `kiwi:0x${story.index}`;
    const commentCount = commentCounts.get(submissionId) || 0;
    const outboundsLookbackHours = 24 * 5;
    const clicks = countOutbounds(
      addOrUpdateReferrer(story.href, story.identity),
      outboundsLookbackHours,
    );
    const extractedDomain = extractDomain(DOMPurify.sanitize(story.href));
    const isad = !!story.collateral;
    const displayMobileImage =
      story.metadata &&
      story.metadata.image &&
      !interactive &&
      (path === "/" || path === "/stories") &&
      !blockedOGImageDomains.includes(extractedDomain) &&
      !knownBadOgImages.includes(story.metadata.image);
    const displayCommentPreview =
      story.lastComment &&
      story.lastComment.identity.safeAvatar &&
      differenceInHours(
        new Date(),
        new Date(story.lastComment.timestamp * 1000),
      ) < 20 &&
      !invert;
    return html`
      <tr style="${invert ? "background-color: black;" : ""}">
        <td>
          <div
            class="${interactive ? "" : "content-row"} ${invert
              ? "inverted-row"
              : ""} ${displayMobileImage ? "content-row-elevated" : ""}"
            style="${i === 0 ? "margin-top: 17px;" : ""} ${invert
              ? "display:none;"
              : ""} ${style}"
          >
            ${displayMobileImage
              ? html` <a
                  data-no-instant
                  style="display: block; width: 100%;"
                  class="mobile-row-image"
                  href="${addOrUpdateReferrer(
                    DOMPurify.sanitize(story.href),
                    story.identity,
                  )}"
                  onclick="event.preventDefault(); navigator.sendBeacon('/outbound?url=' + encodeURIComponent('${addOrUpdateReferrer(
                    DOMPurify.sanitize(story.href),
                    story.identity,
                  )}')); window.open('${addOrUpdateReferrer(
                    DOMPurify.sanitize(story.href),
                    story.identity,
                  )}', event.currentTarget.getAttribute('target'));"
                >
                  <img
                    loading="lazy"
                    style="aspect-ratio: 2 / 1; object-fit:cover; margin: 0 11px; border-radius: 2px; width: calc(100% - 24px);"
                    src="${DOMPurify.sanitize(story.metadata.image)}"
                /></a>`
              : null}
            <div
              class="information-row ${displayCommentPreview
                ? "with-comment-preview"
                : `without-comment-preview without-comment-preview-0x${story.index}`} ${displayMobileImage
                ? "elevating-row"
                : ""}"
              style="display: flex; align-items: center; padding: 3px 0;"
            >
              <div
                data-title="${DOMPurify.sanitize(story.title)}"
                data-href="${DOMPurify.sanitize(story.href)}"
                data-upvoters="${JSON.stringify(story.upvoters)}"
                data-isad="${isad}"
                class="${displayMobileImage
                  ? "vote-button-container interaction-container-with-image"
                  : "vote-button-container"}"
                style="${isad
                  ? "opacity: 0.3;"
                  : ""}display: flex; align-self: stretch;"
              >
                <div
                  onclick="const key='--kiwi-news-upvoted-stories';const href='${DOMPurify.sanitize(
                    story.href,
                  )}';const title='${DOMPurify.sanitize(
                    story.title,
                  )}';const stories=JSON.parse(localStorage.getItem(key)||'[]');stories.push({href,title});localStorage.setItem(key,JSON.stringify(stories));window.dispatchEvent(new Event('upvote-storage'));"
                >
                  <div
                    class="interaction-element"
                    style="border-radius: 2px; border: var(--border-thin); background-color: var(--bg-off-white); display: flex; align-items: center; justify-content: center; min-width: 49px; margin: 5px 8px 5px 6px; align-self: stretch;"
                  >
                    <div style="min-height: 42px; display:block;">
                      <div class="votearrowcontainer">
                        <div>
                          <div
                            class="votearrow"
                            style="color: rgb(130, 130, 130); cursor: pointer;"
                            title="upvote"
                          >
                            ${iconSVG}
                          </div>
                          <div
                            class="upvotes-container"
                            data-href="${story.href}"
                            style="font-size: 8pt; font-weight: bold; text-align: center;"
                          >
                            ${story.upvotes ? story.upvotes : "..."}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                style="display: flex; align-items: start; flex-grow: 1; gap: 8px;"
              >
                ${story.metadata &&
                story.metadata.image &&
                !interactive &&
                !blockedOGImageDomains.includes(extractedDomain) &&
                !knownBadOgImages.includes(story.metadata.image)
                  ? html`<a
                      data-no-instant
                      href="${addOrUpdateReferrer(
                        DOMPurify.sanitize(story.href),
                        story.identity,
                      )}"
                      class="row-image"
                      target="_blank"
                      style="user-select:text; align-self: stretch; margin: 5px 0;"
                      onclick="event.preventDefault(); navigator.sendBeacon('/outbound?url=' + encodeURIComponent('${addOrUpdateReferrer(
                        DOMPurify.sanitize(story.href),
                        story.identity,
                      )}')); window.open('${addOrUpdateReferrer(
                        DOMPurify.sanitize(story.href),
                        story.identity,
                      )}', event.currentTarget.getAttribute('target'));"
                    >
                      <img
                        loading="lazy"
                        style="max-height: 61px; border: var(--border-line); border-radius: 2px; width: 110px; object-fit: cover;"
                        src="${DOMPurify.sanitize(story.metadata.image)}"
                    /></a>`
                  : null}
                <div
                  class="story-link-container-wrapper"
                  style="min-height: 59px; display:flex; justify-content: center; flex-direction: column; flex-grow: 1; line-height: 1.3; padding: 4px 3px 5px 0;"
                >
                  <span>
                    <span class="story-link-container">
                      <a
                        data-no-instant
                        href="${path === "/submit" || path === "/demonstration"
                          ? "javascript:void(0);"
                          : addOrUpdateReferrer(
                              DOMPurify.sanitize(story.href),
                              story.identity,
                            )}"
                        onclick="event.preventDefault(); navigator.sendBeacon('/outbound?url=' + encodeURIComponent('${addOrUpdateReferrer(
                          DOMPurify.sanitize(story.href),
                          story.identity,
                        )}')); window.open('${addOrUpdateReferrer(
                          DOMPurify.sanitize(story.href),
                          story.identity,
                        )}', event.currentTarget.getAttribute('target'));"
                        data-story-link="/stories/${slugify(
                          DOMPurify.sanitize(story.title),
                        )}?index=0x${story.index}"
                        target="${path === "/submit" ||
                        path === "/demonstration"
                          ? "_self"
                          : "_blank"}"
                        class="story-link"
                        style="user-select: text; line-height: 15pt; font-size: 13pt;"
                      >
                        ${story.isOriginal
                          ? html`<mark
                              style="background-color: rgba(255,255,0, 0.05); padding: 0px 2px;"
                              >${truncateLongWords(
                                DOMPurify.sanitize(story.title),
                              )}</mark
                            >`
                          : truncateLongWords(DOMPurify.sanitize(story.title))}
                      </a>
                      <span> </span>
                    </span>
                    <span> </span>
                    <span class="story-domain" style="white-space: nowrap;"
                      >(${!interactive && (path === "/" || path === "/best")
                        ? html`<a
                            href="${path}?domain=${extractedDomain}${period
                              ? `&period=${period}`
                              : ""}"
                            style="color: #828282;"
                            >${extractedDomain}</a
                          >`
                        : extractedDomain})</span
                    >
                  </span>
                  <div
                    class="story-subtitle"
                    style="font-size: 9pt; margin-top: 3px;"
                  >
                    <span style="opacity: 0.8">
                      ${path !== "/stories" &&
                      story.avatars.length > 3 &&
                      html`
                        <span>
                          <div
                            style="margin-left: ${size /
                            2}; top: 2px; display: inline-flex; position:relative;"
                          >
                            ${story.avatars.slice(0, 5).map(
                              (avatar, index) => html`
                                <img
                                  loading="lazy"
                                  src="${avatar}"
                                  alt="avatar"
                                  style="z-index: ${index}; width: ${size}px; height:
 ${size}px; border: 1px solid #828282; border-radius: 2px; margin-left: -${size /
                                  2}px;"
                                />
                              `,
                            )}
                          </div>
                          <span style="opacity:0.6"> • </span>
                        </span>
                      `}
                      ${story.index
                        ? html`
                            <a
                              class="meta-link"
                              style="user-select: text;"
                              href="/stories/${slugify(
                                DOMPurify.sanitize(story.title),
                              )}?index=0x${story.index}"
                            >
                              ${formatDistanceToNowStrict(
                                new Date(story.timestamp * 1000),
                              )}
                            </a>
                          `
                        : html`
                            ${formatDistanceToNowStrict(
                              new Date(story.timestamp * 1000),
                            )}
                          `}
                      <span style="opacity:0.6"> • </span>
                      ${story.identity
                        ? html`<a
                            href="${interactive
                              ? ""
                              : story.submitter && story.submitter.ens
                              ? `/${story.submitter.ens}`
                              : `/upvotes?address=${story.identity}`}"
                            class="meta-link"
                            style="font-weight: 500; user-select: text; ${recentJoiners &&
                            recentJoiners.includes(story.identity)
                              ? `color: ${theme.color};`
                              : ""}"
                          >
                            ${story.displayName}
                          </a>`
                        : path === "/demonstration"
                        ? html`<a class="meta-link" href="javascript:void(0);"
                            >${story.displayName}</a
                          >`
                        : html`<a
                            target="_blank"
                            class="meta-link"
                            style="touch-action: manipulation; user-select: none;"
                            href="https://paragraph.xyz/@kiwi-updates/kiwi-feedbot-submissions-open"
                            >${story.displayName}</a
                          >`}
                      ${story.collateral && story.price
                        ? html`
                            <span>
                              <a
                                class="meta-link"
                                href="https://github.com/attestate/ad?tab=readme-ov-file#how-does-it-work"
                                target="_blank"
                              >
                                <span> </span>
                                (sponsored)</a
                              >
                              <span style="opacity:0.6"> • </span>
                              <a
                                style="display: inline;"
                                class="decaying-price-link meta-link"
                                data-price="${story.price.toString()}"
                                href="/submit?isad=true"
                              >
                                <span>Price: </span>
                                ↓${parseFloat(
                                  ethers.utils.formatEther(
                                    story.price.toString(),
                                  ),
                                ).toFixed(9)}
                                <span> </span>
                                ETH
                              </a>
                            </span>
                          `
                        : null}
                      <span>
                        ${path === "/" ||
                        path === "/new" ||
                        interactive ||
                        hideCast ||
                        isad
                          ? null
                          : html`
                              <span class="share-container">
                                <span style="opacity:0.6"> • </span>
                                <a
                                  href="#"
                                  class="caster-link share-link"
                                  title="Share"
                                  style="color: var(--contrast-color); touch-action: manipulation; user-select: none; white-space: nowrap;"
                                  onclick="event.preventDefault(); navigator.share({url: 'https://news.kiwistand.com/stories/${slugify(
                                    DOMPurify.sanitize(story.title),
                                  )}?index=0x${story.index}' });"
                                >
                                  ${ShareIcon(
                                    "padding: 0 3px 1px 0; vertical-align: bottom; height: 13px; width: 13px;",
                                  )}
                                  Share Kiwi link
                                </a>
                              </span>
                            `}
                        ${isad ||
                        interactive ||
                        hideCast ||
                        story.displayName === "Feedbot"
                          ? null
                          : html`
                              <span class="inverse-share-container">
                                <span style="opacity:0.6"> • </span>
                                <a
                                  href="#"
                                  class="meta-link share-link"
                                  title="Share"
                                  style="color: var(--contrast-color); touch-action: manipulation; user-select: none; white-space: nowrap;"
                                  onclick="event.preventDefault(); navigator.clipboard.writeText('https://news.kiwistand.com/stories/${slugify(
                                    DOMPurify.sanitize(story.title),
                                  )}?index=0x${story.index}'); window.toast.success('Link copied!');"
                                >
                                  ${CopyIcon(
                                    "padding: 0 3px 1px 0; vertical-align: bottom; height: 13px; width: 13px;",
                                  )}
                                  Copy Kiwi link
                                </a>
                              </span>
                            `}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              ${path !== "/stories" &&
              path !== "/demonstration" &&
              path !== "/submit"
                ? html`<div
                    data-story-index="0x${story.index}"
                    data-comment-count="${commentCount}"
                    class="${displayMobileImage
                      ? "interaction-container-with-image chat-bubble-container"
                      : "chat-bubble-container"}"
                    style="${isad
                      ? "opacity: 0.3;"
                      : ""}display: flex; align-self: stretch;"
                  >
                    <a
                      class="chat-bubble interaction-element"
                      id="chat-bubble-${story.index}"
                      href="/stories/${slugify(
                        DOMPurify.sanitize(story.title),
                      )}?index=0x${story.index}"
                      style="margin: 5px; border: var(--border-thin); background-color: var(--bg-off-white); border-radius: 2px; display: ${path ===
                      "/stories"
                        ? "none"
                        : "flex"}; justify-content: center; min-width: 49px; align-items: center; flex-direction: column;"
                    >
                      ${ChatsSVG()}
                      <span
                        id="comment-count-${story.index}"
                        style="color: rgba(0,0,0,0.65); font-size: 8pt; font-weight: bold;"
                        >${commentCount}</span
                      >
                    </a>
                  </div>`
                : ""}
              ${path === "/stories"
                ? html`<div
                    title="Go to random article"
                    style="display: flex; align-self: stretch;"
                  >
                    <a
                      class="chat-bubble interaction-element"
                      href="/random"
                      style="margin: 5px; border: var(--border); background-color: var(--bg-off-white); border-radius: 2px; display: flex; justify-content: center; min-width: 40px; align-items: center; flex-direction: column;"
                    >
                      ${ShuffleSVG}
                    </a>
                  </div>`
                : ""}
            </div>
            ${displayCommentPreview
              ? html` <div
                  class="comment-preview comment-preview-0x${story.index} ${displayMobileImage
                    ? "elevating-comment-preview"
                    : "comment-preview-no-mobile-image"}"
                  style="touch-action: manipulation; user-select: none; cursor: pointer; display: flex;"
                >
                  <div
                    class="interaction-element"
                    onclick="(function(){history.replaceState(null,'','${path ===
                    "/"
                      ? `/new?cached=true#0x${story.lastComment.index}`
                      : `/#0x${story.lastComment.index}`}');history.replaceState(null,'','${path ===
                    "/"
                      ? `/#0x${story.lastComment.index}`
                      : `/new?cached=true#0x${story.lastComment.index}`}');})(),document.querySelector('.comment-preview-0x${story.index}').style.opacity = 0.5,window.addToQueue(new
 CustomEvent('open-comments-0x${story.index}',{detail:{source:'comment-preview'}}));window.dispatchEvent(new HashChangeEvent('hashchange'));"
                    style="margin: 0 5px 5px 5px; padding: 11px; border: var(--border); border-top: rgba(166, 110, 78, 0.075); display: flex;width: 100%; background-color: var(--bg-off-white); border-radius: 2px;"
                  >
                    <a
                      class="comment-preview-anchor"
                      href="${path === "/" ? "" : path}${query}#0x${story
                        .lastComment.index}"
                      style="width: 100%; display: flex; pointer-events: none;"
                    >
                      <div style="width:90%;">
                        <div
                          style="display: flex; align-items: center; gap: 5px; margin-bottom: 3px;"
                        >
                          <img
                            loading="lazy"
                            src="${DOMPurify.sanitize(
                              story.lastComment.identity.safeAvatar,
                            )}"
                            alt="avatar"
                            style="border: 1px solid #ccc; width: ${size}px; height: ${size}px; border-radius: 2px;"
                          />
                          <span
                            style="font-size: 10pt; touch-action: manipulation;user-select: none; font-weight: 500;"
                            >${DOMPurify.sanitize(
                              story.lastComment.identity.displayName,
                            )}</span
                          >
                          <span style="opacity:0.6"> • </span>
                          <span style="font-size: 9pt; opacity: 0.9;">
                            ${formatDistanceToNowStrict(
                              new Date(story.lastComment.timestamp * 1000),
                            )}
                            <span> </span>
                            ago
                          </span>
                        </div>
                        <span> </span>
                        <div style="padding-left:20px;">
                          <span
                            class="comment-preview-text"
                            style="display: block; white-space: pre-wrap; touch-action: manipulation;user-select: none;"
                            >${truncateComment(
                              DOMPurify.sanitize(story.lastComment.title),
                            )}</span
                          >
                        </div>
                        <span> </span>
                      </div>
                      <div
                        style="width:10%; display: flex; align-items: center; justify-content: end; padding-right: 7px;"
                      >
                        ${expandSVG}
                      </div>
                    </a>
                  </div>
                </div>`
              : null}
            ${path !== "/stories"
              ? html`<div
                  class="comment-section"
                  data-comment-count="${commentCount}"
                  data-story-index="0x${story.index}"
                ></div>`
              : null}
          </div>
        </td>
      </tr>
    `;
  };
};

export const ChatsSVG = (
  style = "color: rgba(0,0,0,0.65); width: 25px;",
) => html`
  <svg
    style="${style}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
  >
    <rect width="256" height="256" fill="none" />
    <path
      d="M71.58,144,32,176V48a8,8,0,0,1,8-8H168a8,8,0,0,1,8,8v88a8,8,0,0,1-8,8Z"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
    <path
      d="M80,144v40a8,8,0,0,0,8,8h96.42L224,224V96a8,8,0,0,0-8-8H176"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="16"
    />
  </svg>
`;
export default row;
