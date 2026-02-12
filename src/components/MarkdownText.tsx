/**
 * Renders markdown-style text the same way the web app does:
 * **bold**, *italic*, ---, # headings, -, * lists, > blockquote.
 * Used for Lisa chat assistant messages.
 */

import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { colors, typography } from '../theme/tokens';

function normalizeMarkdown(src: string): string {
  if (!src) return '';
  return src
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

type Block = { type: 'paragraph' | 'heading' | 'hr' | 'ul' | 'ol' | 'blockquote'; content: string; level?: number };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split('\n');
  let i = 0;
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^[-*_]{3,}$/.test(trimmed)) {
      if (listItems.length > 0) {
        blocks.push({ type: listType!, content: listItems.join('\n') });
        listItems = [];
        listType = null;
      }
      blocks.push({ type: 'hr', content: '' });
      i++;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,5})\s+(.+)$/);
    if (headingMatch) {
      if (listItems.length > 0) {
        blocks.push({ type: listType!, content: listItems.join('\n') });
        listItems = [];
        listType = null;
      }
      blocks.push({ type: 'heading', content: headingMatch[2], level: headingMatch[1].length });
      i++;
      continue;
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (ulMatch) {
      if (listType !== 'ul' && listItems.length > 0) {
        blocks.push({ type: listType!, content: listItems.join('\n') });
        listItems = [];
      }
      listType = 'ul';
      listItems.push(ulMatch[1]);
      i++;
      continue;
    }
    if (olMatch) {
      if (listType !== 'ol' && listItems.length > 0) {
        blocks.push({ type: listType!, content: listItems.join('\n') });
        listItems = [];
      }
      listType = 'ol';
      listItems.push(olMatch[2]);
      i++;
      continue;
    }

    if (trimmed.startsWith('> ')) {
      if (listItems.length > 0) {
        blocks.push({ type: listType!, content: listItems.join('\n') });
        listItems = [];
        listType = null;
      }
      let quoteContent = trimmed.slice(2);
      i++;
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteContent += '\n' + lines[i].trim().slice(2);
        i++;
      }
      blocks.push({ type: 'blockquote', content: quoteContent });
      continue;
    }

    if (listItems.length > 0 && !trimmed) {
      i++;
      continue;
    }
    if (listItems.length > 0 && trimmed) {
      blocks.push({ type: listType!, content: listItems.join('\n') });
      listItems = [];
      listType = null;
    }

    if (!trimmed) {
      i++;
      continue;
    }

    const paraLines: string[] = [trimmed];
    i++;
    while (i < lines.length && lines[i].trim() && !/^[-*_]{3,}$/.test(lines[i].trim()) && !lines[i].trim().match(/^#{1,5}\s/) && !lines[i].trim().match(/^[-*•]\s+/) && !lines[i].trim().match(/^\d+\.\s+/) && !lines[i].trim().startsWith('> ')) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: 'paragraph', content: paraLines.join('\n') });
  }

  if (listItems.length > 0) {
    blocks.push({ type: listType!, content: listItems.join('\n') });
  }
  return blocks;
}

type InlinePart = { type: 'text' | 'bold' | 'italic'; content: string };

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let remaining = text;
  const boldRegex = /\*\*([^*]+?)\*\*|__([^_]+?)__/g;
  const italicRegex = /\*([^*]+?)\*|_([^_]+?)_/g;
  const matches: Array<{ start: number; end: number; content: string; type: 'bold' | 'italic' }> = [];

  let m;
  while ((m = boldRegex.exec(text)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, content: (m[1] ?? m[2]).trim(), type: 'bold' });
  }
  while ((m = italicRegex.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    const content = (m[1] ?? m[2]).trim();
    const overlaps = matches.some((x) => (start >= x.start && start < x.end) || (end > x.start && end <= x.end) || (start <= x.start && end >= x.end));
    if (!overlaps) matches.push({ start, end, content, type: 'italic' });
  }
  matches.sort((a, b) => a.start - b.start);

  let lastEnd = 0;
  for (const match of matches) {
    if (match.start > lastEnd) {
      const raw = text.slice(lastEnd, match.start);
      if (raw) parts.push({ type: 'text', content: raw });
    }
    parts.push({ type: match.type, content: match.content });
    lastEnd = match.end;
  }
  if (lastEnd < text.length) {
    const raw = text.slice(lastEnd);
    if (raw) parts.push({ type: 'text', content: raw });
  }
  if (parts.length === 0) return [{ type: 'text', content: text }];
  return parts;
}

function renderInlineParts(parts: InlinePart[], textStyle: object, keyPrefix: string) {
  return parts.map((p, idx) => {
    if (p.type === 'text') {
      return <Text key={`${keyPrefix}-${idx}`} style={textStyle}>{p.content}</Text>;
    }
    if (p.type === 'bold') {
      return <Text key={`${keyPrefix}-${idx}`} style={[textStyle, styles.bold]}>{p.content}</Text>;
    }
    return <Text key={`${keyPrefix}-${idx}`} style={[textStyle, styles.italic]}>{p.content}</Text>;
  });
}

const styles = StyleSheet.create({
  bold: { fontFamily: typography.family.bold },
  italic: { fontStyle: 'italic' },
  paragraph: { marginBottom: 8 },
  heading: { fontFamily: typography.family.bold, color: colors.text, marginTop: 12, marginBottom: 4 },
  h1: { fontSize: 22 },
  h2: { fontSize: 20 },
  h3: { fontSize: 18 },
  h4: { fontSize: 16 },
  h5: { fontSize: 15 },
  hr: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  list: { marginBottom: 8, paddingLeft: 16 },
  listItem: { marginBottom: 4, flexDirection: 'row' },
  listItemContent: { flex: 1 },
  bullet: { marginRight: 8 },
  blockquote: { borderLeftWidth: 4, borderLeftColor: colors.primary, paddingLeft: 12, marginVertical: 8, fontStyle: 'italic' },
});

export function MarkdownText({
  children,
  textStyle = {},
}: {
  children: string;
  textStyle?: object;
}) {
  const normalized = normalizeMarkdown(children);
  if (!normalized) return <Text style={[styles.paragraph, textStyle]} />;

  const blocks = parseBlocks(normalized);
  const baseStyle = [styles.paragraph, textStyle];

  return (
    <View>
      {blocks.map((block, blockIdx) => {
        if (block.type === 'hr') {
          return <View key={`hr-${blockIdx}`} style={styles.hr} />;
        }
        if (block.type === 'heading') {
          const levelStyle = block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : block.level === 3 ? styles.h3 : block.level === 4 ? styles.h4 : styles.h5;
          const parts = parseInline(block.content);
          return (
            <Text key={`h-${blockIdx}`} style={[styles.heading, levelStyle, textStyle]}>
              {renderInlineParts(parts, [baseStyle, levelStyle], `h-${blockIdx}`)}
            </Text>
          );
        }
        if (block.type === 'blockquote') {
          const parts = parseInline(block.content);
          return (
            <Text key={`bq-${blockIdx}`} style={[styles.blockquote, textStyle]}>
              {renderInlineParts(parts, [baseStyle, styles.blockquote, textStyle], `bq-${blockIdx}`)}
            </Text>
          );
        }
        if (block.type === 'ul' || block.type === 'ol') {
          const items = block.content.split('\n').filter(Boolean);
          return (
            <View key={`list-${blockIdx}`} style={styles.list}>
              {items.map((item, idx) => {
                const parts = parseInline(item);
                return (
                  <View key={idx} style={styles.listItem}>
                    <Text style={[baseStyle, styles.bullet, textStyle]}>{block.type === 'ol' ? `${idx + 1}.` : '•'}</Text>
                    <View style={styles.listItemContent}>
                      <Text style={[baseStyle, textStyle]}>
                        {renderInlineParts(parts, [baseStyle, textStyle], `li-${blockIdx}-${idx}`)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        }
        const parts = parseInline(block.content);
        return (
          <Text key={`p-${blockIdx}`} style={baseStyle}>
            {renderInlineParts(parts, baseStyle, `p-${blockIdx}`)}
          </Text>
        );
      })}
    </View>
  );
}
