/**
 * 제품 정보 / 라이선스 다이얼로그 (v1.2.2 - Professional Typography Update)
 * 
 * 디자인 개선:
 * - 폰트 사이즈 전체 축소 (Pro look)
 * - 한글(#1e293b)과 영어(#64748b) 색상 분리로 위계 강화
 * - 정밀한 레이아웃 여백 조정
 */
import { ModalDialog } from './dialog';
import { open } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import productData from '../assets/product-info.json';

// Engine update implementation is retained for the compatibility pipeline,
// but must not be user-triggered until a compatible-release policy is ready.
const ENGINE_UPDATE_ENABLED = false;

export class AboutDialog extends ModalDialog {
  private readonly runtimeEngineVersion?: string;

  constructor(runtimeEngineVersion?: string) {
    super('제품 정보', 540); // 정돈된 느낌을 위해 가로폭 소폭 축소
    this.runtimeEngineVersion = runtimeEngineVersion;
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'about-body';
    body.style.textAlign = 'center';
    body.style.padding = '24px 32px';
    body.style.color = '#1e293b';
    body.style.fontFamily = "Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    // 1. 상단 브랜드 헤더
    const brandHeader = document.createElement('div');
    brandHeader.style.display = 'flex';
    brandHeader.style.flexDirection = 'column';
    brandHeader.style.alignItems = 'center';
    brandHeader.style.justifyContent = 'center';
    brandHeader.style.marginBottom = '20px';

    const logoContainer = document.createElement('div');
    logoContainer.style.marginBottom = '8px';
    const logoImg = document.createElement('img');
    logoImg.src = './logo.png'; 
    logoImg.style.width = '146px';
    logoImg.style.height = 'auto';
    logoImg.style.display = 'block';
    logoImg.style.margin = '0 auto';
    logoImg.onerror = () => {
      logoImg.style.display = 'none';
      const fallback = document.createElement('div');
      fallback.style.fontSize = '1.5rem';
      fallback.style.fontWeight = '800';
      fallback.style.color = '#5c7cfa';
      fallback.textContent = 'UNI-HWP';
      logoContainer.appendChild(fallback);
    };
    logoContainer.appendChild(logoImg);
    brandHeader.appendChild(logoContainer);

    // 2. 버전만 로고 아래에 표시
    const versionDisplay = document.createElement('div');
    versionDisplay.style.fontSize = '0.72rem';
    versionDisplay.style.color = '#8fa0bb';
    versionDisplay.style.marginBottom = '0';
    versionDisplay.style.letterSpacing = '0.04em';
    versionDisplay.style.fontWeight = '600';
    const runtimeProductVersion = productData.version;
    const runtimeEngineVersion = this.runtimeEngineVersion ?? productData.engineVersion;
    versionDisplay.textContent = `VERSION ${productData.fullVersion}`;
    brandHeader.appendChild(versionDisplay);
    body.appendChild(brandHeader);

    // 3. 중앙 스크롤 박스 (Typography Polishing)
    const scrollBox = document.createElement('div');
    scrollBox.style.background = '#ffffff';
    scrollBox.style.border = '1px solid #f1f5f9';
    scrollBox.style.borderRadius = '10px';
    scrollBox.style.height = '340px';
    scrollBox.style.overflowY = 'auto';
    scrollBox.style.textAlign = 'left';
    scrollBox.style.padding = '20px';
    scrollBox.style.fontSize = '0.8rem';
    scrollBox.style.lineHeight = '1.7';
    scrollBox.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)';

    const renderHeader = (num: number, title: string) => `
      <div style="font-size: 0.85rem; font-weight: 700; margin-bottom: 14px; color: #334155; border-bottom: 1.5px solid #f8fafc; padding-bottom: 6px; letter-spacing: -0.02em;">
        ${num}. ${title}
      </div>
    `;

    const trans = (kr: string, en: string) => `
      <span>${kr}</span> <span style="color: #94a3b8; font-size: 0.75rem; font-weight: 400;">${en}</span>
    `;

    const { opensource, mitLicense, trademark } = productData.sections;

    scrollBox.innerHTML = `
      ${renderHeader(1, '제품 및 제조사 정보')}
      <div style="margin-left: 4px; margin-bottom: 24px;">
        <div style="margin-bottom: 4px;">${trans('제품명 Product:', productData.productName)}</div>
        <div id="full-version-line" style="margin-bottom: 4px;">${trans('통합 버전 Uni-HWP:', productData.fullVersion)}</div>
        <div id="product-version-line" style="margin-bottom: 4px;">${trans('외피/API 버전:', runtimeProductVersion)}</div>
        <div id="engine-version-line" style="margin-bottom: 4px;">${trans('엔진 Engine:', runtimeEngineVersion)}</div>
        <div style="margin-bottom: 4px;">
          ${trans('제조사 Manufacturer:', '')}
          <a href="#" id="uni-hwp-home" style="color: #4c6ef5; text-decoration: underline; font-weight: 600;">${productData.manufacturer.nameKr}</a>
          <span style="color: #94a3b8; font-size: 0.75rem;"> ${productData.manufacturer.nameEn}</span>
        </div>
        <div style="color: #cbd5e1; font-size: 0.7rem; margin-top: 6px;">${productData.copyright}</div>
      </div>

      ${renderHeader(2, opensource.title)}
      <div style="margin-left: 4px; margin-bottom: 24px;">
        <div style="margin-bottom: 10px;">
          ${opensource.rhwp.kr}<br>
          <span style="color: #94a3b8; font-size: 0.75rem;">${opensource.rhwp.en}</span>
        </div>
        <div style="margin-bottom: 14px;">
          ${trans('원저작자 Original Author:', '')}
          <a href="#" id="rhwp-link" style="color: #4c6ef5; text-decoration: underline; font-weight: 600;">${opensource.rhwp.author}</a>
        </div>
        <div style="margin-bottom: 14px;">
          ${opensource.mitNotice.kr}<br>
          <span style="color: #94a3b8; font-size: 0.75rem;">${opensource.mitNotice.en}</span>
        </div>
        <div style="background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #f1f5f9;">
          <div style="font-size: 0.75rem; font-weight: 600; color: #64748b; margin-bottom: 8px;">
            ${opensource.rhwp.author} Dependencies Licenses
          </div>
          <table style="width: 100%; border-collapse: collapse; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.7rem;">
            ${opensource.libraries.map(lib => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; color: #475569;">${lib.name}</td>
                <td style="text-align: right; color: #94a3b8;">${lib.license}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      </div>

      ${renderHeader(3, mitLicense.title)}
      <div style="margin-left: 4px; margin-bottom: 24px;">
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #f1f5f9;">
          <div style="font-size: 0.7rem; font-weight: 700; color: #64748b; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
            Korean Translation
          </div>
          <div style="color: #475569; font-size: 0.72rem; white-space: pre-wrap; margin-bottom: 20px; line-height: 1.8;">${mitLicense.kr}</div>
          
          <div style="font-size: 0.7rem; font-weight: 700; color: #64748b; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Original English Text
          </div>
          <div style="color: #94a3b8; font-size: 0.7rem; white-space: pre-wrap; line-height: 1.6;">${mitLicense.en}</div>
        </div>
      </div>

      ${renderHeader(4, trademark.title)}
      <div style="margin-left: 4px; color: #64748b; font-size: 0.75rem;">
        <div style="margin-bottom: 10px;">
          <span style="color: #475569;">${trademark.hancomNotice.kr}</span><br>
          ${trademark.hancomNotice.en}
        </div>
        <div>
          <span style="color: #475569;">${trademark.brandNotice.kr}</span><br>
          ${trademark.brandNotice.en}
        </div>
      </div>
    `;
    body.appendChild(scrollBox);

    // The installed engine pointer is authoritative after an automatic
    // update. Refresh the displayed product version without waiting for the
    // user to press UPDATE 확인.
    void invoke<{ engine_version: string | null; product_version: string | null }>('get_installed_engine_release')
      .then((installed) => {
        if (!installed.product_version) return;
        const engineVersionLine = scrollBox.querySelector('#engine-version-line');
        if (engineVersionLine && installed.engine_version) {
          engineVersionLine.innerHTML = trans('엔진 Engine:', installed.engine_version);
        }
      })
      .catch(() => {
        // The static product-info.json remains the fallback for browser mode.
      });

    const updateProgress = document.createElement('div');
    updateProgress.style.display = 'none';
    updateProgress.style.marginTop = '14px';
    updateProgress.style.textAlign = 'left';

    const updateProgressLabel = document.createElement('div');
    updateProgressLabel.style.fontSize = '0.72rem';
    updateProgressLabel.style.color = '#64748b';
    updateProgressLabel.style.marginBottom = '6px';

    const updateProgressTrack = document.createElement('div');
    updateProgressTrack.style.height = '6px';
    updateProgressTrack.style.background = '#e9edf5';
    updateProgressTrack.style.borderRadius = '999px';
    updateProgressTrack.style.overflow = 'hidden';

    const updateProgressFill = document.createElement('div');
    updateProgressFill.style.height = '100%';
    updateProgressFill.style.width = '0%';
    updateProgressFill.style.background = '#4c6ef5';
    updateProgressFill.style.transition = 'width 240ms ease';
    updateProgressTrack.appendChild(updateProgressFill);
    updateProgress.append(updateProgressLabel, updateProgressTrack);
    body.appendChild(updateProgress);

    const setUpdateProgress = (percent: number, label: string): void => {
      updateProgress.style.display = 'block';
      updateProgressLabel.textContent = `${percent}% · ${label}`;
      updateProgressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    };

    const updateButton = document.createElement('button');
    updateButton.type = 'button';
    updateButton.textContent = 'UPDATE 확인';
    updateButton.style.marginTop = '16px';
    updateButton.style.padding = '8px 18px';
    updateButton.style.border = '1px solid #4c6ef5';
    updateButton.style.borderRadius = '6px';
    updateButton.style.background = '#fff';
    updateButton.style.color = '#4c6ef5';
    updateButton.style.cursor = 'pointer';
    if (!ENGINE_UPDATE_ENABLED) {
      updateButton.disabled = true;
      updateButton.textContent = '업데이트 기능 준비 중';
      updateButton.style.cursor = 'not-allowed';
      updateButton.style.opacity = '0.72';
    }
    updateButton.addEventListener('click', async () => {
      if (!ENGINE_UPDATE_ENABLED) return;
      updateButton.disabled = true;
      let stopProgress: UnlistenFn | undefined;
      setUpdateProgress(10, '공식 RHWP 릴리스 확인 중');
      updateButton.textContent = '릴리스 확인 중...';
      try {
        const installed = await invoke<{ engine_version: string | null }>('get_installed_engine_release');
        const installedEngineVersion = installed.engine_version ?? this.runtimeEngineVersion ?? productData.engineVersion;
        const result = await invoke<{ tag: string; is_newer: boolean; product_version: string }>('check_latest_engine_release', {
          currentTag: installedEngineVersion.startsWith('v') ? installedEngineVersion : `v${installedEngineVersion}`,
        });
        if (!result.is_newer) {
          setUpdateProgress(100, `최신 엔진 ${result.tag} 사용 중`);
          updateButton.textContent = `최신 엔진 ${result.tag} 사용 중`;
        } else {
          setUpdateProgress(25, `업데이트 후보 ${result.tag} 확인됨`);
          updateButton.textContent = `후보 준비 중... (${result.tag})`;
          setUpdateProgress(40, '엔진 후보 다운로드·빌드·호환성 검증 중');
          stopProgress = await listen<{ percent: number; stage: string; message: string }>('engine-update-progress', (event) => {
            setUpdateProgress(event.payload.percent, event.payload.message);
            updateButton.textContent = `${event.payload.message} (${event.payload.percent}%)`;
          });
          const update = await invoke<{ stage: string; message: string }>('run_engine_update');
          if (update.stage === 'applied') {
            setUpdateProgress(100, `RHWP ${result.tag} 적용 완료 · 앱 재로드 중`);
            updateButton.textContent = `RHWP ${result.tag} 업데이트 완료 — 다시 로드 중...`;
            window.setTimeout(() => window.location.reload(), 800);
          } else {
            updateProgressFill.style.background = '#e03131';
            const reason = update.message.trim() || '업데이트를 완료하지 못했습니다. 현재 버전은 그대로 유지됩니다.';
            setUpdateProgress(100, reason);
            updateButton.textContent = reason;
          }
        }
      } catch (error) {
        updateProgressFill.style.background = '#e03131';
        setUpdateProgress(100, `실패: ${error}`);
        updateButton.textContent = '업데이트 확인 실패';
        console.error('[engine-update]', error);
      } finally {
        stopProgress?.();
        updateButton.disabled = false;
      }
    });
    body.appendChild(updateButton);

    // 하이퍼링크 모듈화
    const setupLink = (id: string, url: string) => {
      const el = scrollBox.querySelector(`#${id}`);
      if (el) el.addEventListener('click', async (e) => {
        e.preventDefault();
        try { await open(url); } catch (err) { console.error(err); }
      });
    };
    setupLink('rhwp-link', opensource.rhwp.url);
    setupLink('uni-hwp-home', productData.manufacturer.url);

    // 하단 카피라이트
    const footerCopyright = document.createElement('div');
    footerCopyright.style.marginTop = '24px';
    footerCopyright.style.fontSize = '0.7rem';
    footerCopyright.style.color = '#cbd5e1';
    footerCopyright.textContent = "UNI-HWP IS AN INDEPENDENT SOFTWARE PROJECT.";
    body.appendChild(footerCopyright);

    return body;
  }

  protected onConfirm(): void {}

  override show(): void {
    super.show();
    const footer = this.dialog.querySelector('.dialog-footer');
    if (footer) {
      footer.innerHTML = '';
      const okBtn = document.createElement('button');
      okBtn.className = 'dialog-btn dialog-btn-primary';
      okBtn.style.display = 'inline-flex';
      okBtn.style.justifyContent = 'center';
      okBtn.style.alignItems = 'center';
      okBtn.style.padding = '0 48px';
      okBtn.style.height = '34px';
      okBtn.style.background = '#4c6ef5';
      okBtn.style.border = 'none';
      okBtn.style.borderRadius = '6px';
      okBtn.style.color = 'white';
      okBtn.style.cursor = 'pointer';
      okBtn.style.fontSize = '0.8rem';
      okBtn.style.fontWeight = '600';
      okBtn.style.transition = 'all 0.2s ease';
      
      okBtn.textContent = '확인';
      okBtn.addEventListener('click', () => this.hide());
      footer.appendChild(okBtn);
    }
  }
}
