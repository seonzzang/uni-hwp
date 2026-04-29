import type { CommandDispatcher } from '@/command/dispatcher';

export function setupToolbarCommandBindings(dispatcher: CommandDispatcher): void {
  document.querySelectorAll('.tb-btn[data-cmd]').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const cmd = (btn as HTMLElement).dataset.cmd;
      if (cmd) dispatcher.dispatch(cmd, { anchorEl: btn as HTMLElement });
    });
  });

  document.querySelectorAll('.tb-split').forEach((split) => {
    const arrow = split.querySelector('.tb-split-arrow');
    if (arrow) {
      arrow.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll('.tb-split.open').forEach((s) => {
          if (s !== split) s.classList.remove('open');
        });
        split.classList.toggle('open');
      });
    }

    split.querySelectorAll('.tb-split-item[data-cmd]').forEach((item) => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        split.classList.remove('open');
        const cmd = (item as HTMLElement).dataset.cmd;
        if (cmd) dispatcher.dispatch(cmd, { anchorEl: item as HTMLElement });
      });
    });
  });

  document.addEventListener('mousedown', () => {
    document.querySelectorAll('.tb-split.open').forEach((s) => s.classList.remove('open'));
  });
}
