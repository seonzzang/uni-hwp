export function getStatusElements() {
  return {
    sbMessage: () => document.getElementById('sb-message')!,
    sbPage: () => document.getElementById('sb-page')!,
    sbSection: () => document.getElementById('sb-section')!,
    sbZoomVal: () => document.getElementById('sb-zoom-val')!,
  };
}

export function setDocumentTransitioning(isTransitioning: boolean): void {
  if (isTransitioning) {
    document.body.dataset.docTransition = '1';
  } else {
    delete document.body.dataset.docTransition;
  }
}
