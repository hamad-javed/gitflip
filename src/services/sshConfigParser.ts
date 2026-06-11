const MARKER_PREFIX = '# GitFlip:';

export { MARKER_PREFIX };

/**
 * A parsed `Host` block from an SSH config file, tracked by the line range it
 * occupies so it can be removed without disturbing neighbouring blocks.
 */
export interface HostBlock {
  host: string;
  /** Index of the `Host` line. */
  startLine: number;
  /** Index just past the last line owned by this block. */
  endLine: number;
  /** True if a GitFlip marker comment immediately precedes the block. */
  markedByGitFlip: boolean;
  /** Index of the marker line, if present. */
  markerLine?: number;
  identityFile?: string;
}

/**
 * Parse an SSH config file into Host blocks. A block owns every line from its
 * `Host` line up to (but not including) the next `Host` line or a GitFlip
 * marker comment that introduces the next block.
 *
 * Pure function over the file's lines — no I/O — so it is directly testable.
 */
export function parseHostBlocks(lines: string[]): HostBlock[] {
  const blocks: HostBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const hostMatch = trimmed.match(/^Host\s+(.+)$/i);
    if (!hostMatch) {
      continue;
    }

    // First token after `Host` is the primary alias.
    const host = hostMatch[1].trim().split(/\s+/)[0];
    const markerLine = i > 0 && lines[i - 1].trim().startsWith(MARKER_PREFIX) ? i - 1 : undefined;

    // The block ends at the next Host line or the marker preceding it.
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (/^Host\s+/i.test(t)) {
        end = t && lines[j - 1]?.trim().startsWith(MARKER_PREFIX) ? j - 1 : j;
        break;
      }
      if (t.startsWith(MARKER_PREFIX) && j + 1 < lines.length && /^Host\s+/i.test(lines[j + 1].trim())) {
        end = j;
        break;
      }
    }

    let identityFile: string | undefined;
    for (let j = i + 1; j < end; j++) {
      const m = lines[j].trim().match(/^IdentityFile\s+(.+)$/i);
      if (m) {
        identityFile = m[1].trim();
      }
    }

    blocks.push({
      host,
      startLine: i,
      endLine: end,
      markedByGitFlip: markerLine !== undefined,
      markerLine,
      identityFile,
    });
  }

  return blocks;
}
