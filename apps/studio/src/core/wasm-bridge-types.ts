export interface ValidationReport {
  count: number;
  summary: Record<string, number>;
  warnings: Array<{
    section: number;
    paragraph: number;
    kind: 'LinesegArrayEmpty' | 'LinesegUncomputed' | 'LinesegTextRunReflow';
    cell: { ctrl: number; row: number; col: number; innerPara: number } | null;
  }>;
}
