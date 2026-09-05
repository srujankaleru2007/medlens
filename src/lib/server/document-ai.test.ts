import { describe, expect, it, vi } from 'vitest';
import { normalizeDocument } from './document-ai';

vi.mock('server-only', () => ({}));

describe('Document AI normalization', () => {
  it('preserves page numbers, paragraph text, dimensions, and table cells', () => {
    const document = {
      text: 'Hemoglobin 10.8 g/dL',
      pages: [{
        pageNumber: 1,
        dimension: { width: 612, height: 792 },
        paragraphs: [{ layout: { textAnchor: { textSegments: [{ startIndex: 0, endIndex: 21 }] } } }],
        tables: [{
          layout: { boundingPoly: { normalizedVertices: [{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.2 }, { x: 0.9, y: 0.4 }, { x: 0.1, y: 0.4 }] } },
          bodyRows: [{ cells: [{ layout: { textAnchor: { textSegments: [{ startIndex: 0, endIndex: 10 }] } } }] }],
        }],
      }],
    };

    const normalized = normalizeDocument(document);
    expect(normalized.pages[0]).toMatchObject({ pageNumber: 1, width: 612, height: 792 });
    expect(normalized.pages[0].text).toContain('Hemoglobin');
    expect(normalized.tables[0]).toMatchObject({ pageNumber: 1, rows: [['Hemoglobin']] });
    expect(normalized.tables[0].boundingBox).toMatchObject({ x: 0.1, y: 0.2, width: 0.8, height: 0.2 });
  });
});
