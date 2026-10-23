import { icon } from './ui/icons';

interface WebkitElement extends HTMLElement { webkitRequestFullscreen?: () => void | Promise<void> }
interface WebkitDocument extends Document { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void | Promise<void> }
export class Fullscreen {
  private maximized = false;
  constructor(private root: WebkitElement, readonly button: HTMLButtonElement, private onResize: () => void) {
    button.addEventListener('click', () => this.toggle());
    document.addEventListener('fullscreenchange', () => this.sync());
    document.addEventListener('webkitfullscreenchange', () => this.sync());
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && this.maximized) { this.maximized = false; this.sync(); } });
    this.sync();
  }
  get active() { return Boolean(document.fullscreenElement || (document as WebkitDocument).webkitFullscreenElement || this.maximized); }
  async toggle() {
    const doc = document as WebkitDocument;
    try {
      if (this.maximized) { this.maximized = false; }
      else if (doc.fullscreenElement) await doc.exitFullscreen();
      else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      else if (this.root.requestFullscreen && document.fullscreenEnabled) await this.root.requestFullscreen();
      else if (this.root.webkitRequestFullscreen) await this.root.webkitRequestFullscreen();
      else this.maximized = true;
    } catch { this.maximized = !this.maximized; }
    this.sync();
  }
  private sync() {
    this.root.classList.toggle('maximized', this.maximized);
    this.button.innerHTML = icon(this.active ? 'collapse' : 'expand');
    this.button.setAttribute('aria-label', this.active ? 'Exit fullscreen' : 'Enter fullscreen');
    this.button.title = this.active ? 'Exit fullscreen (Esc)' : 'Enter fullscreen';
    this.button.setAttribute('aria-pressed',String(this.active));
    requestAnimationFrame(() => this.onResize());
  }
}
