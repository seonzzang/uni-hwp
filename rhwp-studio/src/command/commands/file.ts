import type { CommandDef } from '../types';
import { ensureDocumentCanCloseOrReplace } from '@/app/document-close-guard';
import { saveCurrentDocument } from '@/app/document-save';
import { PageSetupDialog } from '@/ui/page-setup-dialog';
import { AboutDialog } from '@/ui/about-dialog';
import {
  pickOpenFileHandle,
  readFileFromHandle,
  type FileSystemWindowLike,
} from '@/command/file-system-access';
import { runPrintDialogFlow } from '@/print/dialog-entry';

function getCurrentPageFromStatusBar(): number {
  const statusText = document.getElementById('sb-page')?.textContent ?? '';
  const match = statusText.match(/^\s*(\d+)\s*\/\s*\d+\s*쪽/);
  if (!match) return 1;
  const currentPage = Number.parseInt(match[1], 10);
  return Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
}

export const fileCommands: CommandDef[] = [
  {
    id: 'file:new-doc',
    label: '새로 만들기',
    icon: 'icon-new-doc',
    shortcutLabel: 'Alt+N',
    canExecute: () => true,
    async execute(services) {
      if (services.getContext().hasDocument) {
        const canProceed = await ensureDocumentCanCloseOrReplace(services);
        if (!canProceed) {
          return;
        }
      }
      services.eventBus.emit('create-new-document');
    },
  },
  {
    id: 'file:open',
    label: '열기',
    async execute(services) {
      try {
        if (services.getContext().hasDocument) {
          const canProceed = await ensureDocumentCanCloseOrReplace(services);
          if (!canProceed) {
            return;
          }
        }

        const handle = await pickOpenFileHandle(window as FileSystemWindowLike);
        if (!handle) {
          document.getElementById('file-input')?.click();
          return;
        }

        const { bytes, name } = await readFileFromHandle(handle);
        services.eventBus.emit('open-document-bytes', {
          bytes,
          fileName: name,
          fileHandle: handle,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[file:open] 열기 실패:', msg);
        alert(`파일 열기에 실패했습니다:\n${msg}`);
      }
    },
  },
  {
    id: 'file:save',
    label: '저장',
    icon: 'icon-save',
    shortcutLabel: 'Ctrl+S',
    canExecute: (ctx) => ctx.hasDocument,
    async execute(services) {
      const result = await saveCurrentDocument(services.wasm);
      if (result === 'saved') {
        services.documentSession.markClean();
        services.eventBus.emit('command-state-changed');
      }
    },
  },
  {
    id: 'file:close',
    label: '문서 닫기',
    canExecute: (ctx) => ctx.hasDocument,
    async execute(services) {
      const canProceed = await ensureDocumentCanCloseOrReplace(services);
      if (!canProceed) {
        return;
      }
      services.eventBus.emit('close-current-document');
    },
  },
  {
    id: 'file:page-setup',
    label: '편집 용지',
    icon: 'icon-page-setup',
    shortcutLabel: 'F7',
    canExecute: (ctx) => ctx.hasDocument,
    execute(services) {
      const dialog = new PageSetupDialog(services.wasm, services.eventBus, 0);
      dialog.show();
    },
  },
  {
    id: 'file:print',
    label: '인쇄',
    icon: 'icon-print',
    shortcutLabel: 'Ctrl+P',
    canExecute: (ctx) => ctx.hasDocument,
    async execute(services) {
      const currentPage = getCurrentPageFromStatusBar();
      try {
        await runPrintDialogFlow(services, currentPage);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[file:print]', msg);
        alert(`인쇄 작업에 실패했습니다.\n${msg}`);
      }
    },
  },
  {
    id: 'file:about',
    label: '제품 정보',
    icon: 'icon-help',
    execute() {
      new AboutDialog().show();
    },
  },
];
