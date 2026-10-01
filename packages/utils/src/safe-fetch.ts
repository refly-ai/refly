import { lookup } from 'node:dns';
import { isIP } from 'node:net';
import { ParamsError } from '@refly/errors';
import ipaddr from 'ipaddr.js';
import { Agent, fetch } from 'undici';

const publicIPv6 = ipaddr.IPv6.parse('2000::');
const redirects = new Set([301, 302, 303, 307, 308]);
const maxRedirects = 5;
const errorMessage = 'URL must resolve to a public HTTP(S) destination';

function isPublicAddress(address: string): boolean {
  try {
    if (!isIP(address) || address.includes('%')) {
      return false;
    }
    // Normalize IPv4-mapped IPv6 before applying the IPv4 range policy.
    const ip = ipaddr.process(address);
    return ip.range() === 'unicast' && (ip.kind() === 'ipv4' || ip.match(publicIPv6, 3));
  } catch {
    // A parser failure in the asynchronous DNS callback must also fail closed.
    return false;
  }
}

const dispatcher = new Agent({
  // Untrusted servers must not share a reusable HTTP/1 connection across requests.
  pipelining: 0,
  connect: {
    autoSelectFamily: true,
    lookup(hostname, options, callback) {
      // This is the socket's lookup: only checked addresses reach connect().
      // Check all answers so a mixed public/private DNS response fails closed.
      lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
        if (
          error ||
          !addresses?.length ||
          addresses.some(({ address }) => !isPublicAddress(address))
        ) {
          callback(new ParamsError(errorMessage), '', 0);
          return;
        }
        if (options.all) {
          callback(null, addresses);
        } else {
          callback(null, addresses[0].address, addresses[0].family);
        }
      });
    },
  },
});

/** Server-only GET for untrusted URLs, including every redirect destination. */
export async function safeFetch(input: string) {
  try {
    // Reject coercion of non-string input and bound URL parsing work.
    if (typeof input !== 'string' || input.length > 8192) {
      throw new ParamsError(errorMessage);
    }
    let url = new URL(input);
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const hostname = url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname;
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        (isIP(hostname) && !isPublicAddress(hostname))
      ) {
        throw new ParamsError(errorMessage);
      }
      const response = await fetch(url, { dispatcher, redirect: 'manual' });
      const location = response.headers.get('location');
      if (!redirects.has(response.status) || !location) {
        return response;
      }
      await response.body?.cancel();
      if (hop === maxRedirects || location.length > 8192) {
        throw new ParamsError(errorMessage);
      }
      url = new URL(location, url);
    }
  } catch {
    // Do not expose the input, DNS answers, or undici's chained connection error.
    throw new ParamsError(errorMessage);
  }
  throw new ParamsError(errorMessage);
}
