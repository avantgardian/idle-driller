export class KeybindingsLegend {
    el: HTMLElement;
    private minimized = false;

    constructor() {
        this.el = document.createElement('div');
        this.el.className = 'kb-legend';
        this.el.innerHTML = `
            <div class="kb-legend-header">
                <span class="kb-legend-title">⌨️ Keybindings</span>
                <button class="kb-legend-toggle">−</button>
            </div>
            <div class="kb-legend-body">
                <div class="kb-row"><kbd>Tab</kbd><span>Next drill</span></div>
                <div class="kb-row"><kbd>Shift+Tab</kbd><span>Prev drill</span></div>
                <div class="kb-row"><kbd>N</kbd><span>Next empty node</span></div>
                <div class="kb-row"><kbd>B</kbd><span>Build drill</span></div>
                <div class="kb-row"><kbd>D</kbd><span>Add drone</span></div>
                <div class="kb-row"><kbd>C</kbd><span>Upgrade capacity</span></div>
                <div class="kb-row"><kbd>U</kbd><span>Upgrade base</span></div>
                <div class="kb-row"><kbd>O</kbd><span>Overdrive</span></div>
            </div>
        `;
        document.body.appendChild(this.el);

        this.el.querySelector('.kb-legend-toggle')!.addEventListener('click', () => this.toggle());
    }

    private toggle() {
        this.minimized = !this.minimized;
        this.el.classList.toggle('minimized', this.minimized);
        const btn = this.el.querySelector('.kb-legend-toggle')!;
        btn.textContent = this.minimized ? '+' : '−';
    }
}
